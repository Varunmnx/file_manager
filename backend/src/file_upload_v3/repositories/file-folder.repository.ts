/* eslint-disable prettier/prettier */
import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { EntityRepository } from '../../db/entity-repository';
import { UploadDocument, UploadEntity } from '../entities/upload-status.entity';
import { InjectModel } from '@nestjs/mongoose';
import { Model, MongooseError, QueryFilter, Types } from 'mongoose';
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

  async update(id: Types.ObjectId, updatedUploadSessionStatus: Partial<UploadEntity>): Promise<UploadDocument | null> {
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
        throw new NotFoundException(`Upload entity with id ${id.toString()} not found`);
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
        console.log("parent id", toObjectId(parentId));
        const parentFolder = await this.entityModel.findById(toObjectId(parentId));
        console.log("parent folder", parentFolder);
        if (!parentFolder) {
          throw new NotFoundException(`Parent folder with id ${parentId} not found`);
        }
        
        if (!parentFolder.isFolder) {
          throw new BadRequestException('Parent must be a folder');
        }
        
        // Build parents array - Include all ancestors PLUS the direct parent
        if (parentFolder.parents && parentFolder.parents.length > 0) {
          parents = [...parentFolder.parents, toObjectId(parentId)];
        } else {
          parents = [toObjectId(parentId)];
        }
        
        // Update parent folder size
        const parentFolderBuilder = parentFolder.toBuilder();
        parentFolderBuilder.setFileSize(parentFolder.fileSize + (folderSize ?? 0));
        await this.update(parentFolder._id, parentFolderBuilder.build());
        
        // Update all ancestor folder sizes
        if (parentFolder.parents && parentFolder.parents.length > 0) {
          for (const ancestorId of parentFolder.parents) {
            const ancestor = await this.findById(ancestorId.toString());
            if (ancestor && ancestor.isFolder) {
              const ancestorBuilder = ancestor.toBuilder();
              ancestorBuilder.setFileSize(ancestor.fileSize + (folderSize ?? 0));
              await this.update(ancestor._id, ancestorBuilder.build());
            }
          }
        }
      }
      
      // Check if folder with same name already exists in the same parent location
      const query: QueryFilter<UploadDocument> = {
        fileName: folderName.trim(),
        isFolder: true
      };
      
      // Check for exact parent match
      if (parents.length > 0) {
        // Find folders with the same direct parent (last element in parents array)
        const directParent = parents[parents.length - 1];
        query.$expr = {
          $and: [
            { $eq: [{ $size: "$parents" }, parents.length] },
            { $eq: [{ $arrayElemAt: ["$parents", -1] }, directParent] }
          ]
        };
      } else {
        // Root level folder
        query.parents = { $size: 0 };
      }

      const existingFolder = await this.entityModel.findOne(query);

      console.log("existing folder", existingFolder);
      if (existingFolder) {
        throw new ConflictException(`Folder "${folderName}" already exists in this location`);
      }
      
      // Create the folder
      console.log("payload", { 
        fileName: folderName.trim(), 
        uploadId: uuid(), 
        parents, 
        chunkSize: 0, 
        totalChunks: 0, 
        fileSize: folderSize ?? 0, 
        isFolder: true 
      });
      
      const newFolder = await this.entityModel.create({ 
        fileName: folderName.trim(), 
        uploadId: uuid(), 
        parents, 
        chunkSize: 0, 
        totalChunks: 0, 
        fileSize: folderSize ?? 0, 
        isFolder: true 
      });
      
      return newFolder;
      
    } catch (error) {
      if (error instanceof BadRequestException || 
          error instanceof NotFoundException || 
          error instanceof ConflictException) {
        throw error;
      }
      
      console.log(error);
      // Handle MongoDB duplicate key errors
      if (error.code === 11000) {
        throw new ConflictException('A folder with this name already exists in this location');
      }
      
      console.error('Error creating folder:', error);
      throw new Error('Could not create folder');
    }
  }
  
  // FIXED: Accept both string and Types.ObjectId
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

  async findDirectChildren(parentId: string | Types.ObjectId): Promise<UploadDocument[]> {
    try {
      if (!parentId) {
        throw new BadRequestException('Parent ID is required');
      }
      
      // Find documents where the last element of parents array equals parentId
      return await this.entityModel.find({
        $expr: {
          $eq: [{ $arrayElemAt: ["$parents", -1] }, toObjectId(parentId)]
        }
      });
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      console.error('Error finding direct children:', error);
      throw new Error('Could not find children');
    }
  }

  // Find root level items (no parents)
  async findRootItems(): Promise<UploadDocument[]> {
    try {
      return await this.entityModel.find({
        parents: { $size: 0 }
      });
    } catch (error) {
      console.error('Error finding root items:', error);
      throw new Error('Could not find root items');
    }
  }
}