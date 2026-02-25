import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { FileFolderRepository } from '../repositories/file-folder.repository';
import { ActivityRepository } from '../repositories/activity.repository';
import { FileRevisionRepository } from '../../onlyoffice/repositories/file-revision.repository';
import { R2StorageService } from '../../r2-storage/r2-storage.service';
import { Types } from 'mongoose';

/**
 * Scheduled task service to clean up stale/abandoned uploads.
 * Uploads that have been paused or interrupted and not resumed within 24 hours
 * will be automatically deleted.
 */
@Injectable()
export class UploadCleanupService {
    private readonly logger = new Logger(UploadCleanupService.name);

    // 24 hours in milliseconds
    private readonly STALE_UPLOAD_THRESHOLD_MS = 24 * 60 * 60 * 1000;

    constructor(
        private readonly fileFolderRepository: FileFolderRepository,
        private readonly activityRepository: ActivityRepository,
        private readonly fileRevisionRepository: FileRevisionRepository,
        private readonly r2StorageService: R2StorageService,
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
                    await this.cleanupSingleUpload(upload._id.toString(), upload.r2Key, upload.r2UploadId);
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
     * Clean up a single upload - delete from DB, delete from R2, revisions, and activities
     */
    private async cleanupSingleUpload(uploadId: string, r2Key?: string, r2UploadId?: string): Promise<void> {
        // 1. Abort R2 multipart upload if still in progress
        if (r2Key && r2UploadId) {
            try {
                await this.r2StorageService.abortMultipartUpload(r2Key, r2UploadId);
                this.logger.log(`[R2] Aborted multipart upload for ${uploadId}`);
            } catch (e) {
                this.logger.warn(`[R2] Could not abort multipart upload for ${uploadId}: ${e.message}`);
            }
        }

        // 2. Delete the file from R2 if it exists
        if (r2Key) {
            try {
                await this.r2StorageService.deleteFile(r2Key);
            } catch (e) {
                this.logger.warn(`[R2] Could not delete file for ${uploadId}: ${e.message}`);
            }
        }

        // 3. Delete revisions from DB and R2
        const revisions = await this.fileRevisionRepository.findByFileId(uploadId);
        const revisionKeysToDelete: string[] = [];
        for (const revision of revisions) {
            if (revision.revisionFileName) {
                const revisionKey = this.r2StorageService.buildRevisionKey(revision.revisionFileName);
                revisionKeysToDelete.push(revisionKey);
            }
        }

        if (revisionKeysToDelete.length > 0) {
            try {
                await this.r2StorageService.deleteFiles(revisionKeysToDelete);
            } catch (e) {
                this.logger.warn(`[R2] Could not delete revision files for ${uploadId}: ${e.message}`);
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
                await this.cleanupSingleUpload(upload._id.toString(), upload.r2Key, upload.r2UploadId);
                cleaned++;
            } catch (error) {
                this.logger.error(`Failed to clean up upload ${upload._id}:`, error);
            }
        }

        return { cleaned };
    }
}
