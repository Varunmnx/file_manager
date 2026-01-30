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
  Query,
  Put,
  UseGuards,
  Request,
  Res
} from '@nestjs/common';
import { Response } from 'express';
import { join } from 'path';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadPoolService } from './services/file_upload_v3.service';
import { InitiateUploadDto, UploadChunkDto, CompleteUploadDto } from './dto/upload.dto';
import { Controller } from '@nestjs/common';
import { FileSizeValidationPipe } from './validation';
import { CreateFolderDto } from './dto/create-folder.dto';
import { CreateFileDto } from './dto/create-file.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

// @UseGuards(JwtAuthGuard)
@Controller('upload')
export class UploadController {
  constructor(private readonly uploadPoolService: UploadPoolService) { }

  @Get("all")
  @UseGuards(JwtAuthGuard)
  async getAll(@Query("folderId") folderId: string) {
    if (folderId) return await this.uploadPoolService.getAllUploadsUnderFolder(folderId)
    const allSessions = await this.uploadPoolService.getAllUploads();
    return allSessions
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
    const filePath = join(process.cwd(), 'uploads', 'thumbnails', `${uploadId}.png`);
    const fs = require('fs');
    if (!fs.existsSync(filePath)) {
      return res.status(404).send('Not found');
    }
    res.sendFile(filePath);
  }

  @Put('move/:uploadId')
  @UseGuards(JwtAuthGuard)
  async moveItem(@Param('uploadId') uploadId: string, @Body() dto: { newParentId: string | null }, @Request() req) {
    const userId = req.user?._id?.toString();
    return await this.uploadPoolService.moveItem(uploadId, dto.newParentId, userId);
  }

}
