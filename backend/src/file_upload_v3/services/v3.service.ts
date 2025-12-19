/* eslint-disable prettier/prettier */
// upload-pool.service.ts
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync, readdirSync, rmSync } from 'fs';
import { join } from 'path';
import { v4 as uuid } from 'uuid';
import { UploadSession } from '../dto/upload.dto';


@Injectable()
export class UploadPoolService {
  // private uploadSessions: Map<string, UploadSession> = new Map();
  private readonly uploadDir = join(process.cwd(), 'uploads');
  private readonly chunksDir = join(process.cwd(), 'uploads', 'chunks');
  private readonly metaDataDir = join(process.cwd(), 'uploads', 'meta');
  private readonly sessionTimeout = 24 * 60 * 60 * 1000; // 24 hours

  constructor() {
    // Create directories if they don't exist
    if (!existsSync(this.uploadDir)) {
      mkdirSync(this.uploadDir, { recursive: true });
    }
    if (!existsSync(this.chunksDir)) {
      mkdirSync(this.chunksDir, { recursive: true });
    }

    // Start cleanup interval
    this.startCleanupInterval();
  }

  initiateUpload(fileName: string, fileSize: number, totalChunks: number, fileHash?: string, resourceType?:"dir"|"file"): string {
    const uploadId = uuid();
    const session: UploadSession = {
      uploadId,
      fileName,
      fileSize,
      totalChunks,
      uploadedChunks: [],
      chunkSize: Math.ceil(fileSize / totalChunks),
      createdAt: new Date(),
      lastActivity: new Date(),
      fileHash,
      resourceType: resourceType ?? "file"
    };

    // this.uploadSessions.set(uploadId, session);
    writeFileSync(join(this.metaDataDir, `${uploadId}.json`), JSON.stringify({...session,uploadedChunks:Array.from(session.uploadedChunks)}, null, 2));
    // Create upload directory for chunks
    const uploadChunkDir = join(this.chunksDir, uploadId);
    if (!existsSync(uploadChunkDir)) {
      mkdirSync(uploadChunkDir, { recursive: true });
    }

    return uploadId;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async uploadChunk(uploadId: string, chunkIndex: number, chunkBuffer: Buffer): Promise<void> {
    // const session = this.uploadSessions.get(uploadId);
    const raw_session = readFileSync(join(this.metaDataDir, `${uploadId}.json`),"utf-8");
    const session = JSON.parse(raw_session) as UploadSession;
    if (!session) {
      throw new NotFoundException('Upload session not found');
    }

    if (chunkIndex < 0 || chunkIndex >= session.totalChunks) {
      throw new BadRequestException('Invalid chunk index');
    }

    // Save chunk to disk
    const chunkPath = join(this.chunksDir, uploadId, `chunk-${chunkIndex}`);
    writeFileSync(chunkPath, chunkBuffer);
    
    // Update session
    session.uploadedChunks = [...session.uploadedChunks, chunkIndex];
    session.lastActivity = new Date();

    const data = readFileSync(join(this.metaDataDir, `${uploadId}.json`),"utf-8");
    const metaData = JSON.parse(data) as UploadSession; 
    metaData.lastActivity = new Date();
    writeFileSync(join(this.metaDataDir, `${uploadId}.json`), JSON.stringify({...metaData,uploadedChunks: session.uploadedChunks}, null, 2));
  }

  getUploadStatus(uploadId: string) {
    const raw =  readFileSync(join(this.metaDataDir, `${uploadId}.json`),"utf-8");
    const session = JSON.parse(raw) as UploadSession;
    if (!session) {
      throw new NotFoundException('Upload session not found');
    }

    return {
      uploadId: session.uploadId,
      fileName: session.fileName,
      fileSize: session.fileSize,
      totalChunks: session.totalChunks,
      uploadedChunks: Array.from(session.uploadedChunks).sort((a, b) => a - b),
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      progress: (session.uploadedChunks?.length / session.totalChunks) * 100,
      isComplete: session.uploadedChunks.length === session.totalChunks,
    };
  }

  async completeUpload(uploadId: string): Promise<string> {
    const raw_session = readFileSync(join(this.metaDataDir, `${uploadId}.json`),"utf-8");
    const session = JSON.parse(raw_session) as UploadSession;
    if (!session) {
      throw new NotFoundException('Upload session not found');
    }

    if (session.uploadedChunks?.length !== session.totalChunks) {
      throw new BadRequestException('Not all chunks uploaded');
    }

    // Merge chunks
    const finalFilePath = join(this.uploadDir, session.fileName);
    const writeStream = createWriteStream(finalFilePath);

    for (let i = 0; i < session.totalChunks; i++) {
      const chunkPath = join(this.chunksDir, uploadId, `chunk-${i}`);
      const chunkBuffer = readFileSync(chunkPath);
      writeStream.write(chunkBuffer);
    }

    writeStream.end();

    // Wait for write to complete
    await new Promise((resolve, reject) => {
      writeStream.on('finish', resolve as () => void);
      writeStream.on('error', reject);
    });

    // Cleanup chunks
    this.cleanupChunks(uploadId);
    
    // unlinkSync(join(this.metaDataDir, `${uploadId}.json`));

    return finalFilePath;
  }

  cancelUpload(uploadId: string): void {
    const raw_session = readFileSync(join(this.metaDataDir, `${uploadId}.json`),"utf-8");
    const session = JSON.parse(raw_session) as UploadSession;
    if (!session) {
      throw new NotFoundException('Upload session not found');
    }

    this.cleanupChunks(uploadId);

    unlinkSync(join(this.metaDataDir, `${uploadId}.json`));
  }

  private cleanupChunks(uploadId: string): void {
    const uploadChunkDir = join(this.chunksDir, uploadId);
    if (existsSync(uploadChunkDir)) {
      const chunks = readdirSync(uploadChunkDir);
      chunks.forEach((chunk) => {
        unlinkSync(join(uploadChunkDir, chunk));
      });
      // Use rmSync or rmdirSync instead of unlinkSync for directories
      rmSync(uploadChunkDir, { recursive: true, force: true });
      // Alternative for older Node versions:
      // rmdirSync(uploadChunkDir);
    }
  }

  private startCleanupInterval(): void {
    setInterval(
      () => {
        const now = new Date().getTime();
        const folder = join(this.metaDataDir);
        for (const file of folder) {
           const fileContentRaw = readFileSync(join(this.metaDataDir, `${file}`),"utf-8");
           const fileContent = JSON.parse(fileContentRaw) as UploadSession;
           if (now - fileContent.lastActivity.getTime() > this.sessionTimeout) {
             this.cleanupChunks(fileContent.uploadId);
            //  unlinkSync(join(this.metaDataDir, `${file}`));
           }
        }
      },
      60 * 60 * 1000,
    ); // Run every hour
  }

  getAllUploads(){
    const folder = join(this.metaDataDir);
    const uploads:UploadSession[] = [];
    const allFiles = readdirSync(folder);
    for (const file of allFiles) { 
      const fileContentRaw = readFileSync(join(this.metaDataDir, `${file}`),"utf-8");
      const fileContent = JSON.parse(fileContentRaw) as UploadSession; 
      uploads.push(fileContent);
    }
    return uploads;
  }
}
