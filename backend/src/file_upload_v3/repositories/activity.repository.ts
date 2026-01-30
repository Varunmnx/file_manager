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
}
