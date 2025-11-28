// types.ts
export interface FileItem {
  type: 'file';
  name: string;
  file: File;
  size: number;
  path: string;
}

export interface FolderItem {
  type: 'folder';
  name: string;
  children: FileItem[];
  totalSize: number;
  fileCount: number;
}

export interface RootItem {
  type: 'root';
  children: FileItem[];
}

export type FileTreeItem = FolderItem | RootItem;

export interface UseDropzoneOptions {
  onDrop?: (files: File[], tree: FileTreeItem[]) => void;
  accept?: string;
  maxSize?: number;
  maxFiles?: number;
  multiple?: boolean;
}

export interface UseDropzoneReturn {
  fileTree: FileTreeItem[];
  isDragging: boolean;
  errors: string[];
  fileInputRef: React.RefObject<HTMLInputElement| null>;
  handleDrop: (e: React.DragEvent<HTMLDivElement>) => Promise<void>;
  handleDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
  handleDragEnter: (e: React.DragEvent<HTMLDivElement>) => void;
  handleDragLeave: (e: React.DragEvent<HTMLDivElement>) => void;
  handleFileInput: (e: React.ChangeEvent<HTMLInputElement>) => void;
  openFileDialog: () => void;
  openFolderDialog: () => void;
  removeItem: (index: number, childIndex?:number, type?: 'file' | 'folder') => void;
  clearAll: () => void;
}

