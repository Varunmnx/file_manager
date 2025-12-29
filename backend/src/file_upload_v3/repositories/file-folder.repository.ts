/* eslint-disable prettier/prettier */
import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { EntityRepository } from '../../db/entity-repository';
import { UploadDocument, UploadEntity } from '../entities/upload-status.entity';
import { InjectModel } from '@nestjs/mongoose';
import { Model, QueryFilter, Types } from 'mongoose';
import { toObjectId } from 'src/common/utils'; 


@Injectable()
export class FileFolderRepository extends EntityRepository<UploadDocument> {
  constructor(@InjectModel(UploadEntity.name) uploadEntity: Model<UploadDocument>) {
    super(uploadEntity);
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

   async buildFullParentPath(folderId: Types.ObjectId): Promise<Types.ObjectId[]> {
  const folder = await this.entityModel.findById(folderId);
  if (!folder || !folder.isFolder) {
    return []; // Should not happen if validated earlier
  }

  // Base case: root folder (no parents or empty)
  if (!folder.parents || folder.parents.length === 0) {
    return [folderId];
  }

  // Get direct parent: last item in parents array (by convention)
  const directParentId = folder.parents[folder.parents.length - 1];

  // Recursively get full path to direct parent
  const parentPath = await this.buildFullParentPath(directParentId);

  // Append current folder ID only if not already included (avoid cycles)
  if (!parentPath.includes(folderId)) {
    return [...parentPath, folderId];
  }

  // Safety: avoid infinite recursion due to data corruption
  console.warn(`Cycle detected in folder ancestry for ID: ${folderId.toString()}`);
  return parentPath;
}

async createFolder(folderName: string, parentId?: string, folderSize?: number): Promise<UploadDocument> {
  try {
    if (!folderName || folderName.trim() === '') {
      throw new BadRequestException('Folder name is required');
    }

    let parents: Types.ObjectId[] = [];

    if (parentId) {
      const parentIdObj = toObjectId(parentId);
      const parentFolder = await this.entityModel.findById(parentIdObj);

      if (!parentFolder) {
        throw new NotFoundException(`Parent folder with id ${parentId} not found`);
      }

      if (!parentFolder.isFolder) {
        throw new BadRequestException('Parent must be a folder');
      }

      // ✅ Recursively build full ancestor path
      parents = await this.buildFullParentPath(parentIdObj);

      // ✅ Update all ancestors (including direct parent) with new folder size
      for (const ancestorId of parents) {
        const ancestor = await this.findById(ancestorId);
        if (ancestor && ancestor.isFolder) {
          const builder = ancestor.toBuilder();
          builder.setFileSize(ancestor.fileSize + (folderSize ?? 0));
          await this.update(ancestor._id, builder.build());
        }
      }
    }

    // ✅ Prevent duplicate folder names in same parent context
    const query: QueryFilter<UploadDocument> = {
      fileName: folderName.trim(),
      isFolder: true,
    };

    if (parents.length > 0) {
      // Match exact parents array (full path)
      query.parents = parents;
    } else {
      query.$or = [
        { parents: { $exists: false } },
        { parents: { $size: 0 } },
        { parents: [] }
      ];
    }

    const existingFolder = await this.entityModel.findOne(query);
    if (existingFolder) {
      throw new ConflictException(`Folder "${folderName}" already exists in this location`);
    }

    const newFolder = await this.entityModel.create({
      fileName: folderName.trim(),
      parents,
      chunkSize: 0,
      totalChunks: 0,
      fileSize: folderSize ?? 0,
      isFolder: true,
    });

    return newFolder;
  } catch (error) {
    if (
      error instanceof BadRequestException ||
      error instanceof NotFoundException ||
      error instanceof ConflictException
    ) {
      throw error;
    }

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
        throw new NotFoundException(`Document with id ${id.toString()} not found`);
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