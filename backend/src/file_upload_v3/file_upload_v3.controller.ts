/* eslint-disable prettier/prettier */
// eslint-disable-next-line prettier/prettier
import {
  Post,
  Get,
  Delete,
  Body,
  Param,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  NotFoundException,
  Query,
  Put,
  UseGuards,
  Request,
  Res
} from '@nestjs/common';
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadPoolService } from './services/file_upload_v3.service';
import { InitiateUploadDto, UploadChunkDto, CompleteUploadDto } from './dto/upload.dto';
import { Controller } from '@nestjs/common';
import { FileSizeValidationPipe } from './validation';
import { CreateFolderDto } from './dto/create-folder.dto';
import { CreateFileDto } from './dto/create-file.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { R2StorageService } from '../r2-storage/r2-storage.service';

// @UseGuards(JwtAuthGuard)
@Controller('upload')
export class UploadController {
  constructor(
    private readonly uploadPoolService: UploadPoolService,
    private readonly r2StorageService: R2StorageService,
  ) { }

  @Get("all")
  @UseGuards(JwtAuthGuard)
  async getAll(@Query("folderId") folderId: string, @Request() req) {
    const userId = req.user?._id?.toString();
    if (folderId) return await this.uploadPoolService.getAllUploadsUnderFolderForUser(folderId, userId);
    const allSessions = await this.uploadPoolService.getAllUploadsForUser(userId);
    return allSessions;
  }

  @Post('initiate')
  @UseGuards(JwtAuthGuard)
  async initiateUpload(@Body() dto: InitiateUploadDto, @Request() req) {
    const chunkSize = 5 * 1024 * 1024; // 5mb
    const totalChunks = Math.ceil(dto.fileSize / chunkSize);

    const createdBy = req.user?._id?.toString();

    const uploadId = await this.uploadPoolService.initiateUpload(dto.fileName, dto.fileSize, totalChunks, dto?.parent, dto?.children, dto?.fileHash, dto?.resourceType, createdBy);
    return { uploadId, totalChunks };
  }


  @Post('folder')
  @UseGuards(JwtAuthGuard)
  async createFolder(@Body() dto: CreateFolderDto, @Request() req) {
    const createdBy = req.user?._id?.toString();
    const { _id } = await this.uploadPoolService.createNewFolder(dto.folderName, dto.parent, undefined, createdBy);
    return { uploadId: _id };
  }

  @Post('create-file')
  @UseGuards(JwtAuthGuard)
  async createFile(@Body() dto: CreateFileDto, @Request() req) {
    const createdBy = req.user?._id?.toString();
    const uploadId = await this.uploadPoolService.createEmptyFile(dto.fileName, dto.parent, createdBy);
    return { uploadId };
  }

  // ── Direct R2 Upload ──────────────────────────

  @Post('direct-upload')
  @UseGuards(JwtAuthGuard)
  async initiateDirectUpload(
    @Body() body: { fileName: string; fileSize: number; contentType: string; parentId?: string },
    @Request() req,
  ) {
    const createdBy = req.user?._id?.toString();
    return await this.uploadPoolService.initiateDirectUpload(
      body.fileName,
      body.fileSize,
      body.contentType,
      body.parentId,
      createdBy,
    );
  }

  @Post('direct-upload/confirm/:uploadId')
  @UseGuards(JwtAuthGuard)
  async confirmDirectUpload(@Param('uploadId') uploadId: string) {
    return await this.uploadPoolService.confirmDirectUpload(uploadId);
  }

  @Post('chunk')
  @UseInterceptors(FileInterceptor('chunk'))
  @UseGuards(JwtAuthGuard)
  async uploadChunk(@UploadedFile(
    new FileSizeValidationPipe(5 * 1024 * 1024)
  ) file: Express.Multer.File, @Body() dto: UploadChunkDto) {
    if (!file) {
      throw new BadRequestException('No chunk file provided');
    }

    await this.uploadPoolService.uploadChunk(dto.uploadId, Number(dto.chunkIndex), file.buffer);

    return {
      success: true,
      message: `Chunk ${dto.chunkIndex} uploaded successfully`,
    };
  }

  @Put('pause/:uploadId')
  @UseGuards(JwtAuthGuard)
  async pauseCurrentChunkUpload(@Param('uploadId') uploadId: string, @Query("chunkIndex") chunkIndex: number) {
    return await this.uploadPoolService.pauseCurrentChunkUpload(uploadId, chunkIndex);
  }

  @Get('status/:uploadId')
  @UseGuards(JwtAuthGuard)
  async getUploadStatus(@Param('uploadId') uploadId: string) {
    return await this.uploadPoolService.getUploadStatus(uploadId);
  }

  @Post('complete')
  @UseGuards(JwtAuthGuard)
  async completeUpload(@Body() dto: CompleteUploadDto) {
    const filePath = await this.uploadPoolService.completeUpload(dto.uploadId);
    return {
      success: true,
      message: 'Upload completed successfully',
      filePath,
    };
  }

  @Delete("all")
  @UseGuards(JwtAuthGuard)
  async deleteAllUploadedFiles(@Body() dto: { uploadIds: string[] }) {
    if (!dto?.uploadIds) throw new BadRequestException('No upload ids provided');
    if (dto?.uploadIds.length === 0) throw new BadRequestException('No upload ids provided');
    await this.uploadPoolService.deleteAllUploadedFiles(dto.uploadIds);
    return {
      success: true,
      message: 'All uploads cancelled',
    };
  }

  @Delete(':uploadId')
  @UseGuards(JwtAuthGuard)
  async cancelUpload(@Param('uploadId') uploadId: string) {
    await this.uploadPoolService.cancelUpload(uploadId);
    return {
      success: true,
      message: 'Upload cancelled',
    };
  }

  @Post(':uploadId/activity')
  @UseGuards(JwtAuthGuard)
  async updateActivity(@Param('uploadId') uploadId: string, @Request() req) {
    const userId = req.user?._id?.toString();
    return await this.uploadPoolService.updateActivity(uploadId, userId);
  }

  @Get(':uploadId/history')
  @UseGuards(JwtAuthGuard)
  async getHistory(@Param('uploadId') uploadId: string) {
    return await this.uploadPoolService.getHistory(uploadId);
  }

  @Get('thumbnails/:uploadId')
  async getThumbnail(@Param('uploadId') uploadId: string, @Res() res: Response) {
    try {
      const thumbnailKey = this.r2StorageService.buildThumbnailKey(uploadId);
      const exists = await this.r2StorageService.fileExists(thumbnailKey);

      if (!exists) {
        return res.status(404).send('Not found');
      }

      const { stream, contentType } = await this.r2StorageService.downloadFileStream(thumbnailKey);

      res.set({
        'Content-Type': contentType || 'image/png',
        'Cache-Control': 'public, max-age=31536000',
      });

      stream.pipe(res);
    } catch (error) {
      console.error('Error serving thumbnail:', error);
      return res.status(500).send('Error serving thumbnail');
    }
  }

  @Put('move/:uploadId')
  @UseGuards(JwtAuthGuard)
  async moveItem(@Param('uploadId') uploadId: string, @Body() dto: { newParentId: string | null }, @Request() req) {
    const userId = req.user?._id?.toString();
    return await this.uploadPoolService.moveItem(uploadId, dto.newParentId, userId);
  }

  /**
   * Serve media files (images/videos) for inline preview from R2
   */
  @Get('media/:uploadId')
  @UseGuards(JwtAuthGuard)
  async getMedia(@Param('uploadId') uploadId: string, @Res() res: Response) {
    try {
      const file = await this.uploadPoolService.getUploadStatus(uploadId);
      if (!file) {
        return res.status(404).send('File not found');
      }

      const r2Key = file.r2Key;
      if (!r2Key) {
        return res.status(404).send('File not found in storage');
      }

      const exists = await this.r2StorageService.fileExists(r2Key);
      if (!exists) {
        return res.status(404).send('File not found in R2');
      }

      const fileName = file.fileName.split('/').pop() || file.fileName;
      const ext = fileName.split('.').pop()?.toLowerCase() || '';

      // Media MIME types
      const mimeTypes: Record<string, string> = {
        // Images
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        png: 'image/png',
        gif: 'image/gif',
        webp: 'image/webp',
        svg: 'image/svg+xml',
        bmp: 'image/bmp',
        ico: 'image/x-icon',
        // Videos
        mp4: 'video/mp4',
        webm: 'video/webm',
        ogg: 'video/ogg',
        mov: 'video/quicktime',
        avi: 'video/x-msvideo',
        mkv: 'video/x-matroska',
        // Audio
        mp3: 'audio/mpeg',
        wav: 'audio/wav',
        flac: 'audio/flac',
        m4a: 'audio/mp4',
      };

      const contentType = mimeTypes[ext] || 'application/octet-stream';

      const { stream } = await this.r2StorageService.downloadFileStream(r2Key);

      res.set({
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000',
      });

      stream.pipe(res);
    } catch (error) {
      console.error('Error serving media:', error);
      return res.status(500).send('Error serving media');
    }
  }

  /**
   * Get a presigned R2 URL for direct preview in the browser.
   * Returns a time-limited signed URL (15 min) so the client can load media directly.
   */
  @Get('preview-url/:uploadId')
  @UseGuards(JwtAuthGuard)
  async getPreviewUrl(@Param('uploadId') uploadId: string, @Query('expiry') expiry?: string) {
    const file = await this.uploadPoolService.getUploadStatus(uploadId);
    if (!file) {
      throw new NotFoundException('File not found');
    }

    const r2Key = file.r2Key;
    if (!r2Key) {
      throw new NotFoundException('File not found in storage');
    }

    const exists = await this.r2StorageService.fileExists(r2Key);
    if (!exists) {
      throw new NotFoundException('File not found in R2');
    }

    // Default 15 minutes, max 1 hour
    let expiresInSeconds = 900;
    if (expiry) {
      const parsed = parseInt(expiry, 10);
      if (!isNaN(parsed) && parsed > 0 && parsed <= 3600) {
        expiresInSeconds = parsed;
      }
    }

    const presignedUrl = await this.r2StorageService.getPresignedDownloadUrl(r2Key, expiresInSeconds);

    const fileName = file.fileName?.split('/').pop() || file.fileName;
    const ext = fileName.split('.').pop()?.toLowerCase() || '';

    // Determine content type from extension
    const mimeTypes: Record<string, string> = {
      // Images
      jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
      gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml',
      bmp: 'image/bmp', ico: 'image/x-icon',
      // Videos
      mp4: 'video/mp4', webm: 'video/webm', ogg: 'video/ogg',
      mov: 'video/quicktime', avi: 'video/x-msvideo', mkv: 'video/x-matroska',
      // Audio
      mp3: 'audio/mpeg', wav: 'audio/wav', flac: 'audio/flac', m4a: 'audio/mp4',
      // Documents
      pdf: 'application/pdf',
    };

    return {
      url: presignedUrl,
      fileName,
      fileSize: file.fileSize,
      contentType: mimeTypes[ext] || 'application/octet-stream',
      expiresInSeconds,
    };
  }

}
