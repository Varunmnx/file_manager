import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { EntityNames } from 'src/db/entity-names';

export type UploadDocument = UploadEntity & Document;

@Schema({ collection: 'uploads' })
export class UploadEntity {
  @Prop({
    type: Types.ObjectId,
    default: () => new Types.ObjectId(), // Function that generates new ID each time
  })
  public _id: Types.ObjectId;

  @Prop({ name: 'uploadId', required: true, unique: true })
  public uploadId: string;

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

  @Prop({ type: Date, name: 'createdAt', default: ()=>new Date() })
  public createdAt: Date;

  @Prop({ type: Date, name: 'lastActivity', default: ()=>new Date() })
  public lastActivity: Date;

  @Prop({ type: String, name: 'fileHash' })
  public fileHash: string;

  @Prop({ type: 'number', name: 'version', default: 0 })
  public version = 0;

  public static builder() {
    return new UploadEntity.Builder();
  }

  public toBuilder() {
    const builder = UploadEntity.builder();

    builder._id = this._id;
    builder.uploadId = this.uploadId;
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

    return builder;
  }

  public static Builder = class {
    _id: Types.ObjectId;
    uploadId: string;
    fileName: string;
    fileSize: number;
    totalChunks: number;
    uploadedChunks: number[];
    chunkSize: number;
    createdAt: Date;
    lastActivity: Date;
    version = 0;
    parents: Types.ObjectId[];
    children: Types.ObjectId[];
    isFolder: boolean;
    fileHash: string;

    public setUploadId(value: string) {
      this.uploadId = value;
      return this;
    }

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

    public build(): UploadEntity {
      const e = new UploadEntity();

      if (!this.createdAt) this.createdAt = new Date();
      if (!this._id) this._id = new Types.ObjectId();
      if (!this.uploadedChunks) this.uploadedChunks = [];

      this.lastActivity = new Date();

      e._id = this._id;
      e.uploadId = this.uploadId;
      e.fileName = this.fileName;
      e.fileSize = this.fileSize;
      e.totalChunks = this.totalChunks;
      e.uploadedChunks = this.uploadedChunks;
      e.chunkSize = this.chunkSize;
      e.createdAt = this.createdAt;
      e.lastActivity = this.lastActivity;
      e.version = this.version + 1;
      e.parents = this.parents;
      e.children = this.children;
      e.isFolder = this.isFolder;
      e.fileHash = this.fileHash;

      return e;
    }
  };
}

export const UploadSchema = SchemaFactory.createForClass(UploadEntity);
UploadSchema.loadClass(UploadEntity);
