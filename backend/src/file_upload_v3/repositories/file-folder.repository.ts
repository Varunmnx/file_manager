/* eslint-disable prettier/prettier */
import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { EntityRepository } from '../../db/entity-repository';
import { UploadDocument, UploadEntity } from '../entities/upload-status.entity';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { toObjectId } from 'src/common/utils';
import { v4 as uuid } from 'uuid';


@Injectable()
export class FileFolderRepository extends EntityRepository<UploadDocument> {
  constructor(@InjectModel(UploadEntity.name) uploadEntity: Model<UploadDocument>) {
    super(uploadEntity);
  }

  async findFolderByUploadId(uploadId: string): Promise<UploadDocument | null> {
    try {
      if (!uploadId) {
        throw new BadRequestException('Upload ID is required');
      }
      return await this.entityModel.findOne({ uploadId });
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      console.error('Error finding folder by uploadId:', error);
      throw new Error('Could not find folder');
    }
  }

  async update(id: Types.ObjectId | string, updatedUploadSessionStatus: Partial<UploadEntity>): Promise<UploadDocument | null> {
    try {
      if (!id || !updatedUploadSessionStatus) {
        throw new BadRequestException('Invalid input parameters');
      }
      
      console.log("updated", updatedUploadSessionStatus);
      
      const updated = await this.entityModel.findByIdAndUpdate(
        toObjectId(id), 
        updatedUploadSessionStatus, 
        { new: true, runValidators: true }
      );
      
      if (!updated) {
        throw new NotFoundException(`Upload entity with id ${id} not found`);
      }
      
      return updated;
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      console.error('Error updating upload entity:', error);
      throw new Error('Could not update upload entity');
    }
  }

  async createFolder(folderName: string, parentId?: string, folderSize?: number): Promise<UploadDocument> {
    try {
      if (!folderName || folderName.trim() === '') {
        throw new BadRequestException('Folder name is required');
      }

      let parents: Types.ObjectId[] = [];
      
      // Handle parent folder logic
      if (parentId) {
        const parentFolder = await this.entityModel.findById(toObjectId(parentId));
        
        if (!parentFolder) {
          throw new NotFoundException(`Parent folder with id ${parentId} not found`);
        }
        
        if (!parentFolder.isFolder) {
          throw new BadRequestException('Parent must be a folder');
        }
        
        // Build parents array
        if (parentFolder.parents && parentFolder.parents.length > 0) {
          parents = [...parentFolder.parents, toObjectId(parentId)];
        } else {
          parents = [toObjectId(parentId)];
        }
      }
      
      // Check if folder with same name already exists in the same parent
      const existingFolder = await this.entityModel.findOne({
        fileName: folderName,
        parents: parents.length > 0 ? { $size: parents.length, $all: parents } : { $size: 0 },
        isFolder: true
      });

      
      if (existingFolder) {
        const isAllParentsSame = existingFolder.parents.every(parent => parents.includes(parent));
        
        if (isAllParentsSame) {
          throw new ConflictException(`Folder "${folderName}" already exists in this location`);
        } 
      }
      
      // Create the folder - .create() already saves, so no need for .save()
      const newFolder = await this.entityModel.create({ 
        fileName: folderName.trim(), 
        uploadId: uuid(), 
        parents, 
        chunkSize: 0, 
        totalChunks: 0, 
        fileSize: folderSize ?? 0, 
        isFolder: true 
      });
      
      return newFolder; // REMOVED .save() - this was causing the duplicate error
      
    } catch (error) {
      if (error instanceof BadRequestException || 
          error instanceof NotFoundException || 
          error instanceof ConflictException) {
        throw error;
      }
      
      // Handle MongoDB duplicate key errors
      if (error.code === 11000) {
        throw new ConflictException('A folder with this name already exists in this location');
      }
      
      console.error('Error creating folder:', error);
      throw new Error('Could not create folder');
    }
  }
  
  async findById(id: Types.ObjectId | string): Promise<UploadDocument | null> {
    try {
      if (!id) {
        throw new BadRequestException('ID is required');
      }
      
      const document = await this.entityModel.findById(toObjectId(id));
      
      if (!document) {
        throw new NotFoundException(`Document with id ${id} not found`);
      }
      
      return document;
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      console.error('Error finding document by id:', error);
      throw new Error('Could not find document');
    }
  }
}