/* eslint-disable prettier/prettier */
import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { FileFolderRepository } from '../file_upload_v3/repositories/file-folder.repository';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

interface FileLock {
  lockId: string;
  lockedAt: Date;
  expiresAt: Date;
  userId?: string;
}

@Injectable()
export class WopiService {
  private readonly uploadDir = join(process.cwd(), 'uploads');
  private readonly locks = new Map<string, FileLock>();

  constructor(
    private readonly fileFolderRepository: FileFolderRepository,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
  ) {}

  async getFileInfo(fileId: string) {
    const file = await this.fileFolderRepository.findById(fileId);

    if (!file) {
      throw new NotFoundException('File not found');
    }

    const isLocked = this.locks.has(fileId);
    const lock = this.locks.get(fileId);

    return {
      BaseFileName: file.fileName.split('/').pop() || file.fileName,
      Size: file.fileSize,
      Version: file.version || 1,
      OwnerId: 'user1',
      UserId: 'user1',
      UserFriendlyName: 'User',
      SupportsUpdate: true,
      SupportsLocks: true,
      UserCanWrite: true,
      UserCanNotWriteRelative: false,
      SupportsGetLock: true,
      SupportsExtendedLockLength: true,
      SupportsFolders: false,
      SupportsCoauth: true,
      SupportsCobalt: false,
      SupportsFileCreation: false,
      LastModifiedTime: file.lastActivity?.toISOString() || new Date().toISOString(),
      // Lock information
      LockValue: isLocked && lock ? lock.lockId : '',
      LockedByOtherUser: false,
    };
  }

  async getFileContents(fileId: string): Promise<Buffer> {
    const file = await this.fileFolderRepository.findById(fileId);

    if (!file) {
      throw new NotFoundException('File not found');
    }

    const filePath = join(this.uploadDir, file.fileName);

    if (!existsSync(filePath)) {
      throw new NotFoundException('File not found on disk');
    }

    return readFileSync(filePath);
  }

  async putFileContents(fileId: string, contents: Buffer): Promise<void> {
    const file = await this.fileFolderRepository.findById(fileId);

    if (!file) {
      throw new NotFoundException('File not found');
    }

    const filePath = join(this.uploadDir, file.fileName);
    writeFileSync(filePath, contents);

    // Update version and last modified time
    const updatedFile = file.toBuilder()
      .setLastActivity(new Date())
      .build();
    
    updatedFile.version = (file.version || 0) + 1;

    await this.fileFolderRepository.update(file._id, updatedFile);
  }

  async lockFile(fileId: string, lockId: string): Promise<boolean> {
    const existingLock = this.locks.get(fileId);

    if (existingLock) {
      // Check if lock expired
      if (new Date() > existingLock.expiresAt) {
        this.locks.delete(fileId);
      } else {
        return false; // File is already locked
      }
    }

    const lock: FileLock = {
      lockId,
      lockedAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
    };

    this.locks.set(fileId, lock);
    return true;
  }

  async unlockFile(fileId: string, lockId: string): Promise<boolean> {
    const lock = this.locks.get(fileId);

    if (!lock) {
      return true; // Already unlocked
    }

    if (lock.lockId !== lockId) {
      return false; // Wrong lock ID
    }

    this.locks.delete(fileId);
    return true;
  }

  async refreshLock(fileId: string, lockId: string): Promise<boolean> {
    const lock = this.locks.get(fileId);

    if (!lock || lock.lockId !== lockId) {
      return false;
    }

    lock.expiresAt = new Date(Date.now() + 30 * 60 * 1000); // Extend by 30 minutes
    this.locks.set(fileId, lock);
    return true;
  }

  async getLock(fileId: string): Promise<string | null> {
    const lock = this.locks.get(fileId);
    
    if (!lock) {
      return null;
    }

    // Check if expired
    if (new Date() > lock.expiresAt) {
      this.locks.delete(fileId);
      return null;
    }

    return lock.lockId;
  }

  async getEditorConfig(fileId: string) {
    const file = await this.fileFolderRepository.findById(fileId);

    if (!file) {
      throw new NotFoundException('File not found');
    }

    const onlyOfficeUrl = this.configService.get<string>('ONLYOFFICE_URL', 'http://172.31.0.1:3600');
    // Use your machine's actual IP address so OnlyOffice in Docker can access the backend
    // host.docker.internal doesn't work in all Docker setups (especially Linux or older Windows)
    const backendUrl = `http://172.31.0.1:${this.configService.get<string>('PORT', '3000')}`;
    const fileName = file.fileName.split('/').pop() || file.fileName;
    const fileExtension = fileName.split('.').pop()?.toLowerCase() || '';

    // Determine document type based on extension
    let documentType = 'word';
    if (['xls', 'xlsx', 'ods', 'csv'].includes(fileExtension)) {
      documentType = 'cell';
    } else if (['ppt', 'pptx', 'odp'].includes(fileExtension)) {
      documentType = 'slide';
    }

    const config = {
      document: {
        fileType: fileExtension,
        key: `${fileId}_${file.version || 1}_${Date.now()}`,
        title: fileName,
        url: `${backendUrl}/wopi/files/${fileId}/contents`,
        permissions: {
          edit: true,
          download: true,
          review: true,
          comment: true,
        },
      },
      documentType,
      editorConfig: {
        mode: 'edit',
        lang: 'en',
        callbackUrl: `${backendUrl}/wopi/files/${fileId}/contents`,
        user: {
          id: 'user1',
          name: 'User',
        },
        customization: {
          autosave: true,
          forcesave: true,
        },
      },
      type: 'desktop',
    };

    // Generate JWT token for OnlyOffice
    const jwtSecret = this.configService.get<string>('JWT_SECRET');
    const token = this.jwtService.sign(config, {
      secret: jwtSecret,
      expiresIn: '1h',
    });

    return {
      config,
      token,
      onlyOfficeUrl,
    };
  }
}
