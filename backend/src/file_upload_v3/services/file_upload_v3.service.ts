/* eslint-disable prettier/prettier */
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { createWriteStream, existsSync, readFileSync, writeFileSync, unlinkSync, rmSync, mkdirSync } from 'fs';
import { join } from 'path'; 
import { FileFolderRepository } from '../repositories/file-folder.repository';
import { UploadDocument, UploadEntity } from '../entities/upload-status.entity'; 
import { toObjectId } from 'src/common/utils';
import { Types } from 'mongoose';
import { FileRevisionRepository } from '../../onlyoffice/repositories/file-revision.repository';

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

@Injectable()
export class UploadPoolService {
    private readonly uploadDir = join(process.cwd(), 'uploads');
    private readonly chunksDir = join(process.cwd(), 'uploads', 'chunks');
    private readonly metaDataDir = join(process.cwd(), 'uploads', 'meta');
    private readonly revisionsDir = join(process.cwd(), 'uploads', 'revisions');
    private readonly sessionTimeout = 24 * 60 * 60 * 1000; // 24 hours

    constructor(
        private readonly fileFolderRepository: FileFolderRepository,
        private readonly fileRevisionRepository: FileRevisionRepository,
    ) {}

    async initiateUpload(
        fileName: string, 
        fileSize: number, 
        totalChunks: number, 
        parent?: string[], 
        children?: string[], 
        fileHash?: string, 
        resourceType?: "dir" | "file"
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

        // Build proper parent lineage
        if (parent && parent.length > 0) {
            // Get the direct parent (last item in the array from frontend)
            const directParentId = parent[parent.length - 1];
            const parentFolder = await this.fileFolderRepository.findById(directParentId);
            
            if (!parentFolder || !parentFolder.isFolder) {
                throw new NotFoundException('Parent folder not found');
            }
            
            // Build the complete lineage: all parent's ancestors + the parent itself
            let fullParentLineage: Types.ObjectId[];
            if (parentFolder.parents && parentFolder.parents.length > 0) {
                fullParentLineage = [...parentFolder.parents, toObjectId(directParentId)];
            } else {
                fullParentLineage = [toObjectId(directParentId)];
            }
            
            // Update all ancestors' sizes
            for (const ancestorId of fullParentLineage) {
                const ancestorFolder = await this.fileFolderRepository.findById(ancestorId);
                if (!ancestorFolder || !ancestorFolder.isFolder) {
                    throw new NotFoundException('Ancestor folder not found');
                }
                
                const ancestorBuilder = ancestorFolder.toBuilder();
                ancestorBuilder.setFileSize(ancestorFolder.fileSize + fileSize);
                await this.fileFolderRepository.update(ancestorFolder._id, ancestorBuilder.build());
            }
            
            // Set the complete lineage in the upload entity
            // fullParentLineage = await this.fileFolderRepository.buildFullParentPath(toObjectId(directParentId));
            uploadStatus.setParents(fullParentLineage);
        }

        if (children) {
            uploadStatus.setChildren(children.map(c => toObjectId(c)));
        }
         
        let newUpload = await this.fileFolderRepository.create(uploadStatus.build());
        newUpload = await newUpload.save();

        const uploadChunkDir = join(this.chunksDir, newUpload._id.toString());
        if (!existsSync(uploadChunkDir)) {
            mkdirSync(uploadChunkDir, { recursive: true });
        }
        
        return newUpload._id.toString();
    }

    async createNewFolder(folderName: string, parentId?: string, folderSize?: number): Promise<UploadDocument> { 
        return await this.fileFolderRepository.createFolder(folderName, parentId, folderSize);
    }

    async uploadChunk(uploadId: string, chunkIndex: number, chunkBuffer: Buffer): Promise<void> {
        const uploadSession = await this.fileFolderRepository.findById(uploadId);

        if (!uploadSession) {
            throw new NotFoundException('Upload session not found');
        }

        if (chunkIndex < 0 || chunkIndex >= uploadSession.totalChunks) {
            throw new BadRequestException('Invalid chunk index');
        }

        // Save chunk to disk
        const chunkPath = join(this.chunksDir, uploadId, `chunk-${chunkIndex}`);
        writeFileSync(chunkPath, chunkBuffer);
        
        // Only add chunk if it doesn't already exist
        let newChunkList = uploadSession.uploadedChunks || [];
        if (!newChunkList.includes(chunkIndex)) {
            newChunkList = [...newChunkList, chunkIndex].sort((a, b) => a - b);
        }
        
        const updatedUploadSession = uploadSession.toBuilder()
            .setUploadedChunks(newChunkList)
            .setLastActivity(new Date())
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
        
        // Merge chunks
        const folderArray = session.fileName.split('/');
        if (folderArray.length > 1) {
            const folderPath = join(this.uploadDir, folderArray.slice(0, folderArray.length - 1).join('/'));
            if (!existsSync(folderPath)) {
                mkdirSync(folderPath, { recursive: true });
            }
        }
        
        const finalFilePath = join(this.uploadDir, session.fileName);
        const isExistingFile = existsSync(finalFilePath);

        if (isExistingFile) {
            unlinkSync(finalFilePath);
        }
        
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

        return finalFilePath;
    }

    async cancelUpload(uploadId: string) {
        const session = await this.fileFolderRepository.findById(uploadId);
        
        if (!session) {
            throw new NotFoundException('Upload session not found');
        }
        
        await this.resetParentFolderSizes([uploadId]);
        this.cleanupChunks(uploadId);
        
        // Delete all file revisions for this file
        await this.cleanupRevisions(uploadId);
        
        // Delete all children recursively (and their revisions)
        const children = await this.fileFolderRepository.findDescendants(session._id);
        for (const child of children) {
            await this.cleanupRevisions(child._id.toString());
        }
        
        await this.fileFolderRepository.deleteMany({
            parents: session._id
        });
        
        await this.fileFolderRepository.deleteOne(toObjectId(uploadId));
    }

    private cleanupChunks(uploadId: string): void {
        const uploadChunkDir = join(this.chunksDir, uploadId);
        if (existsSync(uploadChunkDir)) {
            rmSync(uploadChunkDir, { recursive: true, force: true });
        }
    }

    /**
     * Delete all revisions for a file from both database and disk
     */
    private async cleanupRevisions(fileId: string): Promise<void> {
        try {
            // Get all revisions for this file
            const revisions = await this.fileRevisionRepository.findByFileId(fileId);
            
            // Delete revision files from disk
            for (const revision of revisions) {
                const revisionPath = join(this.revisionsDir, revision.revisionFileName);
                if (existsSync(revisionPath)) {
                    unlinkSync(revisionPath);
                }
            }
            
            // Delete all revision records from database
            const deletedCount = await this.fileRevisionRepository.deleteAllRevisions(fileId);
            if (deletedCount > 0) {
                console.log(`[UploadPoolService] Deleted ${deletedCount} revisions for file ${fileId}`);
            }
        } catch (error) {
            console.error(`[UploadPoolService] Error cleaning up revisions for file ${fileId}:`, error);
            // Don't throw - continue with file deletion even if revision cleanup fails
        }
    }

    async getAllUploads() {
        const allUploadSessions = await this.fileFolderRepository.findRootItems();
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

    async deleteAllUploadedFiles(uploadIds: string[]) {
        await this.resetParentFolderSizes(uploadIds);
        
        // Delete all revisions for each file
        for (const uploadId of uploadIds) {
            await this.cleanupRevisions(uploadId);
        }
        
        await this.fileFolderRepository.deleteMany({_id:uploadIds?.map((id) => toObjectId(id))});
        
        // Remove everything in chunks dir
        const dir = join(this.chunksDir);
        if (existsSync(dir)) {
            rmSync(dir, { recursive: true, force: true });
        }

        if (existsSync(this.uploadDir)) {
            rmSync(this.uploadDir, { recursive: true, force: true });
        }
        
        return {
            success: true,
            message: 'All uploads cancelled',
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

        // Delete the chunk if it exists
        const chunkPath = join(this.chunksDir, uploadId, `chunk-${currentChunk}`);
        if (existsSync(chunkPath)) {
            unlinkSync(chunkPath);
        }
        
        let sessionBuilder = session.toBuilder();
        
        // Check if provided chunk is in the uploaded chunks list
        if (session.uploadedChunks?.includes(currentChunk)) {
            // Remove the chunk index
            const unique = session.uploadedChunks.filter(item => item !== currentChunk);
            sessionBuilder = sessionBuilder.setUploadedChunks(unique);
        }
        
        await this.fileFolderRepository.update(session._id, sessionBuilder.build());
        
        return {
            success: true,
            message: 'Upload paused successfully',
        };
    }
}