import { Controller, Get, Post, Param, Res, Body, StreamableFile, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { FileFolderRepository } from '../file_upload_v3/repositories/file-folder.repository';
import { FileRevisionRepository } from './repositories/file-revision.repository';
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from 'fs';
import { join, basename, extname } from 'path';
import { Types } from 'mongoose';

@Controller('onlyoffice')
export class OnlyOfficeController {
  private readonly uploadDir = join(process.cwd(), 'uploads');
  private readonly revisionsDir = join(process.cwd(), 'uploads', 'revisions');

  constructor(
    private readonly fileFolderRepository: FileFolderRepository,
    private readonly fileRevisionRepository: FileRevisionRepository,
  ) {
    // Ensure revisions directory exists
    if (!existsSync(this.revisionsDir)) {
      mkdirSync(this.revisionsDir, { recursive: true });
    }
  }

  // Serve file for OnlyOffice to download
  @Get('download/:fileId')
  async downloadFile(@Param('fileId') fileId: string, @Res({ passthrough: true }) res: Response) {
    console.log(`[OnlyOffice] Download request for fileId: ${fileId}`);

    try {
      const file = await this.fileFolderRepository.findById(fileId);

      if (!file) {
        console.error(`[OnlyOffice] File not found in database: ${fileId}`);
        return res.status(404).json({ error: 'File not found' });
      }

      const filePath = join(this.uploadDir, file.fileName);
      console.log(`[OnlyOffice] Looking for file at path: ${filePath}`);

      if (!existsSync(filePath)) {
        console.error(`[OnlyOffice] File not found on disk: ${filePath}`);
        return res.status(404).json({ error: 'File not found on disk' });
      }

      const fileContents = readFileSync(filePath);
      const fileName = file.fileName.split('/').pop() || file.fileName;
      const fileExtension = fileName.split('.').pop()?.toLowerCase() || '';

      // Map extensions to MIME types
      const mimeTypes: Record<string, string> = {
        docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        doc: 'application/msword',
        xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        xls: 'application/vnd.ms-excel',
        pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        ppt: 'application/vnd.ms-powerpoint',
        pdf: 'application/pdf',
        txt: 'text/plain',
        csv: 'text/csv',
      };

      const contentType = mimeTypes[fileExtension] || 'application/octet-stream';

      res.set({
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': fileContents.length.toString(),
      });

      console.log(`[OnlyOffice] Serving file: ${fileName} (${fileContents.length} bytes)`);
      return new StreamableFile(fileContents);
    } catch (error) {
      // Check if it's a NotFoundException (file not in database)
      if (error.status === 404 || error.name === 'NotFoundException') {
        console.error(`[OnlyOffice] File not found in database: ${fileId}`);
        return res.status(404).json({ error: 'File not found in database' });
      }
      console.error(`[OnlyOffice] Error downloading file ${fileId}:`, error);
      return res.status(500).json({ error: 'Failed to download file', details: error.message });
    }
  }

  // Download a specific revision
  @Get('download/:fileId/revision/:version')
  async downloadRevision(
    @Param('fileId') fileId: string,
    @Param('version') version: string,
    @Res({ passthrough: true }) res: Response
  ) {
    console.log(`[OnlyOffice] Download revision request: fileId=${fileId}, version=${version}`);
    
    try {
      const revision = await this.fileRevisionRepository.findByVersion(fileId, parseInt(version));
      if (!revision) {
        return res.status(404).json({ error: 'Revision not found' });
      }

      const filePath = join(this.revisionsDir, revision.revisionFileName);
      if (!existsSync(filePath)) {
        return res.status(404).json({ error: 'Revision file not found on disk' });
      }

      const fileContents = readFileSync(filePath);
      const fileName = revision.revisionFileName;
      const fileExtension = fileName.split('.').pop()?.toLowerCase() || '';

      const mimeTypes: Record<string, string> = {
        docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        doc: 'application/msword',
        xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        xls: 'application/vnd.ms-excel',
        pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        ppt: 'application/vnd.ms-powerpoint',
        pdf: 'application/pdf',
        txt: 'text/plain',
        csv: 'text/csv',
      };

      const contentType = mimeTypes[fileExtension] || 'application/octet-stream';

      res.set({
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': fileContents.length.toString(),
      });

      return new StreamableFile(fileContents);
    } catch (error) {
      console.error(`[OnlyOffice] Error downloading revision:`, error);
      return res.status(500).json({ error: 'Failed to download revision' });
    }
  }

  // Callback endpoint for OnlyOffice to save changes
  @Post('callback/:fileId')
  async callback(@Param('fileId') fileId: string, @Body() body: any, @Res() res: Response) {
    console.log('OnlyOffice callback received:', body);

    // Status codes from OnlyOffice:
    // 0 - document not found
    // 1 - document being edited
    // 2 - document ready for saving
    // 3 - document saving error
    // 4 - document closed with no changes
    // 6 - document being edited, but current document state is saved
    // 7 - error has occurred while force saving the document

    if (body.status === 2 || body.status === 6) {
      // Download the saved file from OnlyOffice
      const file = await this.fileFolderRepository.findById(fileId);
      console.log('found file=====89', file);
      if (!file) {
        return res.status(HttpStatus.OK).json({ error: 0 });
      }

      try {
        const response = await fetch(body.url);
        const buffer = Buffer.from(await response.arrayBuffer());

        const currentFilePath = join(this.uploadDir, file.fileName);
        
        // Get next version number
        const nextVersion = await this.fileRevisionRepository.getNextVersion(fileId);
        
        // Create revision of the current file before overwriting
        if (existsSync(currentFilePath)) {
          const ext = extname(file.fileName);
          const revisionFileName = `${fileId}_v${nextVersion - 1}${ext}`;
          const revisionPath = join(this.revisionsDir, revisionFileName);

          // Copy current file to revisions
          copyFileSync(currentFilePath, revisionPath);

          // Get user info from callback
          const userName = body.users?.[0] || 'Anonymous User';
          const userId = body.actions?.[0]?.userid || 'user-1';

          // Create revision record
          await this.fileRevisionRepository.create({
            fileId: new Types.ObjectId(fileId),
            version: nextVersion - 1,
            revisionFileName,
            fileSize: readFileSync(revisionPath).length,
            savedBy: userName,
            userId,
            documentKey: body.key,
            changesUrl: body.changesurl,
            serverVersion: body.history?.serverVersion,
            documentHash: body.history?.changes?.[0]?.documentSha256,
          });

          console.log(`[OnlyOffice] Created revision v${nextVersion - 1} for file ${fileId}`);
        }

        // Save the new version
        writeFileSync(currentFilePath, buffer);

        // Update file version
        await this.fileFolderRepository.update(file._id, {
          version: nextVersion,
          lastActivity: new Date(),
          fileSize: buffer.length,
        });

        console.log(`File saved successfully: ${file.fileName} (v${nextVersion})`);
        return res.status(HttpStatus.OK).json({ error: 0 });
      } catch (error) {
        console.error('Error saving file:', error);
        return res.status(HttpStatus.OK).json({ error: 0 });
      }
    }

    // For other statuses, just acknowledge
    return res.status(HttpStatus.OK).json({ error: 0 });
  }

  // Get revision history for a file
  @Get('revisions/:fileId')
  async getRevisions(@Param('fileId') fileId: string) {
    try {
      const file = await this.fileFolderRepository.findById(fileId);
      if (!file) {
        throw new Error('File not found');
      }

      const revisions = await this.fileRevisionRepository.findByFileId(fileId);
      
      return {
        fileId,
        fileName: file.fileName.split('/').pop() || file.fileName,
        currentVersion: file.version || 1,
        revisions: revisions.map(rev => ({
          id: rev._id.toString(),
          version: rev.version,
          savedBy: rev.savedBy,
          createdAt: rev.createdAt,
          fileSize: rev.fileSize,
          downloadUrl: `/onlyoffice/download/${fileId}/revision/${rev.version}`,
        })),
      };
    } catch (error) {
      console.error('[OnlyOffice] Error getting revisions:', error);
      throw error;
    }
  }

  // Restore a specific revision
  @Post('revisions/:fileId/restore/:version')
  async restoreRevision(
    @Param('fileId') fileId: string,
    @Param('version') version: string,
    @Res() res: Response
  ) {
    try {
      const file = await this.fileFolderRepository.findById(fileId);
      if (!file) {
        return res.status(404).json({ error: 'File not found' });
      }

      const revision = await this.fileRevisionRepository.findByVersion(fileId, parseInt(version));
      if (!revision) {
        return res.status(404).json({ error: 'Revision not found' });
      }

      const revisionPath = join(this.revisionsDir, revision.revisionFileName);
      const currentFilePath = join(this.uploadDir, file.fileName);

      if (!existsSync(revisionPath)) {
        return res.status(404).json({ error: 'Revision file not found on disk' });
      }

      // Create a revision of current file before restoring
      const nextVersion = await this.fileRevisionRepository.getNextVersion(fileId);
      const ext = extname(file.fileName);
      const revisionFileName = `${fileId}_v${nextVersion - 1}${ext}`;
      const newRevisionPath = join(this.revisionsDir, revisionFileName);

      if (existsSync(currentFilePath)) {
        copyFileSync(currentFilePath, newRevisionPath);
        await this.fileRevisionRepository.create({
          fileId: new Types.ObjectId(fileId),
          version: nextVersion - 1,
          revisionFileName,
          fileSize: readFileSync(newRevisionPath).length,
          savedBy: 'System (before restore)',
        });
      }

      // Restore the old revision
      copyFileSync(revisionPath, currentFilePath);

      // Update file version
      await this.fileFolderRepository.update(file._id, {
        version: nextVersion,
        lastActivity: new Date(),
        fileSize: readFileSync(currentFilePath).length,
      });

      console.log(`[OnlyOffice] Restored file ${fileId} to version ${version}`);

      return res.status(HttpStatus.OK).json({
        success: true,
        message: `Restored to version ${version}`,
        newVersion: nextVersion,
      });
    } catch (error) {
      console.error('[OnlyOffice] Error restoring revision:', error);
      return res.status(500).json({ error: 'Failed to restore revision' });
    }
  }

  // Get editor configuration
  @Get('config/:fileId')
  async getConfig(@Param('fileId') fileId: string) {
    const file = await this.fileFolderRepository.findById(fileId);
    console.log('found file', file);
    if (!file) {
      throw new Error('File not found');
    }

    const fileName = file.fileName.split('/').pop() || file.fileName;
    const fileExtension = fileName.split('.').pop()?.toLowerCase() || '';

    // Determine document type
    let documentType = 'word';
    if (['xls', 'xlsx', 'ods', 'csv'].includes(fileExtension)) {
      documentType = 'cell';
    } else if (['ppt', 'pptx', 'odp'].includes(fileExtension)) {
      documentType = 'slide';
    }

    // backendUrl must be accessible by OnlyOffice container
    // When OnlyOffice is in Docker and backend is on Host, use host.docker.internal
    const backendUrl = `http://172.31.0.1:3000`;

    const config = {
      width: '100%',
      height: '100%',
      documentType: documentType,
      document: {
        fileType: fileExtension,
        key: `${fileId}_${file.version || 1}_${Date.now()}`,
        title: fileName,
        url: `${backendUrl}/onlyoffice/download/${fileId}`,
        permissions: {
          edit: true,
          download: true,
          print: true,
          review: true,
        },
      },
      editorConfig: {
        mode: 'edit',
        callbackUrl: `${backendUrl}/onlyoffice/callback/${fileId}`,
        user: {
          id: 'user-1',
          name: 'Anonymous User',
        },
        customization: {
          forcesave: true,
          autosave: true,
        },
      },
      token: '', // Empty token as JWT is disabled in OnlyOffice container
    };

    return {
      config,
      onlyOfficeUrl: 'http://172.31.0.1:3600',
      token: '',
    };
  }
}
