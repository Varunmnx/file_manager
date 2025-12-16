/* eslint-disable prettier/prettier */
import { Injectable } from '@nestjs/common';
import { EntityRepository } from '../../db/entity-repository';
import { UploadDocument, UploadEntity } from '../entities/upload-status.entity';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { toObjectId } from 'src/common/utils';

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
}
