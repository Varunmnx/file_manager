import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Activity, ActivityDocument } from '../entities/activity.entity';

@Injectable()
export class ActivityRepository {
    constructor(
        @InjectModel(Activity.name)
        private readonly activityModel: Model<ActivityDocument>,
    ) { }

    async create(data: Partial<Activity>): Promise<ActivityDocument> {
        const activity = new this.activityModel(data);
        return await activity.save();
    }

    async findByItemId(itemId: string | Types.ObjectId): Promise<ActivityDocument[]> {
        return await this.activityModel
            .find({ itemId: new Types.ObjectId(itemId.toString()) })
            .populate('userId', 'firstName lastName email picture')
            .sort({ timestamp: -1 })
            .exec();
    }

    async findByDestinationId(toId: string | Types.ObjectId): Promise<ActivityDocument[]> {
        return await this.activityModel
            .find({ toId: new Types.ObjectId(toId.toString()) })
            .populate('userId', 'firstName lastName email picture')
            .sort({ timestamp: -1 })
            .exec();
    }

    async findRelatedActivities(id: string | Types.ObjectId): Promise<ActivityDocument[]> {
        const objectId = new Types.ObjectId(id.toString());
        return await this.activityModel
            .find({
                $or: [
                    { itemId: objectId },
                    { toId: objectId }
                ]
            })
            .populate('userId', 'firstName lastName email picture')
            .sort({ timestamp: -1 })
            .exec();
    }

    /**
     * Delete all activities related to a specific item
     * This includes activities where the item is the subject (itemId)
     * or where the item is the source/destination (fromId, toId)
     */
    async deleteByItemId(itemId: string | Types.ObjectId): Promise<number> {
        const objectId = new Types.ObjectId(itemId.toString());
        const result = await this.activityModel.deleteMany({
            $or: [
                { itemId: objectId },
                { fromId: objectId },
                { toId: objectId }
            ]
        });
        return result.deletedCount;
    }

    /**
     * Delete activities for multiple items at once
     */
    async deleteByItemIds(itemIds: (string | Types.ObjectId)[]): Promise<number> {
        const objectIds = itemIds.map(id => new Types.ObjectId(id.toString()));
        const result = await this.activityModel.deleteMany({
            $or: [
                { itemId: { $in: objectIds } },
                { fromId: { $in: objectIds } },
                { toId: { $in: objectIds } }
            ]
        });
        return result.deletedCount;
    }
}

