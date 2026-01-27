import { Controller, Get, Post, Param, Res, Body, StreamableFile } from '@nestjs/common';
import { Response } from 'express';
import { FileFolderRepository } from '../file_upload_v3/repositories/file-folder.repository';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

@Controller('onlyoffice')
export class OnlyOfficeController {
  private readonly uploadDir = join(process.cwd(), 'uploads');

  constructor(
    private readonly fileFolderRepository: FileFolderRepository,
  ) {}

  // Serve file for OnlyOffice to download
  @Get('download/:fileId')
  async downloadFile(
    @Param('fileId') fileId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const file = await this.fileFolderRepository.findById(fileId);
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    const filePath = join(this.uploadDir, file.fileName);
    if (!existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found on disk' });
    }

    const fileContents = readFileSync(filePath);
    const fileName = file.fileName.split('/').pop() || file.fileName;
    const fileExtension = fileName.split('.').pop()?.toLowerCase() || '';

    // Map extensions to MIME types
    const mimeTypes: Record<string, string> = {
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'doc': 'application/msword',
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'xls': 'application/vnd.ms-excel',
      'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'ppt': 'application/vnd.ms-powerpoint',
      'pdf': 'application/pdf',
      'txt': 'text/plain',
      'csv': 'text/csv',
    };

    const contentType = mimeTypes[fileExtension] || 'application/octet-stream';

    res.set({
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Content-Length': fileContents.length.toString(),
    });

    return new StreamableFile(fileContents);
  }

  // Callback endpoint for OnlyOffice to save changes
  @Post('callback/:fileId')
  async callback(
    @Param('fileId') fileId: string,
    @Body() body: any,
    @Res() res: Response,
  ) {
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
      if (!file) {
        return res.status(404).json({ error: 0 });
      }

      try {
        const response = await fetch(body.url);
        const buffer = Buffer.from(await response.arrayBuffer());
        
        const filePath = join(this.uploadDir, file.fileName);
        writeFileSync(filePath, buffer);

        console.log(`File saved successfully: ${file.fileName}`);
        return res.json({ error: 0 });
      } catch (error) {
        console.error('Error saving file:', error);
        return res.json({ error: 1 });
      }
    }

    // For other statuses, just acknowledge
    return res.json({ error: 0 });
  }

  // Get editor configuration
  @Get('config/:fileId')
  async getConfig(@Param('fileId') fileId: string) {
    const file = await this.fileFolderRepository.findById(fileId);
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
      width: "100%",
      height: "100%",
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
        }
      },
      editorConfig: {
        mode: 'edit',
        callbackUrl: `${backendUrl}/onlyoffice/callback/${fileId}`,
        user: {
          id: 'user-1',
          name: 'Anonymous User'
        },
        customization: {
          forcesave: true,
          autosave: true,
        }
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
