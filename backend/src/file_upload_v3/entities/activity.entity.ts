import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, SchemaTypes, Types } from 'mongoose';
import { User } from '../../auth/entities/user.entity';

export type ActivityDocument = Activity & Document;

@Schema({ timestamps: true })
export class Activity {
    @Prop({ type: String, required: true })
    action: string;

    @Prop({ type: String })
    details: string;

    @Prop({ type: SchemaTypes.ObjectId, ref: 'UploadEntity', required: true })
    itemId: Types.ObjectId;

    @Prop({ type: String })
    itemName: string;

    @Prop({ type: Boolean })
    isFolder: boolean;

    @Prop({ type: SchemaTypes.ObjectId, ref: 'UploadEntity' })
    fromId: Types.ObjectId;

    @Prop({ type: String })
    fromName: string;

    @Prop({ type: SchemaTypes.ObjectId, ref: 'UploadEntity' })
    toId: Types.ObjectId;

    @Prop({ type: String })
    toName: string;

    @Prop({ type: SchemaTypes.ObjectId, ref: 'User' })
    userId: Types.ObjectId;

    @Prop({ type: Date, default: Date.now })
    timestamp: Date;
}

export const ActivitySchema = SchemaFactory.createForClass(Activity);
