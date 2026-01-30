export interface CreatorInfo {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  picture?: string;
}

export interface UploadedFile {
  fileName: string;
  fileSize: number;
  totalChunks: number;
  uploadedChunks: Array<number>;
  chunkSize: number;
  createdAt: Date;
  lastActivity: Date;
  fileHash?: string;
  isFolder?: boolean;
  resourceType?: 'dir' | 'file';
  parents?: string[]
  children?: string[]
  _id?: string
  createdBy?: CreatorInfo | string;
  lastViewedBy?: CreatorInfo | string;
  lastViewedAt?: Date;
  lastOpenedBy?: CreatorInfo | string;
  lastOpenedAt?: Date;
  thumbnail?: string;
  activities?: Array<{
    action: string;
    details: string;
    itemId?: string;
    itemName?: string;
    isFolder?: boolean;
    fromId?: string;
    fromName?: string;
    toId?: string;
    toName?: string;
    timestamp: Date;
    userId?: CreatorInfo;
  }>;
}