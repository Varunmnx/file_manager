import { Controller, Post, Get, Put, Delete, Body, Param, Req, UseGuards } from '@nestjs/common';
import { ShareService, CreateShareDto, UpdateShareDto } from '../services/share.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@Controller('shares')
@UseGuards(JwtAuthGuard)
export class ShareController {
    constructor(private readonly shareService: ShareService) { }

    /** Share a file/folder with another user */
    @Post()
    async shareItem(
        @Req() req: { user: { _id: string } },
        @Body() dto: CreateShareDto,
    ) {
        return this.shareService.shareItem(req.user._id, dto);
    }

    /** Get all shares for a specific file/folder (owner only) */
    @Get('item/:itemId')
    async getSharesForItem(
        @Req() req: { user: { _id: string } },
        @Param('itemId') itemId: string,
    ) {
        return this.shareService.getSharesForItem(itemId, req.user._id);
    }

    /** Get files/folders shared WITH the current user */
    @Get('shared-with-me')
    async getSharedWithMe(@Req() req: { user: { _id: string } }) {
        return this.shareService.getSharedWithMe(req.user._id);
    }

    /** Get files/folders I have shared with others */
    @Get('my-shares')
    async getMyShares(@Req() req: { user: { _id: string } }) {
        return this.shareService.getMyShares(req.user._id);
    }

    /** Update permissions on an existing share */
    @Put(':shareId')
    async updatePermissions(
        @Req() req: { user: { _id: string } },
        @Param('shareId') shareId: string,
        @Body() dto: UpdateShareDto,
    ) {
        return this.shareService.updateSharePermissions(shareId, req.user._id, dto);
    }

    /** Revoke/delete a share */
    @Delete(':shareId')
    async revokeShare(
        @Req() req: { user: { _id: string } },
        @Param('shareId') shareId: string,
    ) {
        return this.shareService.revokeShare(shareId, req.user._id);
    }

    /** Check if the current user has a specific permission on an item */
    @Get('check/:itemId/:permission')
    async checkAccess(
        @Req() req: { user: { _id: string } },
        @Param('itemId') itemId: string,
        @Param('permission') permission: 'view' | 'edit' | 'update' | 'download',
    ) {
        const hasAccess = await this.shareService.checkAccess(itemId, req.user._id, permission);
        return { hasAccess };
    }
}
