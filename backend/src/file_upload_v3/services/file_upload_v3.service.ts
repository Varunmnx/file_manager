/* eslint-disable prettier/prettier */
// upload-pool.service.ts
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { createWriteStream, existsSync, readFileSync, writeFileSync, unlinkSync, readdirSync, rmSync, mkdirSync } from 'fs';
import { join } from 'path';
import { v4 as uuid } from 'uuid';
import { FileFolderRepository } from '../repositories/file-folder.repository';
import { UploadDocument, UploadEntity } from '../entities/upload-status.entity'; 
import { toObjectId } from 'src/common/utils';

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


@Injectable()
export class UploadPoolService {
    // private uploadSessions: Map<string, UploadSession> = new Map();
    private readonly uploadDir = join(process.cwd(), 'uploads');
    private readonly chunksDir = join(process.cwd(), 'uploads', 'chunks');
    private readonly metaDataDir = join(process.cwd(), 'uploads', 'meta');
    private readonly sessionTimeout = 24 * 60 * 60 * 1000; // 24 hours

    constructor(private readonly fileFolderRepository: FileFolderRepository) {

    }

    async initiateUpload(fileName: string, fileSize: number, totalChunks: number, parent?: string[], children?: string[], fileHash?: string, resourceType?: "dir" | "file"): Promise<string> {
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

        const uploadStatus = UploadEntity.builder()

        uploadStatus.setUploadId(uploadId)
            .setFileName(fileName)
            .setFileSize(fileSize)
            .setTotalChunks(totalChunks)
            .setUploadedChunks(session.uploadedChunks)
            .setChunkSize(session.chunkSize)
            .setLastActivity(session.lastActivity)
            .setIsFolder(session.resourceType == "dir")

        if (fileHash) {
            uploadStatus.setFileHash(fileHash)
        }

        if (parent) { 
            for(let i = 0; i < parent.length; i++) {
                const parentFolder = await this.fileFolderRepository.findById(parent[i])
                if(!parentFolder || !parentFolder?.isFolder) {
                    throw new NotFoundException('Parent folder not found');
                }
                // update parent folder size 
                const parentFolderBuilder = parentFolder.toBuilder() 
                parentFolderBuilder.setFileSize(parentFolder.fileSize + fileSize)
                await this.fileFolderRepository.update(parentFolder._id, parentFolderBuilder.build())
                if (parentFolder && parentFolder?.parents?.length > 0) {
                    for (let j = 0; j < parentFolder.parents.length; j++) {
                        const grandParent = await this.fileFolderRepository.findById(parentFolder.parents[j])
                        if(!grandParent || !grandParent?.isFolder) {
                            throw new NotFoundException('Parent folder not found');
                        }
                        // update the size of the grand parent
                        const grandParentBuilder = grandParent.toBuilder()
                        grandParentBuilder.setFileSize(grandParent.fileSize + fileSize)
                        await this.fileFolderRepository.update(grandParent._id, grandParentBuilder.build())
                    }
                }
            }
            uploadStatus.setParents(parent?.map(p => toObjectId(p)))
        }

        if (children) {
            uploadStatus.setChildren(children?.map(p => toObjectId(p)))
        }
         

        let newUpload = await this.fileFolderRepository.create(uploadStatus.build())

        newUpload = await newUpload.save() 

         const uploadChunkDir = join(this.chunksDir, uploadId);
            if (!existsSync(uploadChunkDir)) {
              mkdirSync(uploadChunkDir, { recursive: true });
            }
        
        return newUpload?.uploadId;

    }

    async createNewFolder(folderName:string, parentId?: string, folderSize?: number): Promise<UploadDocument> { 
        return await this.fileFolderRepository.createFolder(folderName, parentId, folderSize)
    }

async uploadChunk(uploadId: string, chunkIndex: number, chunkBuffer: Buffer): Promise<void> {
    const uploadSession = await this.fileFolderRepository.findFolderByUploadId(uploadId) 

    if (!uploadSession) {
        throw new NotFoundException('Upload session not found');
    }

    if (chunkIndex < 0 || chunkIndex >= uploadSession?.totalChunks) {
        throw new BadRequestException('Invalid chunk index');
    }

    // Save chunk to disk
    const chunkPath = join(this.chunksDir, uploadId, `chunk-${chunkIndex}`);
    writeFileSync(chunkPath, chunkBuffer);
    
    // **FIX: Only add chunk if it doesn't already exist**
    let newChunkList = uploadSession.uploadedChunks || [];
    if (!newChunkList.includes(chunkIndex)) {
        newChunkList = [...newChunkList, chunkIndex].sort((a, b) => a - b); // Keep sorted
    }
    
    const updatedUploadSession = uploadSession.toBuilder()
        .setUploadedChunks(newChunkList)
        .setLastActivity(new Date())
        .build()

    await this.fileFolderRepository.update(uploadSession._id, updatedUploadSession)
    
    if(newChunkList?.length == uploadSession.totalChunks){
        await this.completeUpload(uploadId)
    }
}

    async getUploadStatus(uploadId: string) {
        let uploadSession = await this.fileFolderRepository.findFolderByUploadId(uploadId)
        uploadSession = uploadSession?.toObject() as UploadDocument
        if(!uploadSession){
            throw new NotFoundException('Upload session not found');
        }
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return {
            ...uploadSession,
            progress: ((uploadSession?.uploadedChunks?.length ?? 0) / (uploadSession?.totalChunks ?? 0)) * 100,
            isComplete: uploadSession?.uploadedChunks?.length === uploadSession?.totalChunks
        }
    }

    async completeUpload(uploadId: string): Promise<string> {
        const session = await this.fileFolderRepository.findFolderByUploadId(uploadId)
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
        

        return finalFilePath;
    }

    async cancelUpload(uploadId: string) {
        const session = await this.fileFolderRepository.findFolderByUploadId(uploadId)
        if (!session) {
            throw new NotFoundException('Upload session not found');
        }
        await this.resetParentFolderSizes([uploadId])
        this.cleanupChunks(uploadId);
        await this.fileFolderRepository.deleteMany({
            parents: session._id
        })
        await this.fileFolderRepository.deleteOne(session._id)
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
                    const fileContentRaw = readFileSync(join(this.metaDataDir, `${file}`), "utf-8");
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

    async getAllUploads() {
        const allUploadSessions = await this.fileFolderRepository.find({})
        return allUploadSessions?.filter((session) => session.uploadedChunks?.length === session.totalChunks && session.parents.length === 0)
    }

    async getAllUploadsUnderFolder(parentId: string){
        const all = await this.fileFolderRepository.find({})
        console.log("all", all);
        const allUploadSessions = await this.fileFolderRepository.find({parents:parentId})
        return allUploadSessions?.filter((session) => session.uploadedChunks?.length === session.totalChunks)
    }

    async deleteAllUploadedFiles(uploadIds:string[]) {
        await this.resetParentFolderSizes(uploadIds)
        await this.fileFolderRepository.deleteMany({
            uploadId: { $in: uploadIds }
        })
        // remove every thing in chunks dir
        const dir = join(this.chunksDir);
        if (existsSync(dir)) {
            rmSync(dir, { recursive: true, force: true });
        }

        if(existsSync(this.uploadDir)){
            rmSync(this.uploadDir, { recursive: true, force: true });
        }   
        return {
            success: true,
            message: 'All uploads cancelled',
        };
    }


    async resetParentFolderSizes(uploadIds: string[]){
        for(const uploadId of uploadIds){
            const currentlyDeletedFileOrFolder = await this.fileFolderRepository.findFolderByUploadId(uploadId)
            if(currentlyDeletedFileOrFolder && currentlyDeletedFileOrFolder?.parents && currentlyDeletedFileOrFolder?.parents?.length > 0){
                 for(const parent of currentlyDeletedFileOrFolder.parents){
                    const parentFolder = await this.fileFolderRepository.findById(parent)
                    if(!parentFolder) continue
                    const parentFolderBuilder = parentFolder.toBuilder()
                    parentFolderBuilder.setFileSize(parentFolder.fileSize - currentlyDeletedFileOrFolder.fileSize)
                    await this.fileFolderRepository.update(parentFolder._id,parentFolderBuilder.build())
                 }
            }
        } 
    }

    async pauseCurrentChunkUpload(uploadId: string, currentChunk:number) {
        const session = await this.fileFolderRepository.findFolderByUploadId(uploadId)
        if (!session) {
            throw new NotFoundException('Upload session not found');
        }

        // delete the chunk fi exists 
        const chunkPath = join(this.chunksDir, uploadId, `chunk-${currentChunk}`);
        if(existsSync(chunkPath)){
            unlinkSync(chunkPath);
        }
        let sessionBuilder = session.toBuilder()
        // check if provided chunk is updated in db 
        if(session.uploadedChunks?.includes(currentChunk)){
            // remove duplicate chunk index
            const unique = session.uploadedChunks.filter((item, index) => (session.uploadedChunks.indexOf(item) === index) || item !== currentChunk);
            sessionBuilder = sessionBuilder.setUploadedChunks(unique)
        }
        
        await this.fileFolderRepository.update(session._id,sessionBuilder.build())
        return {
            success: true,
            message: 'Upload paused successfully',
        };
    }
}
