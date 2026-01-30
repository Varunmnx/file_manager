import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types, SchemaTypes } from 'mongoose';
import { EntityNames } from 'src/db/entity-names';
import { User } from 'src/auth/entities/user.entity';

export type UploadDocument = UploadEntity & Document;

@Schema({ collection: 'uploads' })
export class UploadEntity {
  @Prop({
    type: Types.ObjectId,
    default: () => new Types.ObjectId(), // Function that generates new ID each time
  })
  public _id: Types.ObjectId;

  @Prop({ name: 'isFolder', required: false, default: false })
  public isFolder: boolean;

  @Prop({
    name: 'parents',
    required: false,
    type: [{ type: Types.ObjectId, ref: EntityNames.FileOrFolderUploadStatus }],
  })
  public parents: Types.ObjectId[];

  @Prop({
    name: 'children',
    required: false,
    type: [{ type: Types.ObjectId, ref: EntityNames.FileOrFolderUploadStatus }],
  })
  public children: Types.ObjectId[];

  @Prop({ name: 'fileName', required: true })
  public fileName: string;

  @Prop({ name: 'fileSize', required: true })
  public fileSize: number;

  @Prop({ name: 'totalChunks', required: true })
  public totalChunks: number;

  @Prop({ type: [Number], name: 'uploadedChunks', default: [] })
  public uploadedChunks: number[];

  @Prop({ name: 'chunkSize', required: true })
  public chunkSize: number;

  @Prop({ type: Date, name: 'createdAt', default: () => new Date() })
  public createdAt: Date;

  @Prop({ type: Date, name: 'lastActivity', default: () => new Date() })
  public lastActivity: Date;

  @Prop({ type: String, name: 'fileHash' })
  public fileHash: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: false })
  public createdBy: User | Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: false })
  public lastViewedBy: User | Types.ObjectId;

  @Prop({ type: Date })
  public lastViewedAt: Date;

  @Prop({ type: String, required: false })
  public thumbnail: string;

  @Prop({ type: 'number', name: 'version', default: 1 })
  public version = 1;

  @Prop({
    type: [{
      action: String,
      details: String,
      fromId: { type: SchemaTypes.ObjectId, ref: 'User', required: false },
      fromName: String,
      toId: { type: SchemaTypes.ObjectId, ref: 'User', required: false },
      toName: String,
      timestamp: { type: Date, default: () => new Date() },
      userId: { type: SchemaTypes.ObjectId, ref: 'User', required: false }
    }],
    default: []
  })
  public activities: Array<{
    action: string;
    details: string;
    fromId?: Types.ObjectId;
    fromName?: string;
    toId?: Types.ObjectId;
    toName?: string;
    timestamp: Date;
    userId?: Types.ObjectId
  }>;

  public static builder() {
    return new UploadEntity.Builder();
  }

  public toBuilder() {
    const builder = UploadEntity.builder();

    builder._id = this._id;
    builder.fileName = this.fileName;
    builder.fileSize = this.fileSize;
    builder.totalChunks = this.totalChunks;
    builder.uploadedChunks = this.uploadedChunks;
    builder.chunkSize = this.chunkSize;
    builder.createdAt = this.createdAt;
    builder.lastActivity = this.lastActivity;
    builder.version = this.version;
    builder.parents = this.parents;
    builder.children = this.children;
    builder.isFolder = this.isFolder;
    builder.fileHash = this.fileHash;
    builder.createdBy = this.createdBy;
    builder.lastViewedBy = this.lastViewedBy;
    builder.lastViewedAt = this.lastViewedAt;
    builder.thumbnail = this.thumbnail;
    builder.activities = this.activities;

    return builder;
  }

  public static Builder = class {
    _id: Types.ObjectId;
    fileName: string;
    fileSize: number;
    totalChunks: number;
    uploadedChunks: number[];
    chunkSize: number;
    createdAt: Date;
    lastActivity: Date;
    version = 1;
    parents: Types.ObjectId[];
    children: Types.ObjectId[];
    isFolder: boolean;
    fileHash: string;
    createdBy: User | Types.ObjectId;
    lastViewedBy: User | Types.ObjectId;
    lastViewedAt: Date;
    thumbnail: string;
    activities: Array<{
      action: string;
      details: string;
      fromId?: Types.ObjectId;
      fromName?: string;
      toId?: Types.ObjectId;
      toName?: string;
      timestamp: Date;
      userId?: Types.ObjectId
    }>;

    public setFileName(value: string) {
      this.fileName = value;
      return this;
    }

    public setFileSize(value: number) {
      this.fileSize = value;
      return this;
    }

    public setTotalChunks(value: number) {
      this.totalChunks = value;
      return this;
    }

    public setUploadedChunks(value: number[]) {
      this.uploadedChunks = value;
      return this;
    }

    public setChunkSize(value: number) {
      this.chunkSize = value;
      return this;
    }

    public setCreatedAt(value: Date) {
      this.createdAt = value;
      return this;
    }

    public setLastActivity(value: Date) {
      this.lastActivity = value;
      return this;
    }

    public setLastViewedBy(value: User | Types.ObjectId) {
      this.lastViewedBy = value;
      return this;
    }

    public setLastViewedAt(value: Date) {
      this.lastViewedAt = value;
      return this;
    }

    public setThumbnail(value: string) {
      this.thumbnail = value;
      return this;
    }

    public setActivities(value: Array<{
      action: string;
      details: string;
      fromId?: Types.ObjectId;
      fromName?: string;
      toId?: Types.ObjectId;
      toName?: string;
      timestamp: Date;
      userId?: Types.ObjectId
    }>) {
      this.activities = value;
      return this;
    }

    public setParents(value: Types.ObjectId[]) {
      this.parents = value;
      return this;
    }


    public setChildren(value: Types.ObjectId[]) {
      this.children = value;
      return this;
    }

    public setIsFolder(value: boolean) {
      this.isFolder = value;
      return this;
    }

    public setFileHash(value: string) {
      this.fileHash = value;
      return this;
    }

    public setCreatedBy(value: User | Types.ObjectId | string) {
      if (typeof value === 'string') {
        this.createdBy = new Types.ObjectId(value);
      } else {
        this.createdBy = value;
      }
      return this;
    }

    public build(): UploadEntity {
      const e = new UploadEntity();

      if (!this.createdAt) this.createdAt = new Date();
      if (!this._id) this._id = new Types.ObjectId();
      if (!this.uploadedChunks) this.uploadedChunks = [];

      this.lastActivity = new Date();

      e._id = this._id;
      e.fileName = this.fileName;
      e.fileSize = this.fileSize;
      e.totalChunks = this.totalChunks;
      e.uploadedChunks = this.uploadedChunks;
      e.chunkSize = this.chunkSize;
      e.createdAt = this.createdAt;
      e.lastActivity = this.lastActivity;
      e.version = this.version || 1;
      e.parents = this.parents;
      e.children = this.children;
      e.isFolder = this.isFolder;
      e.fileHash = this.fileHash;
      e.createdBy = this.createdBy;
      e.lastViewedBy = this.lastViewedBy;
      e.lastViewedAt = this.lastViewedAt;
      e.thumbnail = this.thumbnail;
      e.activities = this.activities;

      return e;
    }
  };
}

export const UploadSchema = SchemaFactory.createForClass(UploadEntity);
UploadSchema.loadClass(UploadEntity);
