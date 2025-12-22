/* eslint-disable prettier/prettier */
import { Injectable } from '@nestjs/common';
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
    return await this.entityModel.findOne({ uploadId: uploadId });
  }

  async update(id: Types.ObjectId | string, updatedUploadSessionStatus: Partial<UploadEntity>): Promise<UploadDocument | null> {
    try {
      if (!id || !updatedUploadSessionStatus) {
        throw new Error('Invalid input parameters');
      }
      return await this.entityModel.findByIdAndUpdate(toObjectId(id), updatedUploadSessionStatus, { new: true });
    } catch (error) {
      console.error('Error updating AI Agent:', error);
      throw new Error('Could not update AI Agent');
    }
  }

  async createFolder(folderName: string, parentId?: string, folderSize?: number): Promise<UploadDocument> {
    let parentFolder:UploadDocument|null = null
    let parents: Types.ObjectId[] = []
    if(parentId){
      parentFolder = await this.entityModel.findById(parentId)
      console.log("parentfolder",parentFolder)
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
     if(parentFolder && parentFolder?.parents?.length > 0){
        parents = [...parentFolder.parents, toObjectId(parentId)]
     }else {
        parents = [toObjectId(parentId)]
     }
    }
    const newFolder = new this.entityModel({ fileName:folderName, uploadId: uuid(), parents, chunkSize: 0, totalChunks: 0, fileSize: folderSize ?? 0, isFolder: true }); 
    return await newFolder.save();
  }
}
