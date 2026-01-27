/* eslint-disable prettier/prettier */
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type FileRevisionDocument = FileRevisionEntity & Document;

@Schema({ collection: 'file_revisions' })
export class FileRevisionEntity {
  @Prop({
    type: Types.ObjectId,
    default: () => new Types.ObjectId(),
  })
  public _id: Types.ObjectId;

  // Reference to the main file
  @Prop({ type: Types.ObjectId, required: true, index: true })
  public fileId: Types.ObjectId;

  // Version number (1, 2, 3, etc.)
  @Prop({ type: Number, required: true })
  public version: number;

  // File name on disk for this version (e.g., "document_v1.docx")
  @Prop({ type: String, required: true })
  public revisionFileName: string;

  // File size for this version
  @Prop({ type: Number, required: true })
  public fileSize: number;

  // User who saved this version
  @Prop({ type: String, default: 'Anonymous User' })
  public savedBy: string;

  @Prop({ type: String })
  public userId: string;

  // OnlyOffice document key for this version
  @Prop({ type: String })
  public documentKey: string;

  // Changes URL from OnlyOffice (for detailed history)
  @Prop({ type: String })
  public changesUrl: string;

  // Server version that created this revision
  @Prop({ type: String })
  public serverVersion: string;

  @Prop({ type: Date, default: () => new Date() })
  public createdAt: Date;

  // Optional: SHA256 hash of the document
  @Prop({ type: String })
  public documentHash: string;
}

export const FileRevisionSchema = SchemaFactory.createForClass(FileRevisionEntity);
FileRevisionSchema.index({ fileId: 1, version: -1 });
