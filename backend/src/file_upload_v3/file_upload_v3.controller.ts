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
  UseGuards
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadPoolService } from './services/file_upload_v3.service';
import { InitiateUploadDto, UploadChunkDto, CompleteUploadDto } from './dto/upload.dto';
import { Controller } from '@nestjs/common'; 
import { FileSizeValidationPipe } from './validation';
import { CreateFolderDto } from './dto/create-folder.dto';
import { CreateFileDto } from './dto/create-file.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('upload')
export class UploadController {
  constructor(private readonly uploadPoolService: UploadPoolService) { }
  
  @Get("all")
  async getAll(@Query("folderId") folderId: string) { 
    if(folderId) return await this.uploadPoolService.getAllUploadsUnderFolder(folderId)
    const allSessions =  await this.uploadPoolService.getAllUploads();
    return allSessions
  }

  @Post('initiate')
  async initiateUpload(@Body() dto: InitiateUploadDto) {
    const chunkSize = 5 * 1024 * 1024; // 5mb
    const totalChunks = Math.ceil(dto.fileSize / chunkSize);
    const uploadId = await this.uploadPoolService.initiateUpload(dto.fileName, dto.fileSize, totalChunks, dto?.parent, dto?.children, dto?.fileHash, dto?.resourceType);
    return { uploadId, totalChunks };
  }


  @Post('folder')
  async createFolder(@Body() dto: CreateFolderDto) {
    const {_id} = await this.uploadPoolService.createNewFolder(dto.folderName, dto.parent);
    return { uploadId:_id };
  }

  @Post('create-file')
  async createFile(@Body() dto: CreateFileDto) {
    const uploadId = await this.uploadPoolService.createEmptyFile(dto.fileName, dto.parent);
    return { uploadId };
  }

  @Post('chunk')
  @UseInterceptors(FileInterceptor('chunk'))

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
  async pauseCurrentChunkUpload(@Param('uploadId') uploadId: string,@Query("chunkIndex") chunkIndex: number) {
    return await this.uploadPoolService.pauseCurrentChunkUpload(uploadId, chunkIndex);
  }

  @Get('status/:uploadId')
  async getUploadStatus(@Param('uploadId') uploadId: string) {
    return await this.uploadPoolService.getUploadStatus(uploadId);
  }

  @Post('complete')
  async completeUpload(@Body() dto: CompleteUploadDto) {
    const filePath = await this.uploadPoolService.completeUpload(dto.uploadId);
    return {
      success: true,
      message: 'Upload completed successfully',
      filePath,
    };
  }

    @Delete("all")
  async deleteAllUploadedFiles(@Body() dto: {uploadIds:string[]}) {
    if(!dto?.uploadIds) throw new BadRequestException('No upload ids provided');
    if(dto?.uploadIds.length === 0) throw new BadRequestException('No upload ids provided');
    await this.uploadPoolService.deleteAllUploadedFiles(dto.uploadIds);
    return {
      success: true,
      message: 'All uploads cancelled',
    };
  }

  @Delete(':uploadId')
  async cancelUpload(@Param('uploadId') uploadId: string) {
    await this.uploadPoolService.cancelUpload(uploadId);
    return {
      success: true,
      message: 'Upload cancelled',
    };
  }




}
