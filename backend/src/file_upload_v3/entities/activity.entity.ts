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

    public static builder() {
        return new Activity.Builder();
    }

    public toBuilder() {
        const builder = Activity.builder();
        builder.action = this.action;
        builder.details = this.details;
        builder.itemId = this.itemId;
        builder.itemName = this.itemName;
        builder.isFolder = this.isFolder;
        builder.fromId = this.fromId;
        builder.fromName = this.fromName;
        builder.toId = this.toId;
        builder.toName = this.toName;
        builder.userId = this.userId;
        builder.timestamp = this.timestamp;
        return builder;
    }

    public static Builder = class {
        action: string;
        details: string;
        itemId: Types.ObjectId;
        itemName: string;
        isFolder: boolean;
        fromId: Types.ObjectId;
        fromName: string;
        toId: Types.ObjectId;
        toName: string;
        userId: Types.ObjectId;
        timestamp: Date;

        public setAction(value: string) {
            this.action = value;
            return this;
        }

        public setDetails(value: string) {
            this.details = value;
            return this;
        }

        public setItemId(value: Types.ObjectId) {
            this.itemId = value;
            return this;
        }

        public setItemName(value: string) {
            this.itemName = value;
            return this;
        }

        public setIsFolder(value: boolean) {
            this.isFolder = value;
            return this;
        }

        public setFromId(value: Types.ObjectId) {
            this.fromId = value;
            return this;
        }

        public setFromName(value: string) {
            this.fromName = value;
            return this;
        }

        public setToId(value: Types.ObjectId) {
            this.toId = value;
            return this;
        }

        public setToName(value: string) {
            this.toName = value;
            return this;
        }

        public setUserId(value: Types.ObjectId) {
            this.userId = value;
            return this;
        }

        public setTimestamp(value: Date) {
            this.timestamp = value;
            return this;
        }

        public build(): Activity {
            const e = new Activity();
            e.action = this.action;
            e.details = this.details;
            e.itemId = this.itemId;
            e.itemName = this.itemName;
            e.isFolder = this.isFolder;
            e.fromId = this.fromId;
            e.fromName = this.fromName;
            e.toId = this.toId;
            e.toName = this.toName;
            e.userId = this.userId;
            e.timestamp = this.timestamp || new Date();
            return e;
        }
    };
}

export const ActivitySchema = SchemaFactory.createForClass(Activity);
ActivitySchema.loadClass(Activity);
