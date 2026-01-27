/* eslint-disable prettier/prettier */
import {
  Controller,
  Get,
  Post,
  Param,
  Headers,
  Body,
  Res,
  Req,
  HttpStatus,
  UseGuards,
  StreamableFile,
} from '@nestjs/common';
import { Response } from 'express';
import { WopiService } from './wopi.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

@Controller('wopi')
export class WopiController {
  constructor(private readonly wopiService: WopiService) {}

  // CheckFileInfo - Returns file metadata
  @Get('files/:fileId')
  async checkFileInfo(@Param('fileId') fileId: string) {
    const fileInfo = await this.wopiService.getFileInfo(fileId);
    return fileInfo;
  }

  // GetFile - Returns file contents
  @Get('files/:fileId/contents')
  async getFile(
    @Param('fileId') fileId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const fileContents = await this.wopiService.getFileContents(fileId);
    const fileInfo = await this.wopiService.getFileInfo(fileId);

    res.set({
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${fileInfo.BaseFileName}"`,
      'Content-Length': fileContents.length.toString(),
    });

    return new StreamableFile(fileContents);
  }

  // PutFile - Saves file contents (called by OnlyOffice on save)
  @Post('files/:fileId/contents')
  async putFile(
    @Param('fileId') fileId: string,
    @Headers('x-wopi-lock') lock: string,
    @Res() res: Response,
    @Req() req: any,
  ) {
    // Verify lock if present
    const existingLock = await this.wopiService.getLock(fileId);
    
    if (existingLock && existingLock !== lock) {
      return res.status(HttpStatus.CONFLICT).json({
        error: 'File is locked by another user',
        lockId: existingLock,
      });
    }

    // Get raw body as buffer
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const body = Buffer.concat(chunks);

    await this.wopiService.putFileContents(fileId, body);

    return res.status(HttpStatus.OK).json({
      success: true,
      message: 'File saved successfully',
    });
  }

  // Lock - Locks a file for editing
  @Post('files/:fileId/lock')
  async lockFile(
    @Param('fileId') fileId: string,
    @Headers('x-wopi-lock') lockId: string,
    @Res() res: Response,
  ) {
    if (!lockId) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        error: 'Lock ID required',
      });
    }

    const success = await this.wopiService.lockFile(fileId, lockId);

    if (!success) {
      const existingLock = await this.wopiService.getLock(fileId);
      return res.status(HttpStatus.CONFLICT).json({
        error: 'File is already locked',
        lockId: existingLock,
      });
    }

    return res.status(HttpStatus.OK).json({
      success: true,
      lockId,
    });
  }

  // Unlock - Unlocks a file
  @Post('files/:fileId/unlock')
  async unlockFile(
    @Param('fileId') fileId: string,
    @Headers('x-wopi-lock') lockId: string,
    @Res() res: Response,
  ) {
    if (!lockId) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        error: 'Lock ID required',
      });
    }

    const success = await this.wopiService.unlockFile(fileId, lockId);

    if (!success) {
      return res.status(HttpStatus.CONFLICT).json({
        error: 'Invalid lock ID',
      });
    }

    return res.status(HttpStatus.OK).json({
      success: true,
    });
  }

  // RefreshLock - Extends lock duration
  @Post('files/:fileId/refresh-lock')
  async refreshLock(
    @Param('fileId') fileId: string,
    @Headers('x-wopi-lock') lockId: string,
    @Res() res: Response,
  ) {
    if (!lockId) {
      return res.status(HttpStatus.BAD_REQUEST).json({
        error: 'Lock ID required',
      });
    }

    const success = await this.wopiService.refreshLock(fileId, lockId);

    if (!success) {
      return res.status(HttpStatus.CONFLICT).json({
        error: 'Invalid lock ID',
      });
    }

    return res.status(HttpStatus.OK).json({
      success: true,
    });
  }

  // GetEditorConfig - Returns OnlyOffice editor configuration with JWT
  @Get('editor-config/:fileId')
  async getEditorConfig(@Param('fileId') fileId: string) {
    const editorConfig = await this.wopiService.getEditorConfig(fileId);
    return editorConfig;
  }
}
