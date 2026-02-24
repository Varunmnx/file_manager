import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { FileFolderRepository } from '../repositories/file-folder.repository';
import { ActivityRepository } from '../repositories/activity.repository';
import { FileRevisionRepository } from '../../onlyoffice/repositories/file-revision.repository';
import { existsSync, rmSync, unlinkSync } from 'fs';
import { join } from 'path';
import { Types } from 'mongoose';

/**
 * Scheduled task service to clean up stale/abandoned uploads.
 * Uploads that have been paused or interrupted and not resumed within 24 hours
 * will be automatically deleted.
 */
@Injectable()
export class UploadCleanupService {
    private readonly logger = new Logger(UploadCleanupService.name);
    private readonly uploadDir = join(process.cwd(), 'uploads');
    private readonly chunksDir = join(process.cwd(), 'uploads', 'chunks');
    private readonly revisionsDir = join(process.cwd(), 'uploads', 'revisions');

    // 24 hours in milliseconds
    private readonly STALE_UPLOAD_THRESHOLD_MS = 24 * 60 * 60 * 1000;

    constructor(
        private readonly fileFolderRepository: FileFolderRepository,
        private readonly activityRepository: ActivityRepository,
        private readonly fileRevisionRepository: FileRevisionRepository,
    ) { }

    /**
     * Runs every hour to clean up stale uploads.
     * An upload is considered stale if:
     * - It is not completed (uploadedChunks.length < totalChunks)
     * - It has not been modified in the last 24 hours (based on lastActivity)
     */
    @Cron(CronExpression.EVERY_HOUR)
    async cleanupStaleUploads(): Promise<void> {
        this.logger.log('Starting stale upload cleanup...');

        try {
            const staleThreshold = new Date(Date.now() - this.STALE_UPLOAD_THRESHOLD_MS);

            // Find all incomplete uploads that haven't been touched in 24 hours
            const staleUploads = await this.fileFolderRepository.findStaleUploads(staleThreshold);

            if (staleUploads.length === 0) {
                this.logger.log('No stale uploads found.');
                return;
            }

            this.logger.log(`Found ${staleUploads.length} stale uploads to clean up.`);

            for (const upload of staleUploads) {
                try {
                    await this.cleanupSingleUpload(upload._id.toString(), upload.fileName);
                    this.logger.log(`Cleaned up stale upload: ${upload.fileName} (ID: ${upload._id})`);
                } catch (error) {
                    this.logger.error(`Failed to clean up upload ${upload._id}:`, error);
                }
            }

            this.logger.log(`Stale upload cleanup complete. Cleaned ${staleUploads.length} uploads.`);
        } catch (error) {
            this.logger.error('Error during stale upload cleanup:', error);
        }
    }

    /**
     * Clean up a single upload - delete from DB, delete chunks, revisions, and activities
     */
    private async cleanupSingleUpload(uploadId: string, fileName: string): Promise<void> {
        // 1. Delete chunk files from disk
        const chunkDir = join(this.chunksDir, uploadId);
        if (existsSync(chunkDir)) {
            rmSync(chunkDir, { recursive: true, force: true });
        }

        // 2. Delete the actual file if it exists (uses uploadId as filename in uploads dir)
        const filePath = join(this.uploadDir, uploadId);
        if (existsSync(filePath)) {
            try {
                unlinkSync(filePath);
            } catch (e) {
                this.logger.warn(`Could not delete file ${filePath}: ${e.message}`);
            }
        }

        // Also try with the fileName
        const filePathByName = join(this.uploadDir, fileName);
        if (existsSync(filePathByName)) {
            try {
                unlinkSync(filePathByName);
            } catch (e) {
                this.logger.warn(`Could not delete file ${filePathByName}: ${e.message}`);
            }
        }

        // 3. Delete revisions from DB and disk
        const revisions = await this.fileRevisionRepository.findByFileId(uploadId);
        for (const revision of revisions) {
            if (revision.revisionFileName) {
                const revisionPath = join(this.revisionsDir, revision.revisionFileName);
                if (existsSync(revisionPath)) {
                    try {
                        unlinkSync(revisionPath);
                    } catch (e) {
                        this.logger.warn(`Could not delete revision file ${revisionPath}: ${e.message}`);
                    }
                }
            }
        }
        await this.fileRevisionRepository.deleteAllRevisions(uploadId);

        // 4. Delete activities
        await this.activityRepository.deleteByItemId(uploadId);

        // 5. Delete the upload record from DB
        await this.fileFolderRepository.deleteOne(new Types.ObjectId(uploadId));
    }

    /**
     * Manual trigger for cleanup - can be called from a controller/endpoint
     */
    async manualCleanup(): Promise<{ cleaned: number }> {
        const staleThreshold = new Date(Date.now() - this.STALE_UPLOAD_THRESHOLD_MS);
        const staleUploads = await this.fileFolderRepository.findStaleUploads(staleThreshold);

        let cleaned = 0;
        for (const upload of staleUploads) {
            try {
                await this.cleanupSingleUpload(upload._id.toString(), upload.fileName);
                cleaned++;
            } catch (error) {
                this.logger.error(`Failed to clean up upload ${upload._id}:`, error);
            }
        }

        return { cleaned };
    }
}
