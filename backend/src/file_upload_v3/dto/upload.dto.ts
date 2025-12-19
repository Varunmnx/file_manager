/* eslint-disable @typescript-eslint/no-unsafe-call */
// ============= DTOs =============
// upload.dto.ts
import { IsString, IsNumber, IsOptional } from 'class-validator';

export class InitiateUploadDto {
  @IsString()
  fileName: string;

  @IsNumber()
  fileSize: number;

  @IsOptional()
  @IsString()
  resourceType?: 'dir' | 'file';

  @IsOptional()
  @IsString()
  parent?: string[];

  @IsOptional()
  @IsString()
  children?: string[];

  @IsOptional()
  @IsString()
  fileHash?: string;
}

export class UploadChunkDto {
  @IsString()
  uploadId: string;

  @IsNumber()
  chunkIndex: number;

  @IsNumber()
  chunkSize: number;
}

export class CompleteUploadDto {
  @IsString()
  uploadId: string;
}

export interface UploadSession {
  uploadId: string;
  fileName: string;
  fileSize: number;
  totalChunks: number;
  uploadedChunks: Array<number>;
  chunkSize: number;
  createdAt: Date;
  lastActivity: Date;
  fileHash?: string;
  resourceType?: 'dir' | 'file';
}
