import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Share, ShareDocument, SharePermission } from '../entities/share.entity';

@Injectable()
export class ShareRepository {
    constructor(@InjectModel(Share.name) private readonly shareModel: Model<ShareDocument>) { }

    async create(share: Partial<Share>): Promise<ShareDocument> {
        return this.shareModel.create(share);
    }

    async findByItemAndUser(itemId: string, userId: string): Promise<ShareDocument | null> {
        return this.shareModel.findOne({
            itemId: new Types.ObjectId(itemId),
            sharedWithId: new Types.ObjectId(userId),
        });
    }

    async findSharesForItem(itemId: string): Promise<ShareDocument[]> {
        return this.shareModel
            .find({ itemId: new Types.ObjectId(itemId) })
            .populate('sharedWithId', 'firstName lastName email picture')
            .populate('ownerId', 'firstName lastName email picture');
    }

    async findSharedWithUser(userId: string): Promise<ShareDocument[]> {
        return this.shareModel
            .find({ sharedWithId: new Types.ObjectId(userId) })
            .populate('itemId')
            .populate('ownerId', 'firstName lastName email picture');
    }

    async findByOwner(ownerId: string): Promise<ShareDocument[]> {
        return this.shareModel
            .find({ ownerId: new Types.ObjectId(ownerId) })
            .populate('itemId')
            .populate('sharedWithId', 'firstName lastName email picture');
    }

    async updatePermissions(shareId: string, permissions: SharePermission[]): Promise<ShareDocument | null> {
        return this.shareModel.findByIdAndUpdate(
            shareId,
            { $set: { permissions } },
            { new: true },
        );
    }

    async deleteShare(shareId: string): Promise<void> {
        await this.shareModel.findByIdAndDelete(shareId);
    }

    async deleteSharesByItem(itemId: string): Promise<number> {
        const result = await this.shareModel.deleteMany({ itemId: new Types.ObjectId(itemId) });
        return result.deletedCount || 0;
    }

    async deleteSharesByItemIds(itemIds: string[]): Promise<number> {
        const result = await this.shareModel.deleteMany({
            itemId: { $in: itemIds.map(id => new Types.ObjectId(id)) },
        });
        return result.deletedCount || 0;
    }

    async hasPermission(itemId: string, userId: string, permission: SharePermission): Promise<boolean> {
        const share = await this.shareModel.findOne({
            itemId: new Types.ObjectId(itemId),
            sharedWithId: new Types.ObjectId(userId),
            permissions: permission,
        });
        return !!share;
    }

    async findByToken(token: string): Promise<ShareDocument | null> {
        return this.shareModel
            .findOne({ shareToken: token })
            .populate('itemId')
            .populate('ownerId', 'firstName lastName email picture');
    }
}
