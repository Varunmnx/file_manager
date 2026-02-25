/* eslint-disable prettier/prettier */
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
    S3Client,
    PutObjectCommand,
    GetObjectCommand,
    DeleteObjectCommand,
    CopyObjectCommand,
    HeadObjectCommand,
    ListObjectsV2Command,
    DeleteObjectsCommand,
    CreateMultipartUploadCommand,
    UploadPartCommand,
    CompleteMultipartUploadCommand,
    AbortMultipartUploadCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Upload } from '@aws-sdk/lib-storage';
import { Readable } from 'stream';

export interface R2UploadResult {
    key: string;
    etag?: string;
    size: number;
}

export interface R2MultipartSession {
    uploadId: string;
    key: string;
}

export interface R2CompletedPart {
    ETag: string;
    PartNumber: number;
}

@Injectable()
export class R2StorageService implements OnModuleInit {
    private readonly logger = new Logger(R2StorageService.name);
    private s3Client: S3Client;
    private bucketName: string;

    constructor(private readonly configService: ConfigService) { }

    onModuleInit() {
        const accountId = this.configService.get<string>('CLOUD_FLARE_ACCOUNT_ID');
        const accessKeyId = this.configService.get<string>('CLOUD_FLARE_ACCESS_KEY_ID');
        const secretAccessKey = this.configService.get<string>('CLOUD_FLARE_SECRET_ACCESS_KEY');
        const apiUrl = this.configService.get<string>('CLOUD_FLARE_API_URL');
        const bucketUrl = this.configService.get<string>('CLOUD_FLARE_R3_BUCKET_URL') || '';

        // Extract bucket name from the bucket URL (last segment)
        // e.g., https://xxx.r2.cloudflarestorage.com/varun-file-manager -> varun-file-manager
        const urlParts = bucketUrl.replace(/\/+$/, '').split('/');
        this.bucketName = urlParts[urlParts.length - 1] || 'varun-file-manager';

        const endpoint = apiUrl || `https://${accountId}.r2.cloudflarestorage.com`;

        this.s3Client = new S3Client({
            region: 'auto',
            endpoint,
            credentials: {
                accessKeyId: accessKeyId || '',
                secretAccessKey: secretAccessKey || '',
            },
        });

        this.logger.log(`R2 Storage initialized — bucket: ${this.bucketName}, endpoint: ${endpoint}`);
    }

    // ──────────────────────────────────────────
    //  BASIC OPERATIONS
    // ──────────────────────────────────────────

    /**
     * Upload a buffer to R2
     */
    async uploadFile(key: string, buffer: Buffer, contentType?: string): Promise<R2UploadResult> {
        const command = new PutObjectCommand({
            Bucket: this.bucketName,
            Key: key,
            Body: buffer,
            ContentType: contentType || 'application/octet-stream',
        });

        const result = await this.s3Client.send(command);

        this.logger.log(`[R2] Uploaded: ${key} (${buffer.length} bytes)`);

        return {
            key,
            etag: result.ETag,
            size: buffer.length,
        };
    }

    /**
     * Upload using managed multipart (for large files via streams or buffers)
     */
    async uploadLargeFile(key: string, body: Buffer | Readable, contentType?: string): Promise<R2UploadResult> {
        const upload = new Upload({
            client: this.s3Client,
            params: {
                Bucket: this.bucketName,
                Key: key,
                Body: body,
                ContentType: contentType || 'application/octet-stream',
            },
            queueSize: 4,
            partSize: 5 * 1024 * 1024, // 5 MB
        });

        upload.on('httpUploadProgress', (progress) => {
            this.logger.debug(`[R2] Upload progress for ${key}: ${progress.loaded}/${progress.total}`);
        });

        const result = await upload.done();

        const size = Buffer.isBuffer(body) ? body.length : 0;
        this.logger.log(`[R2] Large upload complete: ${key}`);

        return {
            key,
            etag: result.ETag,
            size,
        };
    }

    /**
     * Download a file from R2 as a Buffer
     */
    async downloadFile(key: string): Promise<Buffer> {
        const command = new GetObjectCommand({
            Bucket: this.bucketName,
            Key: key,
        });

        const response = await this.s3Client.send(command);

        if (!response.Body) {
            throw new Error(`[R2] No body returned for key: ${key}`);
        }

        // Convert the Readable stream to a Buffer
        const stream = response.Body as Readable;
        const chunks: Buffer[] = [];
        for await (const chunk of stream) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }

        return Buffer.concat(chunks);
    }

    /**
     * Download a file from R2 as a Readable stream
     */
    async downloadFileStream(key: string): Promise<{ stream: Readable; contentType?: string; contentLength?: number }> {
        const command = new GetObjectCommand({
            Bucket: this.bucketName,
            Key: key,
        });

        const response = await this.s3Client.send(command);

        if (!response.Body) {
            throw new Error(`[R2] No body returned for key: ${key}`);
        }

        return {
            stream: response.Body as Readable,
            contentType: response.ContentType,
            contentLength: response.ContentLength,
        };
    }

    /**
     * Delete a single object from R2
     */
    async deleteFile(key: string): Promise<void> {
        const command = new DeleteObjectCommand({
            Bucket: this.bucketName,
            Key: key,
        });

        await this.s3Client.send(command);
        this.logger.log(`[R2] Deleted: ${key}`);
    }

    /**
     * Delete multiple objects from R2
     */
    async deleteFiles(keys: string[]): Promise<void> {
        if (keys.length === 0) return;

        // S3 DeleteObjects supports up to 1000 keys per request
        const batches: string[][] = [];
        for (let i = 0; i < keys.length; i += 1000) {
            batches.push(keys.slice(i, i + 1000));
        }

        for (const batch of batches) {
            const command = new DeleteObjectsCommand({
                Bucket: this.bucketName,
                Delete: {
                    Objects: batch.map((key) => ({ Key: key })),
                    Quiet: true,
                },
            });

            await this.s3Client.send(command);
        }

        this.logger.log(`[R2] Deleted ${keys.length} objects`);
    }

    /**
     * Copy an object within R2
     */
    async copyFile(sourceKey: string, destKey: string): Promise<void> {
        const command = new CopyObjectCommand({
            Bucket: this.bucketName,
            CopySource: `${this.bucketName}/${sourceKey}`,
            Key: destKey,
        });

        await this.s3Client.send(command);
        this.logger.log(`[R2] Copied: ${sourceKey} -> ${destKey}`);
    }

    /**
     * Check if a file exists in R2
     */
    async fileExists(key: string): Promise<boolean> {
        try {
            const command = new HeadObjectCommand({
                Bucket: this.bucketName,
                Key: key,
            });
            await this.s3Client.send(command);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Get file metadata (size, content type, etc.)
     */
    async getFileMetadata(key: string): Promise<{ size: number; contentType?: string; lastModified?: Date } | null> {
        try {
            const command = new HeadObjectCommand({
                Bucket: this.bucketName,
                Key: key,
            });
            const response = await this.s3Client.send(command);
            return {
                size: response.ContentLength || 0,
                contentType: response.ContentType,
                lastModified: response.LastModified,
            };
        } catch {
            return null;
        }
    }

    /**
     * List files under a prefix
     */
    async listFiles(prefix: string, maxKeys = 1000): Promise<{ key: string; size: number; lastModified?: Date }[]> {
        const command = new ListObjectsV2Command({
            Bucket: this.bucketName,
            Prefix: prefix,
            MaxKeys: maxKeys,
        });

        const response = await this.s3Client.send(command);
        return (response.Contents || []).map((obj) => ({
            key: obj.Key || '',
            size: obj.Size || 0,
            lastModified: obj.LastModified,
        }));
    }

    // ──────────────────────────────────────────
    //  MULTIPART UPLOAD (Manual Chunked)
    // ──────────────────────────────────────────

    /**
     * Initiate a multipart upload session in R2
     */
    async initiateMultipartUpload(key: string, contentType?: string): Promise<R2MultipartSession> {
        const command = new CreateMultipartUploadCommand({
            Bucket: this.bucketName,
            Key: key,
            ContentType: contentType || 'application/octet-stream',
        });

        const response = await this.s3Client.send(command);

        this.logger.log(`[R2] Multipart upload initiated: ${key}, uploadId: ${response.UploadId}`);

        return {
            uploadId: response.UploadId!,
            key,
        };
    }

    /**
     * Upload a single part of a multipart upload
     * Note: Part numbers start at 1 (not 0) for S3/R2
     */
    async uploadPart(key: string, uploadId: string, partNumber: number, body: Buffer): Promise<R2CompletedPart> {
        const command = new UploadPartCommand({
            Bucket: this.bucketName,
            Key: key,
            UploadId: uploadId,
            PartNumber: partNumber,
            Body: body,
        });

        const response = await this.s3Client.send(command);

        return {
            ETag: response.ETag!,
            PartNumber: partNumber,
        };
    }

    /**
     * Complete a multipart upload by assembling all parts
     */
    async completeMultipartUpload(key: string, uploadId: string, parts: R2CompletedPart[]): Promise<R2UploadResult> {
        // Sort parts by part number
        const sortedParts = [...parts].sort((a, b) => a.PartNumber - b.PartNumber);

        const command = new CompleteMultipartUploadCommand({
            Bucket: this.bucketName,
            Key: key,
            UploadId: uploadId,
            MultipartUpload: {
                Parts: sortedParts,
            },
        });

        const response = await this.s3Client.send(command);

        this.logger.log(`[R2] Multipart upload completed: ${key}`);

        return {
            key,
            etag: response.ETag,
            size: 0, // We don't know the total size here; caller should track it
        };
    }

    /**
     * Abort a multipart upload (cleanup)
     */
    async abortMultipartUpload(key: string, uploadId: string): Promise<void> {
        const command = new AbortMultipartUploadCommand({
            Bucket: this.bucketName,
            Key: key,
            UploadId: uploadId,
        });

        await this.s3Client.send(command);
        this.logger.log(`[R2] Multipart upload aborted: ${key}, uploadId: ${uploadId}`);
    }

    // ──────────────────────────────────────────
    //  PRESIGNED URLs
    // ──────────────────────────────────────────

    /**
     * Generate a presigned download URL
     */
    async getPresignedDownloadUrl(key: string, expiresInSeconds = 3600): Promise<string> {
        const command = new GetObjectCommand({
            Bucket: this.bucketName,
            Key: key,
        });

        return getSignedUrl(this.s3Client, command, { expiresIn: expiresInSeconds });
    }

    /**
     * Generate a presigned upload URL
     */
    async getPresignedUploadUrl(key: string, contentType?: string, expiresInSeconds = 3600): Promise<string> {
        const command = new PutObjectCommand({
            Bucket: this.bucketName,
            Key: key,
            ContentType: contentType || 'application/octet-stream',
        });

        return getSignedUrl(this.s3Client, command, { expiresIn: expiresInSeconds });
    }

    // ──────────────────────────────────────────
    //  HELPER — Build R2 key from file context
    // ──────────────────────────────────────────

    /**
     * Build a storage key for a file upload
     * Format: files/<uploadId>/<fileName>
     */
    buildFileKey(uploadId: string, fileName: string): string {
        return `files/${uploadId}/${fileName}`;
    }

    /**
     * Build a storage key for a chunk
     * Format: chunks/<uploadId>/chunk-<index>
     */
    buildChunkKey(uploadId: string, chunkIndex: number): string {
        return `chunks/${uploadId}/chunk-${chunkIndex}`;
    }

    /**
     * Build a storage key for a revision
     * Format: revisions/<revisionFileName>
     */
    buildRevisionKey(revisionFileName: string): string {
        return `revisions/${revisionFileName}`;
    }

    /**
     * Build a storage key for a thumbnail
     * Format: thumbnails/<uploadId>.png
     */
    buildThumbnailKey(uploadId: string): string {
        return `thumbnails/${uploadId}.png`;
    }
}
