import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { ShareRepository } from '../repositories/share.repository';
import { SharePermission } from '../entities/share.entity';
import { FileFolderRepository } from '../../file_upload_v3/repositories/file-folder.repository';
import { UsersService } from '../../auth/service/auth.service';
import { Types } from 'mongoose';
import * as crypto from 'crypto';

export interface CreateShareDto {
    itemId: string;
    sharedWithEmail: string;
    permissions: SharePermission[];
}

export interface UpdateShareDto {
    permissions: SharePermission[];
}

function extractOwnerId(createdBy: any): string | undefined {
    if (!createdBy) return undefined;
    if (createdBy instanceof Types.ObjectId) return createdBy.toString();
    if (typeof createdBy === 'string') return createdBy;
    if (createdBy._id) return createdBy._id.toString();
    return undefined;
}

@Injectable()
export class ShareService {
    constructor(
        private readonly shareRepository: ShareRepository,
        private readonly fileFolderRepository: FileFolderRepository,
        private readonly usersService: UsersService,
    ) { }

    async shareItem(ownerId: string, dto: CreateShareDto) {
        // Validate item exists and belongs to the owner
        const item = await this.fileFolderRepository.findById(dto.itemId);
        if (!item) throw new NotFoundException('File or folder not found');

        const itemOwnerId = extractOwnerId(item.createdBy);
        if (itemOwnerId !== ownerId) {
            throw new ForbiddenException('You can only share your own files');
        }

        // Find the target user
        const targetUser = await this.usersService.findByEmail(dto.sharedWithEmail);
        if (!targetUser) throw new NotFoundException('User not found');

        if (targetUser._id.toString() === ownerId) {
            throw new BadRequestException('You cannot share with yourself');
        }

        // Check if already shared
        const existing = await this.shareRepository.findByItemAndUser(dto.itemId, targetUser._id.toString());
        if (existing) {
            // Update permissions instead
            return this.shareRepository.updatePermissions(existing._id.toString(), dto.permissions);
        }

        // Validate permissions
        const validPermissions: SharePermission[] = ['view', 'edit', 'update', 'download'];
        for (const perm of dto.permissions) {
            if (!validPermissions.includes(perm)) {
                throw new BadRequestException(`Invalid permission: ${perm}`);
            }
        }

        return this.shareRepository.create({
            itemId: item._id,
            ownerId: new Types.ObjectId(ownerId),
            sharedWithId: targetUser._id,
            permissions: dto.permissions,
        });
    }

    async getSharesForItem(itemId: string, userId: string) {
        const item = await this.fileFolderRepository.findById(itemId);
        if (!item) throw new NotFoundException('Item not found');

        const itemOwnerId = extractOwnerId(item.createdBy);
        if (itemOwnerId !== userId) {
            throw new ForbiddenException('Only the owner can view share settings');
        }

        return this.shareRepository.findSharesForItem(itemId);
    }

    async getSharedWithMe(userId: string) {
        return this.shareRepository.findSharedWithUser(userId);
    }

    async getMyShares(userId: string) {
        return this.shareRepository.findByOwner(userId);
    }

    async updateSharePermissions(shareId: string, userId: string, dto: UpdateShareDto) {
        return this.shareRepository.updatePermissions(shareId, dto.permissions);
    }

    async revokeShare(shareId: string, userId: string) {
        return this.shareRepository.deleteShare(shareId);
    }

    async checkAccess(itemId: string, userId: string, permission: SharePermission): Promise<boolean> {
        // First, check if this user is the owner
        const item = await this.fileFolderRepository.findById(itemId);
        if (!item) return false;

        const itemOwnerId = extractOwnerId(item.createdBy);
        if (itemOwnerId === userId) return true; // Owner has all permissions

        // Check shares
        return this.shareRepository.hasPermission(itemId, userId, permission);
    }

    async generateShareLink(itemId: string, ownerId: string, permissions: SharePermission[]) {
        const item = await this.fileFolderRepository.findById(itemId);
        if (!item) throw new NotFoundException('Item not found');

        const itemOwnerId = extractOwnerId(item.createdBy);
        if (itemOwnerId !== ownerId) {
            throw new ForbiddenException('Only the owner can generate share links');
        }

        const shareToken = crypto.randomBytes(32).toString('hex');

        await this.shareRepository.create({
            itemId: item._id,
            ownerId: new Types.ObjectId(ownerId),
            permissions,
            shareToken,
        });

        return { shareToken };
    }
}
