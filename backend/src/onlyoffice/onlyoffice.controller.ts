import { Controller, Get, Post, Param, Res, Body, StreamableFile, HttpStatus, UseGuards, Req, Query, Logger } from '@nestjs/common';
import { Response, Request } from 'express';
import { FileFolderRepository } from '../file_upload_v3/repositories/file-folder.repository';
import { FileRevisionRepository } from './repositories/file-revision.repository';
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync, statSync } from 'fs';
import { join, extname } from 'path';
import { Types } from 'mongoose';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UsersService } from '../auth/service/auth.service';
import { OnlyOfficeService } from './onlyoffice.service';
import { CallbackAuthGuard } from './guards/callback-auth.guard';
import { DownloadAuthGuard } from './guards/download-auth.guard';
import { GeminiService } from './gemini.service';
import * as mammoth from 'mammoth';
// eslint-disable-next-line @typescript-eslint/no-var-requires
import { extractText } from 'unpdf';
import * as XLSX from 'xlsx';
import { FileRevisionDocument } from './entities/file-revision.entity';

// Interface for the authenticated user in the request
interface AuthenticatedRequest extends Request {
  user: {
    _id: string;
    email: string;
  };
}

@Controller('onlyoffice')
export class OnlyOfficeController {
  private readonly logger = new Logger(OnlyOfficeController.name);
  private readonly uploadDir = join(process.cwd(), 'uploads');
  private readonly revisionsDir = join(process.cwd(), 'uploads', 'revisions');

  constructor(
    private readonly fileFolderRepository: FileFolderRepository,
    private readonly fileRevisionRepository: FileRevisionRepository,
    private readonly usersService: UsersService,
    private readonly onlyOfficeService: OnlyOfficeService,
    private readonly geminiService: GeminiService,
  ) {
    // Ensure revisions directory exists
    if (!existsSync(this.revisionsDir)) {
      mkdirSync(this.revisionsDir, { recursive: true });
    }
  }

  // Serve file for OnlyOffice to download (Protected by DownloadAuthGuard)
  @UseGuards(DownloadAuthGuard)
  @Get('download/:fileId')
  async downloadFile(@Param('fileId') fileId: string, @Res({ passthrough: true }) res: Response) {
    this.logger.log(`[OnlyOffice] Download request for fileId: ${fileId}`);

    try {
      const file = await this.fileFolderRepository.findById(fileId);

      if (!file) {
        this.logger.error(`[OnlyOffice] File not found in database: ${fileId}`);
        return res.status(404).json({ error: 'File not found' });
      }

      const filePath = join(this.uploadDir, file.fileName);

      if (!existsSync(filePath)) {
        this.logger.error(`[OnlyOffice] File not found on disk: ${filePath}`);
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

      this.logger.log(`[OnlyOffice] Serving file: ${fileName} (${fileContents.length} bytes)`);
      return new StreamableFile(fileContents);
    } catch (error) {
      if (error.status === 404 || error.name === 'NotFoundException') {
        return res.status(404).json({ error: 'File not found in database' });
      }
      this.logger.error(`[OnlyOffice] Error downloading file ${fileId}:`, error);
      return res.status(500).json({ error: 'Failed to download file', details: error.message });
    }
  }

  // Download a specific revision (Protected by DownloadAuthGuard)
  @UseGuards(DownloadAuthGuard)
  @Get('download/:fileId/revision/:version')
  async downloadRevision(
    @Param('fileId') fileId: string,
    @Param('version') version: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.logger.log(`[OnlyOffice] Download revision request: fileId=${fileId}, version=${version}`);

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
      this.logger.error(`[OnlyOffice] Error downloading revision:`, error);
      return res.status(500).json({ error: 'Failed to download revision' });
    }
  }

  // Callback endpoint for OnlyOffice to save changes (Protected by CallbackAuthGuard)
  // This validates that the request truly comes from the document server
  @UseGuards(CallbackAuthGuard)
  @Post('callback/:fileId')
  async callback(@Param('fileId') fileId: string, @Body() body: any, @Res() res: Response) {
    this.logger.log('=== OnlyOffice Callback ===');
    this.logger.log(`FileId: ${fileId}, Status: ${body.status}`);

    // Status codes from OnlyOffice:
    // 2 - document ready for saving
    // 6 - document being edited, but current document state is saved (force save)
    if (body.status === 2 || body.status === 6) {
      this.logger.log(`[OnlyOffice] Processing save for file ${fileId}, status: ${body.status}`);

      const file = await this.fileFolderRepository.findById(fileId);

      if (!file) {
        this.logger.error(`[OnlyOffice] File not found: ${fileId}`);
        return res.status(HttpStatus.OK).json({ error: 0 });
      }

      try {
        this.logger.log(`[OnlyOffice] Downloading from: ${body.url}`);

        // Note: OnlyOffice often does NOT sign the internal download URL
        // So we just fetch it directly from the container
        const response = await fetch(body.url);

        if (!response.ok) {
          this.logger.error(`[OnlyOffice] Failed to download file from OnlyOffice: ${response.status}`);
          return res.status(HttpStatus.OK).json({ error: 0 });
        }

        const buffer = Buffer.from(await response.arrayBuffer());
        const currentFilePath = join(this.uploadDir, file.fileName);

        // Get the current version of the file (default to 1 if not set)
        const currentVersion = file.version || 1;

        // Create revision of the current file before overwriting
        if (existsSync(currentFilePath)) {
          const ext = extname(file.fileName);
          const revisionFileName = `${fileId}_v${currentVersion}${ext}`;

          // Ensure revisions directory exists just in case
          if (!existsSync(this.revisionsDir)) {
            mkdirSync(this.revisionsDir, { recursive: true });
          }

          const revisionPath = join(this.revisionsDir, revisionFileName);

          try {
            copyFileSync(currentFilePath, revisionPath);
            this.logger.log(`[OnlyOffice] Created revision file: ${revisionFileName}`);
          } catch (copyError) {
            this.logger.error(`[OnlyOffice] Failed to copy revision file: ${copyError.message}`);
            // If we can't create a revision, we should probably stop or at least not create the DB record
            throw copyError;
          }

          const userName = body.users?.[0] || 'Unknown User';
          const userId = body.actions?.[0]?.userid || 'unknown';

          // Save revision record immediately (Async AI will update it later)
          const revision = await this.fileRevisionRepository.create({
            fileId: new Types.ObjectId(fileId),
            version: currentVersion,
            revisionFileName,
            fileSize: statSync(revisionPath).size,
            savedBy: userName,
            userId: userId !== 'unknown' ? userId : undefined,
            documentKey: body.key,
            changesUrl: body.changesurl,
            serverVersion: body.history?.serverVersion,
            documentHash: body.history?.changes?.[0]?.documentSha256,
            aiChangeSummary: 'Analysis pending...', // Placeholder
            createdAt: new Date()
          });

          // Trigger background analysis (Fire & Forget)
          this.handleAsyncAIAnalysis(revision, revisionPath, buffer, ext, file.fileName).catch(e =>
            this.logger.error('Background AI task failed', e)
          );
        }

        // Save the new version
        writeFileSync(currentFilePath, buffer);
        this.logger.log(`[OnlyOffice] Saved new file content to: ${currentFilePath}`);

        // Increment file version
        const newVersion = currentVersion + 1;
        await this.fileFolderRepository.update(file._id, {
          version: newVersion,
          lastActivity: new Date(),
          fileSize: buffer.length,
        });

        this.logger.log(`[OnlyOffice] File saved successfully: ${file.fileName} (v${newVersion})`);

        return res.status(HttpStatus.OK).json({ error: 0 });
      } catch (error) {
        this.logger.error('[OnlyOffice] Error saving file:', error);
        return res.status(HttpStatus.OK).json({ error: 0 });
      }
    }

    return res.status(HttpStatus.OK).json({ error: 0 });
  }

  // Get revision history for a file (requires authentication)
  @UseGuards(JwtAuthGuard)
  @Get('revisions/:fileId')
  async getRevisions(@Param('fileId') fileId: string) {
    try {
      const file = await this.fileFolderRepository.findById(fileId);
      if (!file) throw new Error('File not found');

      const revisions = await this.fileRevisionRepository.findByFileId(fileId);

      // Generate secure download tokens for revisions and populate user details
      const revisionList = await Promise.all(revisions.map(async (rev) => {
        const token = this.onlyOfficeService.generateDownloadToken(fileId, rev.version);

        // Populate User Details
        let userDetails: { name: string; picture?: string; } | null = null;
        if (rev.userId) {
          try {
            const user = await this.usersService.findById(rev.userId);
            if (user) {
              userDetails = {
                name: `${user.firstName} ${user.lastName}`,
                picture: user.picture
              };
            }
          } catch (e) {
            // ignore
          }
        }

        return {
          id: rev._id.toString(),
          version: rev.version,
          savedBy: rev.savedBy,
          user: userDetails,
          createdAt: rev.createdAt,
          fileSize: rev.fileSize,
          aiChangeSummary: rev.aiChangeSummary,
          aiFileSummary: rev.aiFileSummary,
          // Append token to download URL
          downloadUrl: `/onlyoffice/download/${fileId}/revision/${rev.version}?token=${token}`,
        };
      }));

      return {
        fileId,
        fileName: file.fileName.split('/').pop() || file.fileName,
        currentVersion: file.version || 1,
        revisions: revisionList,
        activities: file.activities || [],
        isFolder: file.isFolder || false,
      };
    } catch (error) {
      this.logger.error('[OnlyOffice] Error getting revisions:', error);
      throw error;
    }
  }

  // On-demand file summary generation
  @UseGuards(JwtAuthGuard)
  @Post('revisions/:revisionId/summarize')
  async summarizeRevision(@Param('revisionId') revisionId: string) {
    try {
      this.logger.log(`Summarizing revision: ${revisionId}`);
      const revision = await this.fileRevisionRepository.findById(revisionId);
      if (!revision) {
        throw new Error('Revision not found');
      }

      // Return existing summary if available
      if (revision.aiFileSummary) {
        return { summary: revision.aiFileSummary };
      }

      let fileContent = '';
      const revisionFileName = revision.revisionFileName;
      const revisionPath = join(this.revisionsDir, revisionFileName);

      if (!existsSync(revisionPath)) {
        return { message: 'Revision file not found on disk', summary: null };
      }

      const ext = extname(revisionFileName).toLowerCase();
      const buffer = readFileSync(revisionPath);

      // Extract text
      if (ext === '.docx') {
        const result = await mammoth.extractRawText({ buffer });
        fileContent = result.value;
      } else if (ext === '.pdf') {
        const uint8Array = new Uint8Array(buffer);
        const text = await extractText(uint8Array)
        fileContent = text.text.join('\n');

      } else if (['.xlsx', '.xls', '.csv'].includes(ext)) {
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        workbook.SheetNames.forEach(sheetName => {
          const sheet = workbook.Sheets[sheetName];
          fileContent += `Sheet: ${sheetName}\n` + XLSX.utils.sheet_to_csv(sheet) + '\n';
        });
      } else if (['.txt', '.md'].includes(ext)) {
        fileContent = buffer.toString('utf-8');
      } else {
        return { message: 'File type not supported for summary', summary: null };
      }

      const summary = await this.geminiService.generateFileSummary(fileContent, revisionFileName);

      // Save to DB
      revision.aiFileSummary = summary;
      await revision.save();

      return { summary };
    } catch (error) {
      this.logger.error('[OnlyOffice] Error generating summary:', error);
      throw error;
    }
  }

  // View a specific revision in the editor (read-only, requires authentication)
  @UseGuards(JwtAuthGuard)
  @Get('revisions/:fileId/view/:version')
  async viewRevision(@Param('fileId') fileId: string, @Param('version') version: string, @Req() req: AuthenticatedRequest) {
    try {
      const file = await this.fileFolderRepository.findById(fileId);
      if (!file) throw new Error('File not found');
      const currentUser = await this.usersService.findByEmail(req.user.email);
      const userName = currentUser
        ? `${currentUser.firstName} ${currentUser.lastName}`.trim()
        : 'Anonymous User';
      const userId = req.user._id;
      const targetVersion = parseInt(version);
      const revision = await this.fileRevisionRepository.findByVersion(fileId, targetVersion);
      if (!revision) throw new Error('Revision not found');

      const fileName = file.fileName.split('/').pop() || file.fileName;
      const fileExtension = fileName.split('.').pop()?.toLowerCase() || '';

      // Determine document type
      let documentType = 'word';
      if (['xls', 'xlsx', 'ods', 'csv'].includes(fileExtension)) {
        documentType = 'cell';
      } else if (['ppt', 'pptx', 'odp'].includes(fileExtension)) {
        documentType = 'slide';
      }

      // Generate secure tokens
      const downloadToken = this.onlyOfficeService.generateDownloadToken(fileId, targetVersion);
      const backendUrl = `http://host.docker.internal:3000`; // Accessible by OnlyOffice container

      const config = {
        width: '100%',
        height: '100%',
        documentType: documentType,
        document: {
          fileType: fileExtension,
          key: `${fileId}_rev_v${targetVersion}`,
          title: `${fileName} (Version ${targetVersion})`,
          // Add token to the internal download URL
          url: `${backendUrl}/onlyoffice/download/${fileId}/revision/${targetVersion}?token=${downloadToken}`,
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
            id: userId,
            name: userName,
          },
          customization: {
            chat: false,
            comments: false,
            zoom: 100,
          },
        },
        // IMPORTANT: Must be empty string if JWT is disabled in OnlyOffice, otherwise signed token
        token: '',
      };

      // Sign the config if JWT is enabled
      if (this.onlyOfficeService.isJwtEnabled()) {
        config.token = this.onlyOfficeService.signConfig(config);
      }

      return {
        config,
        onlyOfficeUrl: 'http://172.31.0.1:3600',
        token: config.token,
        revision: {
          version: targetVersion,
          savedBy: revision.savedBy,
          createdAt: revision.createdAt,
          fileSize: revision.fileSize,
        },
      };
    } catch (error) {
      this.logger.error('[OnlyOffice] Error getting revision view config:', error);
      throw error;
    }
  }

  // Get editor configuration (requires authentication)
  @UseGuards(JwtAuthGuard)
  @Get('config/:fileId')
  async getConfig(@Param('fileId') fileId: string, @Req() req: AuthenticatedRequest) {
    const file = await this.fileFolderRepository.findById(fileId);
    if (!file) {
      throw new Error('File not found');
    }

    const currentUser = await this.usersService.findByEmail(req.user.email);
    const userName = currentUser
      ? `${currentUser.firstName} ${currentUser.lastName}`.trim()
      : 'Anonymous User';
    const userId = req.user._id;

    const fileName = file.fileName.split('/').pop() || file.fileName;
    const fileExtension = fileName.split('.').pop()?.toLowerCase() || '';

    let documentType = 'word';
    if (['xls', 'xlsx', 'ods', 'csv'].includes(fileExtension)) {
      documentType = 'cell';
    } else if (['ppt', 'pptx', 'odp'].includes(fileExtension)) {
      documentType = 'slide';
    }

    // Generate secure tokens
    const downloadToken = this.onlyOfficeService.generateDownloadToken(fileId);
    const backendUrl = `http://host.docker.internal:3000`;

    const config = {
      width: '100%',
      height: '100%',
      documentType: documentType,
      document: {
        fileType: fileExtension,
        key: `${fileId}_v${file.version || 1}`,
        title: fileName,
        // Add token to download URL
        url: `${backendUrl}/onlyoffice/download/${fileId}?token=${downloadToken}`,
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
      token: '',
    };

    // Sign the config if JWT is enabled
    if (this.onlyOfficeService.isJwtEnabled()) {
      config.token = this.onlyOfficeService.signConfig(config);
    }

    return {
      config,
      onlyOfficeUrl: 'http://172.31.0.1:3600',
      token: config.token,
      user: {
        id: userId,
        name: userName,
        email: req.user.email,
      },
    };
  }

  private async handleAsyncAIAnalysis(revision: FileRevisionDocument, revisionPath: string, newBuffer: Buffer, ext: string, fileName: string) {
    this.logger.log(`Starting background AI analysis for ${fileName}`);
    try {
      let aiChangeSummary = '';

      if (ext === '.docx') {
        try {
          const oldBuffer = readFileSync(revisionPath);

          const oldResult = await mammoth.extractRawText({ buffer: oldBuffer });
          const newResult = await mammoth.extractRawText({ buffer: newBuffer });

          const oldText = oldResult.value;
          const newText = newResult.value;

          if (oldText !== newText) {
            aiChangeSummary = await this.geminiService.generateChangeSummary(oldText, newText, fileName);
          } else {
            aiChangeSummary = 'No textual changes detected.';
          }
        } catch (err) {
          this.logger.error('Error extracting text for AI:', err);
          aiChangeSummary = 'Analysis failed.';
        }
      }

      else if (ext === '.pdf') {
        try {
          const oldBuffer = readFileSync(revisionPath);
          const oldUint8Array = new Uint8Array(oldBuffer);
          const newUint8Array = new Uint8Array(newBuffer);
          const oldText = await extractText(oldUint8Array);
          const newText = await extractText(newUint8Array);

          if (oldText !== newText) {
            aiChangeSummary = await this.geminiService.generateChangeSummary(oldText.text.join('\n'), newText.text.join('\n'), fileName);
          } else {
            aiChangeSummary = 'No textual changes detected.';
          }
        } catch (err) {
          this.logger.error('Error extracting PDF text for AI:', err);
          aiChangeSummary = 'Analysis failed.';
        }
      }
      else if (['.xlsx', '.xls', '.csv'].includes(ext)) {
        try {
          const extractSheetText = (buf: Buffer) => {
            const workbook = XLSX.read(buf, { type: 'buffer' });
            let text = '';
            workbook.SheetNames.forEach(sheetName => {
              const sheet = workbook.Sheets[sheetName];
              text += `Sheet: ${sheetName}\n` + XLSX.utils.sheet_to_csv(sheet) + '\n';
            });
            return text;
          };

          const oldText = extractSheetText(readFileSync(revisionPath));
          const newText = extractSheetText(newBuffer);

          if (oldText !== newText) {
            aiChangeSummary = await this.geminiService.generateChangeSummary(oldText, newText, fileName);
          } else {
            aiChangeSummary = 'No textual changes detected.';
          }
        } catch (err) {
          this.logger.error('Error extracting Excel/CSV text for AI:', err);
          aiChangeSummary = 'Analysis failed.';
        }
      } else if (['.txt', '.md'].includes(ext)) {
        try {
          const oldText = readFileSync(revisionPath, 'utf-8');
          const newText = newBuffer.toString('utf-8');

          if (oldText !== newText) {
            aiChangeSummary = await this.geminiService.generateChangeSummary(oldText, newText, fileName);
          } else {
            aiChangeSummary = 'No textual changes detected.';
          }
        } catch (err) {
          this.logger.error('Error extracting text for AI:', err);
          aiChangeSummary = 'Analysis failed.';
        }
      } else {
        aiChangeSummary = 'File type not supported for analysis.';
      }

      // Update revision record
      if (aiChangeSummary) {
        revision.aiChangeSummary = aiChangeSummary;
        await revision.save();
        this.logger.log(`Background AI analysis complete for ${fileName}`);
      }
    } catch (e) {
      this.logger.error(`Fatal error in background AI analysis for ${fileName}`, e);
      revision.aiChangeSummary = 'Analysis failed due to server error.';
      await revision.save();
    }
  }
}

