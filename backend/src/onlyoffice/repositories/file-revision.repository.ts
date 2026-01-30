/* eslint-disable prettier/prettier */
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { FileRevisionEntity, FileRevisionDocument } from '../entities/file-revision.entity';

@Injectable()
export class FileRevisionRepository {
  constructor(
    @InjectModel(FileRevisionEntity.name)
    private readonly revisionModel: Model<FileRevisionDocument>,
  ) {}

  async create(revision: Partial<FileRevisionEntity>): Promise<FileRevisionDocument> {
    return await this.revisionModel.create(revision);
  }

  async findByFileId(fileId: string | Types.ObjectId): Promise<FileRevisionDocument[]> {
    const objectId = typeof fileId === 'string' ? new Types.ObjectId(fileId) : fileId;
    return await this.revisionModel
      .find({ fileId: objectId })
      .sort({ version: -1 })
      .exec();
  }

  async findLatestRevision(fileId: string | Types.ObjectId): Promise<FileRevisionDocument | null> {
    const objectId = typeof fileId === 'string' ? new Types.ObjectId(fileId) : fileId;
    return await this.revisionModel
      .findOne({ fileId: objectId })
      .sort({ version: -1 })
      .exec();
  }

  async findByVersion(fileId: string | Types.ObjectId, version: number): Promise<FileRevisionDocument | null> {
    const objectId = typeof fileId === 'string' ? new Types.ObjectId(fileId) : fileId;
    return await this.revisionModel
      .findOne({ fileId: objectId, version })
      .exec();
  }

  async findById(id: string | Types.ObjectId): Promise<FileRevisionDocument | null> {
    const objectId = typeof id === 'string' ? new Types.ObjectId(id) : id;
    return this.revisionModel.findById(objectId).exec();
  }

  async getNextVersion(fileId: string | Types.ObjectId): Promise<number> {
    const latest = await this.findLatestRevision(fileId);
    return latest ? latest.version + 1 : 1;
  }

  async deleteRevision(revisionId: string | Types.ObjectId): Promise<boolean> {
    const objectId = typeof revisionId === 'string' ? new Types.ObjectId(revisionId) : revisionId;
    const result = await this.revisionModel.deleteOne({ _id: objectId });
    return result.deletedCount > 0;
  }

  async deleteAllRevisions(fileId: string | Types.ObjectId): Promise<number> {
    const objectId = typeof fileId === 'string' ? new Types.ObjectId(fileId) : fileId;
    const result = await this.revisionModel.deleteMany({ fileId: objectId });
    return result.deletedCount;
  }
}
