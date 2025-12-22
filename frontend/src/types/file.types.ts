export interface UploadedFile  {
  uploadId: string;
  fileName: string;
  fileSize: number;
  totalChunks: number;
  uploadedChunks: Array<number>;
  chunkSize: number;
  createdAt: Date;
  lastActivity: Date;
  fileHash?: string;
  isFolder?: boolean;
  _id?: string
}