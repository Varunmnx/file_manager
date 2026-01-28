import { Controller, Get, Post, Param, Res, Body, StreamableFile, HttpStatus, UseGuards, Req, Query } from '@nestjs/common';
import { Response, Request } from 'express';
import { FileFolderRepository } from '../file_upload_v3/repositories/file-folder.repository';
import { FileRevisionRepository } from './repositories/file-revision.repository';
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from 'fs';
import { join, extname } from 'path';
import { Types } from 'mongoose';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UsersService } from '../auth/service/auth.service';

// Interface for the authenticated user in the request
interface AuthenticatedRequest extends Request {
  user: {
    _id: string;
    email: string;
  };
}

@Controller('onlyoffice')
export class OnlyOfficeController {
  private readonly uploadDir = join(process.cwd(), 'uploads');
  private readonly revisionsDir = join(process.cwd(), 'uploads', 'revisions');

  constructor(
    private readonly fileFolderRepository: FileFolderRepository,
    private readonly fileRevisionRepository: FileRevisionRepository,
    private readonly usersService: UsersService,
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
    @Res({ passthrough: true }) res: Response,
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
    console.log('=== OnlyOffice Callback ===');
    console.log('FileId:', fileId);
    console.log('Status:', body.status);
    console.log('Body:', JSON.stringify(body, null, 2));

    // Status codes from OnlyOffice:
    // 0 - document not found
    // 1 - document being edited
    // 2 - document ready for saving
    // 3 - document saving error
    // 4 - document closed with no changes
    // 6 - document being edited, but current document state is saved (force save)
    // 7 - error has occurred while force saving the document

    if (body.status === 2 || body.status === 6) {
      console.log(`[OnlyOffice] Processing save for file ${fileId}, status: ${body.status}`);
      
      // Download the saved file from OnlyOffice
      const file = await this.fileFolderRepository.findById(fileId);
      console.log('[OnlyOffice] Found file:', file ? `${file.fileName} (v${file.version})` : 'NOT FOUND');
      
      if (!file) {
        console.error(`[OnlyOffice] File not found: ${fileId}`);
        return res.status(HttpStatus.OK).json({ error: 0 });
      }

      try {
        console.log(`[OnlyOffice] Downloading from: ${body.url}`);
        const response = await fetch(body.url);
        
        if (!response.ok) {
          console.error(`[OnlyOffice] Failed to download file from OnlyOffice: ${response.status}`);
          return res.status(HttpStatus.OK).json({ error: 0 });
        }
        
        const buffer = Buffer.from(await response.arrayBuffer());
        console.log(`[OnlyOffice] Downloaded ${buffer.length} bytes`);

        const currentFilePath = join(this.uploadDir, file.fileName);

        // Get the current version of the file (default to 1 if not set)
        const currentVersion = file.version || 1;
        console.log(`[OnlyOffice] Current version: ${currentVersion}`);

        // Create revision of the current file before overwriting
        // This revision represents the state BEFORE the new changes
        if (existsSync(currentFilePath)) {
          const ext = extname(file.fileName);
          // Revision file name matches its version number
          const revisionFileName = `${fileId}_v${currentVersion}${ext}`;
          const revisionPath = join(this.revisionsDir, revisionFileName);

          // Copy current file to revisions
          copyFileSync(currentFilePath, revisionPath);
          console.log(`[OnlyOffice] Created revision file: ${revisionFileName}`);

          // Get user info from callback - OnlyOffice sends the user name that was set in config
          const userName = body.users?.[0] || 'Unknown User';
          const userId = body.actions?.[0]?.userid || 'unknown';
          console.log(`[OnlyOffice] User: ${userName} (${userId})`);

          // Create revision record with the CURRENT version number
          const revisionRecord = await this.fileRevisionRepository.create({
            fileId: new Types.ObjectId(fileId),
            version: currentVersion,
            revisionFileName,
            fileSize: readFileSync(revisionPath).length,
            savedBy: userName,
            userId,
            documentKey: body.key,
            changesUrl: body.changesurl,
            serverVersion: body.history?.serverVersion,
            documentHash: body.history?.changes?.[0]?.documentSha256,
          });

          console.log(`[OnlyOffice] Created revision record: ${revisionRecord._id} for v${currentVersion}`);
        } else {
          console.log(`[OnlyOffice] No existing file found at: ${currentFilePath}`);
        }

        // Save the new version
        writeFileSync(currentFilePath, buffer);
        console.log(`[OnlyOffice] Saved new file content to: ${currentFilePath}`);

        // Increment file version (new content is now the next version)
        const newVersion = currentVersion + 1;
        const updatedFile = await this.fileFolderRepository.update(file._id, {
          version: newVersion,
          lastActivity: new Date(),
          fileSize: buffer.length,
        });

        console.log(`[OnlyOffice] Updated file version: ${currentVersion} -> ${newVersion}`);
        console.log(`[OnlyOffice] File saved successfully: ${file.fileName}`);
        
        return res.status(HttpStatus.OK).json({ error: 0 });
      } catch (error) {
        console.error('[OnlyOffice] Error saving file:', error);
        // Still return success to OnlyOffice to prevent retries
        return res.status(HttpStatus.OK).json({ error: 0 });
      }
    }

    // For other statuses, just acknowledge
    console.log(`[OnlyOffice] Status ${body.status} - no action needed`);
    return res.status(HttpStatus.OK).json({ error: 0 });
  }

  // Get revision history for a file (requires authentication)
  @UseGuards(JwtAuthGuard)
  @Get('revisions/:fileId')
  async getRevisions(@Param('fileId') fileId: string) {
    try {
      console.log(`[OnlyOffice] Getting revisions for file: ${fileId}`);
      
      const file = await this.fileFolderRepository.findById(fileId);
      if (!file) {
        console.error(`[OnlyOffice] File not found: ${fileId}`);
        throw new Error('File not found');
      }

      console.log(`[OnlyOffice] File found: ${file.fileName}, version: ${file.version}`);

      const revisions = await this.fileRevisionRepository.findByFileId(fileId);
      console.log(`[OnlyOffice] Found ${revisions.length} revisions`);

      const result = {
        fileId,
        fileName: file.fileName.split('/').pop() || file.fileName,
        currentVersion: file.version || 1,
        revisions: revisions.map((rev) => ({
          id: rev._id.toString(),
          version: rev.version,
          savedBy: rev.savedBy,
          createdAt: rev.createdAt,
          fileSize: rev.fileSize,
          downloadUrl: `/onlyoffice/download/${fileId}/revision/${rev.version}`,
        })),
      };

      console.log(`[OnlyOffice] Returning:`, JSON.stringify(result, null, 2));
      return result;
    } catch (error) {
      console.error('[OnlyOffice] Error getting revisions:', error);
      throw error;
    }
  }

  // View a specific revision in the editor (read-only, requires authentication)
  @UseGuards(JwtAuthGuard)
  @Get('revisions/:fileId/view/:version')
  async viewRevision(@Param('fileId') fileId: string, @Param('version') version: string) {
    try {
      const file = await this.fileFolderRepository.findById(fileId);
      if (!file) {
        throw new Error('File not found');
      }

      const targetVersion = parseInt(version);
      const revision = await this.fileRevisionRepository.findByVersion(fileId, targetVersion);
      if (!revision) {
        throw new Error('Revision not found');
      }

      const revisionPath = join(this.revisionsDir, revision.revisionFileName);
      if (!existsSync(revisionPath)) {
        throw new Error('Revision file not found on disk');
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
      const backendUrl = `http://host.docker.internal:3000`;

      // Return read-only config for viewing the revision
      const config = {
        width: '100%',
        height: '100%',
        documentType: documentType,
        document: {
          fileType: fileExtension,
          key: `${fileId}_revision_v${targetVersion}_${Date.now()}`,
          title: `${fileName} (Version ${targetVersion})`,
          url: `${backendUrl}/onlyoffice/download/${fileId}/revision/${targetVersion}`,
          permissions: {
            edit: false,
            download: true,
            print: true,
            review: false,
          },
        },
        editorConfig: {
          mode: 'view',
          user: {
            id: 'user-1',
            name: 'Anonymous User',
          },
          customization: {
            chat: false,
            comments: false,
            zoom: 100,
          },
        },
        token: '',
      };

      return {
        config,
        onlyOfficeUrl: 'http://172.31.0.1:3600',
        token: '',
        revision: {
          version: targetVersion,
          savedBy: revision.savedBy,
          createdAt: revision.createdAt,
          fileSize: revision.fileSize,
        },
      };
    } catch (error) {
      console.error('[OnlyOffice] Error getting revision view config:', error);
      throw error;
    }
  }

  // Get editor configuration (requires authentication)
  @UseGuards(JwtAuthGuard)
  @Get('config/:fileId')
  async getConfig(@Param('fileId') fileId: string, @Req() req: AuthenticatedRequest) {
    const file = await this.fileFolderRepository.findById(fileId);
    console.log('found file', file);
    if (!file) {
      throw new Error('File not found');
    }

    // Get the authenticated user's full details
    const currentUser = await this.usersService.findByEmail(req.user.email);
    const userName = currentUser 
      ? `${currentUser.firstName} ${currentUser.lastName}`.trim() 
      : 'Anonymous User';
    const userId = req.user._id;

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
    const backendUrl = `http://host.docker.internal:3000`;

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
          id: userId,
          name: userName,
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
      user: {
        id: userId,
        name: userName,
        email: req.user.email,
      },
    };
  }
}

