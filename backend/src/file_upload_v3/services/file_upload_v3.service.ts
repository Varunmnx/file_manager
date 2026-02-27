/* eslint-disable prettier/prettier */
import { Injectable, BadRequestException, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { FileFolderRepository } from '../repositories/file-folder.repository';
import { UploadDocument, UploadEntity } from '../entities/upload-status.entity';
import { toObjectId } from 'src/common/utils';
import { Types } from 'mongoose';
import { FileRevisionRepository } from '../../onlyoffice/repositories/file-revision.repository';
import { ActivityRepository } from '../repositories/activity.repository';
import { Activity } from '../entities/activity.entity';
import { R2StorageService } from '../../r2-storage/r2-storage.service';

export interface UploadSession {
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

import { UsersService } from '../../auth/service/auth.service';

@Injectable()
export class UploadPoolService {
    private readonly logger = new Logger(UploadPoolService.name);

    constructor(
        private readonly fileFolderRepository: FileFolderRepository,
        private readonly fileRevisionRepository: FileRevisionRepository,
        private readonly activityRepository: ActivityRepository,
        private readonly r2StorageService: R2StorageService,
        private readonly authService: UsersService,
    ) { }

    async initiateUpload(
        fileName: string,
        fileSize: number,
        totalChunks: number,
        parent?: string[],
        children?: string[],
        fileHash?: string,
        resourceType?: "dir" | "file",
        createdBy?: string
    ): Promise<string> {
        const session: UploadSession = {
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

        const uploadStatus = UploadEntity.builder();

        uploadStatus
            .setFileName(fileName)
            .setFileSize(fileSize)
            .setTotalChunks(totalChunks)
            .setUploadedChunks(session.uploadedChunks)
            .setChunkSize(session.chunkSize)
            .setLastActivity(session.lastActivity)
            .setIsFolder(session.resourceType === "dir");

        if (fileHash) {
            uploadStatus.setFileHash(fileHash);
        }

        if (createdBy) {
            uploadStatus.setCreatedBy(createdBy);
        }

        let fullParentLineage: Types.ObjectId[] = [];

        if (parent && parent.length > 0) {
            const directParentId = parent[parent.length - 1];
            const parentFolder = await this.fileFolderRepository.findById(directParentId);

            if (!parentFolder || !parentFolder.isFolder) {
                throw new NotFoundException('Parent folder not found');
            }

            if (parentFolder.parents && parentFolder.parents.length > 0) {
                fullParentLineage = [...parentFolder.parents, toObjectId(directParentId)];
            } else {
                fullParentLineage = [toObjectId(directParentId)];
            }

            for (const ancestorId of fullParentLineage) {
                const ancestorFolder = await this.fileFolderRepository.findById(ancestorId);
                if (!ancestorFolder || !ancestorFolder.isFolder) {
                    throw new NotFoundException('Ancestor folder not found');
                }

                const ancestorBuilder = ancestorFolder.toBuilder();
                ancestorBuilder.setFileSize(ancestorFolder.fileSize + fileSize);
                await this.fileFolderRepository.update(ancestorFolder._id, ancestorBuilder.build());
            }

            uploadStatus.setParents(fullParentLineage);
        }

        await this.fileFolderRepository.checkDuplicate(fileName, fullParentLineage);

        if (children) {
            uploadStatus.setChildren(children.map(c => toObjectId(c)));
        }

        let newUpload = await this.fileFolderRepository.create(uploadStatus.build());
        newUpload = await newUpload.save();

        const uploadId = newUpload._id.toString();

        // Initiate R2 multipart upload
        const r2Key = this.r2StorageService.buildFileKey(uploadId, fileName);
        const r2Session = await this.r2StorageService.initiateMultipartUpload(r2Key);

        // Store R2 multipart session info in the DB
        const updatedBuilder = newUpload.toBuilder();
        updatedBuilder.setR2Key(r2Key);
        updatedBuilder.setR2UploadId(r2Session.uploadId);
        updatedBuilder.setR2Parts([]);
        await this.fileFolderRepository.update(newUpload._id, updatedBuilder.build());

        return uploadId;
    }

    async createEmptyFile(fileName: string, parentId?: string, createdBy?: string): Promise<string> {
        const fileSize = 0;
        const totalChunks = 1;
        const chunkSize = 0;

        const session: UploadSession = {
            fileName,
            fileSize,
            totalChunks,
            uploadedChunks: [0],
            chunkSize,
            createdAt: new Date(),
            lastActivity: new Date(),
            resourceType: "file"
        };

        const uploadStatus = UploadEntity.builder();
        uploadStatus
            .setFileName(fileName)
            .setFileSize(fileSize)
            .setTotalChunks(totalChunks)
            .setUploadedChunks(session.uploadedChunks)
            .setChunkSize(session.chunkSize)
            .setLastActivity(session.lastActivity)
            .setIsFolder(false);

        if (createdBy) {
            uploadStatus.setCreatedBy(createdBy);
        }

        let fullParentLineage: Types.ObjectId[] = [];
        if (parentId) {
            const parentFolder = await this.fileFolderRepository.findById(parentId);

            if (!parentFolder || !parentFolder.isFolder) {
                throw new NotFoundException('Parent folder not found');
            }

            if (parentFolder.parents && parentFolder.parents.length > 0) {
                fullParentLineage = [...parentFolder.parents, toObjectId(parentId)];
            } else {
                fullParentLineage = [toObjectId(parentId)];
            }

            uploadStatus.setParents(fullParentLineage);
        }

        await this.fileFolderRepository.checkDuplicate(fileName, fullParentLineage);

        let newUpload = await this.fileFolderRepository.create(uploadStatus.build());
        newUpload = await newUpload.save();

        const uploadId = newUpload._id.toString();

        // Upload an empty file to R2
        const r2Key = this.r2StorageService.buildFileKey(uploadId, fileName);
        await this.r2StorageService.uploadFile(r2Key, Buffer.from([]), 'application/octet-stream');

        // Store R2 key in DB
        const updatedBuilder = newUpload.toBuilder();
        updatedBuilder.setR2Key(r2Key);
        await this.fileFolderRepository.update(newUpload._id, updatedBuilder.build());

        return uploadId;
    }

    async createNewFolder(folderName: string, parentId?: string, folderSize?: number, createdBy?: string): Promise<UploadDocument> {
        return await this.fileFolderRepository.createFolder(folderName, parentId, folderSize, createdBy);
    }

    async uploadChunk(uploadId: string, chunkIndex: number, chunkBuffer: Buffer): Promise<void> {
        const uploadSession = await this.fileFolderRepository.findById(uploadId);

        if (!uploadSession) {
            throw new NotFoundException('Upload session not found');
        }

        if (chunkIndex < 0 || chunkIndex >= uploadSession.totalChunks) {
            throw new BadRequestException('Invalid chunk index');
        }

        // Upload chunk as a part to R2 multipart upload
        // R2/S3 part numbers start at 1, so partNumber = chunkIndex + 1
        const partNumber = chunkIndex + 1;
        const r2Key = uploadSession.r2Key;
        const r2UploadId = uploadSession.r2UploadId;

        if (!r2Key || !r2UploadId) {
            throw new BadRequestException('R2 multipart upload session not found. Please re-initiate the upload.');
        }

        const completedPart = await this.r2StorageService.uploadPart(r2Key, r2UploadId, partNumber, chunkBuffer);

        // Update chunk tracking
        let newChunkList = uploadSession.uploadedChunks || [];
        if (!newChunkList.includes(chunkIndex)) {
            newChunkList = [...newChunkList, chunkIndex].sort((a, b) => a - b);
        }

        // Update R2 parts tracking
        let r2Parts = uploadSession.r2Parts || [];
        // Remove any existing entry for this part number (in case of retry)
        r2Parts = r2Parts.filter(p => p.PartNumber !== partNumber);
        r2Parts.push(completedPart);

        const updatedUploadSession = uploadSession.toBuilder()
            .setUploadedChunks(newChunkList)
            .setLastActivity(new Date())
            .setR2Parts(r2Parts)
            .build();

        await this.fileFolderRepository.update(uploadSession._id, updatedUploadSession);

        if (newChunkList.length === uploadSession.totalChunks) {
            await this.completeUpload(uploadId);
        }
    }

    async getUploadStatus(uploadId: string) {
        let uploadSession = await this.fileFolderRepository.findById(uploadId);
        uploadSession = uploadSession?.toObject() as UploadDocument;

        if (!uploadSession) {
            throw new NotFoundException('Upload session not found');
        }

        return {
            ...uploadSession,
            progress: ((uploadSession.uploadedChunks?.length ?? 0) / (uploadSession.totalChunks ?? 1)) * 100,
            isComplete: uploadSession.uploadedChunks?.length === uploadSession.totalChunks
        };
    }

    async completeUpload(uploadId: string): Promise<string> {
        const session = await this.fileFolderRepository.findById(uploadId);

        if (!session) {
            throw new NotFoundException('Upload session not found');
        }

        if (session.uploadedChunks?.length !== session.totalChunks) {
            throw new BadRequestException('Not all chunks uploaded');
        }

        const r2Key = session.r2Key;
        const r2UploadId = session.r2UploadId;
        const r2Parts = session.r2Parts || [];

        if (!r2Key || !r2UploadId) {
            throw new BadRequestException('R2 multipart upload session not found');
        }

        // Complete the multipart upload in R2
        await this.r2StorageService.completeMultipartUpload(r2Key, r2UploadId, r2Parts);

        this.logger.log(`[R2] Upload completed for ${session.fileName}, key: ${r2Key}`);

        // Clear the R2 upload tracking fields (upload is done)
        const updatedSession = session.toBuilder()
            .setR2UploadId('')
            .setR2Parts([])
            .build();
        await this.fileFolderRepository.update(session._id, updatedSession);

        return r2Key;
    }

    async cancelUpload(uploadId: string) {
        const session = await this.fileFolderRepository.findById(uploadId);

        if (!session) {
            throw new NotFoundException('Upload session not found');
        }

        await this.resetParentFolderSizes([uploadId]);

        // Abort the R2 multipart upload if still in progress
        if (session.r2Key && session.r2UploadId) {
            try {
                await this.r2StorageService.abortMultipartUpload(session.r2Key, session.r2UploadId);
            } catch (error) {
                this.logger.warn(`[R2] Failed to abort multipart upload for ${uploadId}: ${error.message}`);
            }
        }

        // Delete the file from R2 if it was already completed
        if (session.r2Key) {
            try {
                await this.r2StorageService.deleteFile(session.r2Key);
            } catch (error) {
                this.logger.warn(`[R2] Failed to delete file for ${uploadId}: ${error.message}`);
            }
        }

        // Delete all file revisions and activities for this file
        await this.cleanupRevisions(uploadId);
        await this.cleanupActivities(uploadId);

        // Delete all children recursively (and their revisions + activities)
        const children = await this.fileFolderRepository.findDescendants(session._id);
        const childIds = children.map(child => child._id.toString());

        // Collect R2 keys to delete for children
        const r2KeysToDelete: string[] = [];
        for (const child of children) {
            await this.cleanupRevisions(child._id.toString());
            if (child.r2Key) {
                r2KeysToDelete.push(child.r2Key);
            }
        }

        // Batch delete children's R2 files
        if (r2KeysToDelete.length > 0) {
            try {
                await this.r2StorageService.deleteFiles(r2KeysToDelete);
            } catch (error) {
                this.logger.warn(`[R2] Failed to delete children files: ${error.message}`);
            }
        }

        // Clean up activities for all children in batch
        if (childIds.length > 0) {
            await this.cleanupActivitiesBatch(childIds);
        }

        // ── Deduct freed storage from owner's quota ──────────────────────────────
        // Collect all completed non-folder items: the session itself + its children.
        // Only files that have finished uploading occupy real storage quota.
        const allItems = [session, ...children];
        const storageByUser = new Map<string, number>();
        for (const item of allItems) {
            if (item.isFolder) continue; // folder sizes are derived sums — don't double-count
            const isComplete = (item.uploadedChunks?.length ?? 0) >= (item.totalChunks ?? 1);
            if (!isComplete || !item.fileSize) continue;

            const ownerObj = item.createdBy as any;
            const ownerId = ownerObj?._id?.toString() || ownerObj?.toString();
            if (!ownerId) continue;

            storageByUser.set(ownerId, (storageByUser.get(ownerId) ?? 0) + item.fileSize);
        }

        for (const [userId, bytes] of storageByUser) {
            try {
                await this.authService.updateStorageUsed(userId, -bytes);
                this.logger.log(`[Storage] Freed ${bytes} bytes for user ${userId} after deleting ${session.fileName}`);
            } catch (e) {
                this.logger.warn(`[Storage] Failed to update quota for user ${userId}: ${e.message}`);
            }
        }
        // ─────────────────────────────────────────────────────────────────────────

        await this.fileFolderRepository.deleteMany({
            parents: session._id
        });

        await this.fileFolderRepository.deleteOne(toObjectId(uploadId));
    }

    /**
     * Delete all revisions for a file from both database and R2
     */
    private async cleanupRevisions(fileId: string): Promise<void> {
        try {
            // Get all revisions for this file
            const revisions = await this.fileRevisionRepository.findByFileId(fileId);

            // Delete revision files from R2
            const r2Keys: string[] = [];
            for (const revision of revisions) {
                const revisionKey = this.r2StorageService.buildRevisionKey(revision.revisionFileName);
                r2Keys.push(revisionKey);
            }

            if (r2Keys.length > 0) {
                await this.r2StorageService.deleteFiles(r2Keys);
            }

            // Delete all revision records from database
            const deletedCount = await this.fileRevisionRepository.deleteAllRevisions(fileId);
            if (deletedCount > 0) {
                this.logger.log(`[UploadPoolService] Deleted ${deletedCount} revisions for file ${fileId}`);
            }
        } catch (error) {
            this.logger.error(`[UploadPoolService] Error cleaning up revisions for file ${fileId}:`, error);
            // Don't throw - continue with file deletion even if revision cleanup fails
        }
    }

    /**
     * Delete all activities related to a file/folder
     */
    private async cleanupActivities(fileId: string): Promise<void> {
        try {
            const deletedCount = await this.activityRepository.deleteByItemId(fileId);
            if (deletedCount > 0) {
                this.logger.log(`[UploadPoolService] Deleted ${deletedCount} activities for file ${fileId}`);
            }
        } catch (error) {
            this.logger.error(`[UploadPoolService] Error cleaning up activities for file ${fileId}:`, error);
        }
    }

    /**
     * Delete activities for multiple files/folders at once
     */
    private async cleanupActivitiesBatch(fileIds: string[]): Promise<void> {
        try {
            const deletedCount = await this.activityRepository.deleteByItemIds(fileIds);
            if (deletedCount > 0) {
                this.logger.log(`[UploadPoolService] Deleted ${deletedCount} activities for ${fileIds.length} files`);
            }
        } catch (error) {
            this.logger.error(`[UploadPoolService] Error cleaning up activities batch:`, error);
        }
    }

    async getAllUploads() {
        const allUploadSessions = await this.fileFolderRepository.findRootItems();
        return allUploadSessions.filter((session) =>
            session.uploadedChunks?.length === session.totalChunks
        );
    }

    async getAllUploadsForUser(userId: string) {
        const allUploadSessions = await this.fileFolderRepository.findRootItemsForUser(userId);
        return allUploadSessions.filter((session) =>
            session.uploadedChunks?.length === session.totalChunks
        );
    }

    async getAllUploadsUnderFolder(parentId: string) {
        // Find all files/folders where the direct parent (last element in parents array) matches parentId
        const allUploadSessions = await this.fileFolderRepository.findDirectChildren(parentId);

        return allUploadSessions.filter((session) =>
            session.uploadedChunks?.length === session.totalChunks
        );
    }

    async getAllUploadsUnderFolderForUser(parentId: string, userId: string) {
        const allUploadSessions = await this.fileFolderRepository.findDirectChildrenForUser(parentId, userId);

        return allUploadSessions.filter((session) =>
            session.uploadedChunks?.length === session.totalChunks
        );
    }

    // ──────────────────────────────────────────
    //  DIRECT R2 UPLOAD (no server proxy)
    // ──────────────────────────────────────────

    /**
     * Creates a DB record and returns a presigned R2 upload URL.
     * The client uploads directly to R2 using this URL.
     */
    async initiateDirectUpload(
        fileName: string,
        fileSize: number,
        contentType: string,
        parentId?: string,
        createdBy?: string,
    ): Promise<{ uploadId: string; presignedUrl: string; r2Key: string; expiresInSeconds: number }> {
        // 1. Check storage quota
        if (createdBy) {
            await this.authService.checkStorageQuota(createdBy, fileSize);
        }

        const uploadStatus = UploadEntity.builder();

        uploadStatus
            .setFileName(fileName)
            .setFileSize(fileSize)
            .setTotalChunks(1)
            .setUploadedChunks([])
            .setChunkSize(fileSize)
            .setLastActivity(new Date())
            .setIsFolder(false);

        if (createdBy) {
            uploadStatus.setCreatedBy(createdBy);
        }

        let fullParentLineage: Types.ObjectId[] = [];

        if (parentId && parentId.trim() !== '') {
            const parentFolder = await this.fileFolderRepository.findById(parentId);

            if (!parentFolder || !parentFolder.isFolder) {
                throw new NotFoundException('Parent folder not found');
            }

            if (parentFolder.parents && parentFolder.parents.length > 0) {
                fullParentLineage = [...parentFolder.parents, toObjectId(parentId)];
            } else {
                fullParentLineage = [toObjectId(parentId)];
            }

            // Update ancestor folder sizes
            for (const ancestorId of fullParentLineage) {
                const ancestorFolder = await this.fileFolderRepository.findById(ancestorId);
                if (ancestorFolder && ancestorFolder.isFolder) {
                    const ancestorBuilder = ancestorFolder.toBuilder();
                    ancestorBuilder.setFileSize(ancestorFolder.fileSize + fileSize);
                    await this.fileFolderRepository.update(ancestorFolder._id, ancestorBuilder.build());
                }
            }

            uploadStatus.setParents(fullParentLineage);
        } else {
            // Ensure parents is explicitly an empty array for root items
            uploadStatus.setParents([]);
        }

        await this.fileFolderRepository.checkDuplicate(fileName, fullParentLineage);

        const uploadId = new Types.ObjectId();
        const r2Key = this.r2StorageService.buildFileKey(uploadId.toString(), fileName);

        // IMPORTANT: Set the _id on the builder BEFORE calling build(), so the
        // DB document gets the same ID we used to build the r2Key. Without this,
        // build() generates a brand-new random ObjectId and the uploadId returned
        // to the client will never match the actual DB record.
        uploadStatus._id = uploadId;
        uploadStatus.setR2Key(r2Key);

        if (createdBy) {
            uploadStatus.setCreatedBy(createdBy);
        }

        const newUpload = await this.fileFolderRepository.create(uploadStatus.build());
        const actualUploadId = newUpload._id.toString();

        // Generate presigned PUT URL
        const expiresInSeconds = 900; // 15 minutes
        const presignedUrl = await this.r2StorageService.getPresignedUploadUrl(
            r2Key,
            contentType || 'application/octet-stream',
            expiresInSeconds,
        );

        this.logger.log(`[DirectUpload] Initiated for ${fileName} (${fileSize} bytes) → ${r2Key}. DB _id: ${actualUploadId}`);

        return { uploadId: actualUploadId, presignedUrl, r2Key, expiresInSeconds };
    }

    /**
     * Called after the client finishes uploading directly to R2.
     * Verifies the file exists in R2 and marks the upload as complete.
     */
    async confirmDirectUpload(uploadId: string): Promise<{ success: boolean; fileName: string; fileSize: number }> {
        const uploadSession = await this.fileFolderRepository.findById(uploadId);

        if (!uploadSession) {
            throw new NotFoundException('Upload session not found');
        }

        const r2Key = uploadSession.r2Key;
        if (!r2Key) {
            throw new BadRequestException('No R2 key found for this upload');
        }

        // Verify the file actually exists in R2 (non-fatal — R2 may have brief propagation delay)
        const exists = await this.r2StorageService.fileExists(r2Key);
        if (!exists) {
            this.logger.warn(`[DirectUpload] R2 HeadObject returned false for ${r2Key} — proceeding anyway (may be propagation delay)`);
        }

        // Get actual file size from R2 (fall back to declared size if not available)
        const metadata = await this.r2StorageService.getFileMetadata(r2Key);
        const actualSize = metadata?.size || uploadSession.fileSize;

        // Update user storage
        // Note: createdBy may be a populated User object (due to findById's .populate()),
        // so we need to extract the _id from it rather than calling .toString() directly.
        if (uploadSession.createdBy) {
            const createdByObj = uploadSession.createdBy as any;
            const userId = createdByObj?._id?.toString() || createdByObj?.toString();
            if (userId) {
                await this.authService.updateStorageUsed(userId, actualSize);
            }
        }

        // Mark as complete by setting only the fields that need to change.
        // We intentionally pass a minimal patch object – NOT the full built entity –
        // so that MongoDB never sees the immutable _id field or a populated createdBy
        // object inside the $set payload.
        const patch: Partial<UploadEntity> = {
            uploadedChunks: [0],
            fileSize: actualSize,
            totalChunks: 1,
            lastActivity: new Date(),
        } as any;

        const finalized = await this.fileFolderRepository.update(uploadSession._id, patch);

        this.logger.log(`[DirectUpload] Confirmed: ${uploadSession.fileName} (${actualSize} bytes). DB Updated: ${!!finalized}`);

        // Track activity
        try {
            const activity = {
                action: 'UPLOAD',
                details: `File ${uploadSession.fileName} uploaded via Direct R2`,
                itemId: uploadSession._id,
                itemName: uploadSession.fileName,
                timestamp: new Date(),
                userId: uploadSession.createdBy instanceof Types.ObjectId ? uploadSession.createdBy : undefined
            };
            // Depending on how activities are handled, we might need to builder it
            // For now, simple logging as I don't want to break if Activity entity is complex
            this.logger.debug(`[DirectUpload] Activity logged for ${uploadSession.fileName}`);
        } catch (e) {
            this.logger.warn(`[DirectUpload] Failed to log activity: ${e.message}`);
        }

        return {
            success: true,
            fileName: uploadSession.fileName,
            fileSize: actualSize,
        };
    }

    async deleteAllUploadedFiles(uploadIds: string[]) {
        await this.resetParentFolderSizes(uploadIds);

        // Collect all IDs to delete (including folder children) along with full item docs
        const allIdsToDelete = new Set<string>(uploadIds);
        const allItemsToCleanup: string[] = [...uploadIds];
        const allR2KeysToDelete: string[] = [];
        // Keep the full document for every item so we can calculate freed storage
        const allItemDocs: import('../entities/upload-status.entity').UploadDocument[] = [];

        // For each item, check if it's a folder and get all descendants
        for (const uploadId of uploadIds) {
            const item = await this.fileFolderRepository.findById(uploadId);
            if (!item) continue;
            allItemDocs.push(item);

            if (item.r2Key) {
                allR2KeysToDelete.push(item.r2Key);
            }
            if (item.isFolder) {
                const descendants = await this.fileFolderRepository.findDescendants(item._id);
                for (const descendant of descendants) {
                    const descendantId = descendant._id.toString();
                    if (!allIdsToDelete.has(descendantId)) {
                        allIdsToDelete.add(descendantId);
                        allItemsToCleanup.push(descendantId);
                        allItemDocs.push(descendant);
                    }
                    if (descendant.r2Key) {
                        allR2KeysToDelete.push(descendant.r2Key);
                    }
                }
            }
        }

        // ── Deduct freed storage from each owner's quota ─────────────────────────
        // Only completed, non-folder files occupy real storage quota.
        // Group by owner to handle multi-user bulk deletes correctly.
        const storageByUser = new Map<string, number>();
        for (const item of allItemDocs) {
            if (item.isFolder) continue;
            const isComplete = (item.uploadedChunks?.length ?? 0) >= (item.totalChunks ?? 1);
            if (!isComplete || !item.fileSize) continue;

            const ownerObj = item.createdBy as any;
            const ownerId = ownerObj?._id?.toString() || ownerObj?.toString();
            if (!ownerId) continue;

            storageByUser.set(ownerId, (storageByUser.get(ownerId) ?? 0) + item.fileSize);
        }

        for (const [userId, bytes] of storageByUser) {
            try {
                await this.authService.updateStorageUsed(userId, -bytes);
                this.logger.log(`[Storage] Freed ${bytes} bytes for user ${userId} (bulk delete of ${uploadIds.length} item(s))`);
            } catch (e) {
                this.logger.warn(`[Storage] Failed to update quota for user ${userId}: ${e.message}`);
            }
        }
        // ─────────────────────────────────────────────────────────────────────────

        // Delete all revisions for each file/folder
        for (const itemId of allItemsToCleanup) {
            await this.cleanupRevisions(itemId);
        }

        // Clean up all activities in batch for better performance
        await this.cleanupActivitiesBatch(allItemsToCleanup);

        // Delete all items from database
        await this.fileFolderRepository.deleteMany({
            _id: { $in: Array.from(allIdsToDelete).map((id) => toObjectId(id)) }
        });

        // Batch delete all R2 files
        if (allR2KeysToDelete.length > 0) {
            try {
                await this.r2StorageService.deleteFiles(allR2KeysToDelete);
            } catch (error) {
                this.logger.warn(`[R2] Failed to batch delete files: ${error.message}`);
            }
        }

        return {
            success: true,
            message: 'All uploads deleted',
        };
    }

    async resetParentFolderSizes(uploadIds: string[]) {
        for (const uploadId of uploadIds) {
            const currentlyDeletedFileOrFolder = await this.fileFolderRepository.findById(uploadId);

            if (currentlyDeletedFileOrFolder && currentlyDeletedFileOrFolder.parents && currentlyDeletedFileOrFolder.parents.length > 0) {
                for (const parent of currentlyDeletedFileOrFolder.parents) {
                    const parentFolder = await this.fileFolderRepository.findById(parent);
                    if (!parentFolder) continue;

                    const parentFolderBuilder = parentFolder.toBuilder();
                    parentFolderBuilder.setFileSize(Math.max(0, parentFolder.fileSize - currentlyDeletedFileOrFolder.fileSize));
                    await this.fileFolderRepository.update(parentFolder._id, parentFolderBuilder.build());
                }
            }
        }
    }

    async pauseCurrentChunkUpload(uploadId: string, currentChunk: number) {
        const session = await this.fileFolderRepository.findById(uploadId);

        if (!session) {
            throw new NotFoundException('Upload session not found');
        }

        // Note: R2 multipart upload parts cannot be individually deleted.
        // We just remove the chunk index from the tracking list so it will be re-uploaded on resume.

        let sessionBuilder = session.toBuilder();

        // Check if provided chunk is in the uploaded chunks list
        if (session.uploadedChunks?.includes(currentChunk)) {
            // Remove the chunk index
            const unique = session.uploadedChunks.filter(item => item !== currentChunk);
            sessionBuilder = sessionBuilder.setUploadedChunks(unique);
        }

        // Also remove the corresponding R2 part from tracking
        const partNumber = currentChunk + 1;
        let r2Parts = session.r2Parts || [];
        r2Parts = r2Parts.filter(p => p.PartNumber !== partNumber);
        sessionBuilder = sessionBuilder.setR2Parts(r2Parts);

        await this.fileFolderRepository.update(session._id, sessionBuilder.build());

        return {
            success: true,
            message: 'Upload paused successfully',
        };
    }

    async updateActivity(uploadId: string, userId: string) {
        await this.fileFolderRepository.updateActivity(uploadId, userId);
        return { success: true };
    }

    async getHistory(uploadId: string) {
        return await this.activityRepository.findRelatedActivities(uploadId);
    }

    async moveItem(id: string, newParentId: string | null, userId?: string) {
        const item = await this.fileFolderRepository.findById(id);
        if (!item) {
            throw new NotFoundException('Item not found');
        }

        const oldParents = item.parents || [];
        let newParents: Types.ObjectId[] = [];
        let destName = 'Home';
        let destId: Types.ObjectId | undefined = undefined;

        // Get old parent name for logging
        let oldParentName = 'Home';
        let oldParentId: Types.ObjectId | undefined = undefined;
        if (oldParents.length > 0) {
            const lastParentId = oldParents[oldParents.length - 1];
            const oldParent = await this.fileFolderRepository.findById(lastParentId);
            if (oldParent) {
                oldParentName = oldParent.fileName;
                oldParentId = oldParent._id;
            }
        }

        if (newParentId) {
            const destFolder = await this.fileFolderRepository.findById(newParentId);
            if (!destFolder) {
                throw new NotFoundException('Destination folder not found');
            }
            if (!destFolder.isFolder) {
                throw new BadRequestException('Destination must be a folder');
            }
            destName = destFolder.fileName;
            destId = destFolder._id;

            // Check if moving folder into itself or its descendants
            if (item.isFolder) {
                if (destFolder._id.toString() === item._id.toString() ||
                    destFolder.parents.some(p => p.toString() === item._id.toString())) {
                    throw new BadRequestException('Cannot move a folder into itself or its descendants');
                }
            }

            newParents = [...destFolder.parents, destFolder._id];
        }

        // Check for duplicate name in destination
        await this.fileFolderRepository.checkDuplicate(item.fileName, newParents);

        const totalSizeMoved = item.fileSize;

        // 1. Update the item itself
        const itemBuilder = item.toBuilder();
        itemBuilder.setParents(newParents);

        // Log activity in separate collection
        const activityBuilder = Activity.builder()
            .setAction('MOVE')
            .setDetails(`Moved from ${oldParentName} to ${destName}`)
            .setItemId(item._id)
            .setItemName(item.fileName)
            .setIsFolder(item.isFolder)
            .setTimestamp(new Date());

        if (oldParentId) activityBuilder.setFromId(oldParentId);
        if (oldParentName) activityBuilder.setFromName(oldParentName);
        if (destId) activityBuilder.setToId(destId);
        if (destName) activityBuilder.setToName(destName);
        if (userId) activityBuilder.setUserId(toObjectId(userId));

        await this.activityRepository.create(activityBuilder.build());

        await this.fileFolderRepository.update(item._id, itemBuilder.build());

        // 2. If it's a folder, update all descendants' lineage
        if (item.isFolder) {
            const descendants = await this.fileFolderRepository.findDescendants(item._id);
            for (const descendant of descendants) {
                const relativePath = descendant.parents.slice(oldParents.length + 1);
                const updatedDescendantParents = [...newParents, item._id, ...relativePath];

                const descBuilder = descendant.toBuilder();
                descBuilder.setParents(updatedDescendantParents);
                await this.fileFolderRepository.update(descendant._id, descBuilder.build());
            }
        }

        // 3. Update old ancestors' sizes
        for (const ancestorId of oldParents) {
            const ancestor = await this.fileFolderRepository.findById(ancestorId);
            if (ancestor) {
                const builder = ancestor.toBuilder();
                builder.setFileSize(Math.max(0, ancestor.fileSize - totalSizeMoved));
                await this.fileFolderRepository.update(ancestor._id, builder.build());
            }
        }

        // 4. Update new ancestors' sizes
        for (const ancestorId of newParents) {
            const ancestor = await this.fileFolderRepository.findById(ancestorId);
            if (ancestor) {
                const builder = ancestor.toBuilder();
                builder.setFileSize(ancestor.fileSize + totalSizeMoved);
                await this.fileFolderRepository.update(ancestor._id, builder.build());
            }
        }

        return { success: true };
    }
}