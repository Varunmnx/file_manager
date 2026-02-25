import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ShareDocument = Share & Document;

export type SharePermission = 'view' | 'edit' | 'update' | 'download';

@Schema({ timestamps: true, collection: 'shares' })
export class Share {
    @Prop({ type: Types.ObjectId, default: () => new Types.ObjectId() })
    public _id: Types.ObjectId;

    /** The file or folder being shared */
    @Prop({ type: Types.ObjectId, required: true, ref: 'UploadEntity' })
    public itemId: Types.ObjectId;

    /** The user who owns the file and is sharing it */
    @Prop({ type: Types.ObjectId, required: true, ref: 'User' })
    public ownerId: Types.ObjectId;

    /** The user who is receiving access */
    @Prop({ type: Types.ObjectId, required: true, ref: 'User' })
    public sharedWithId: Types.ObjectId;

    /** Permissions granted: view, edit, update, download */
    @Prop({ type: [String], default: ['view'], enum: ['view', 'edit', 'update', 'download'] })
    public permissions: SharePermission[];

    /** Optional: share via link (token-based) */
    @Prop({ type: String, required: false })
    public shareToken?: string;

    @Prop({ type: Date })
    public expiresAt?: Date;
}

export const ShareSchema = SchemaFactory.createForClass(Share);

// Index for fast lookups
ShareSchema.index({ itemId: 1, sharedWithId: 1 }, { unique: true });
ShareSchema.index({ ownerId: 1 });
ShareSchema.index({ sharedWithId: 1 });
ShareSchema.index({ shareToken: 1 }, { sparse: true });

ShareSchema.loadClass(Share);
