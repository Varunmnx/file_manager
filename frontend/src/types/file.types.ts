export interface UploadedFile  { 
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
}