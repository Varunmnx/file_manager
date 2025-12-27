/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useRef, useCallback, useEffect } from 'react';
import { FileTreeItem, FolderItem, RootItem, UseDropzoneOptions, UseDropzoneReturn, FileItem } from '../types';

export function useDropzone(options: UseDropzoneOptions = {}): UseDropzoneReturn {
  const {
    onDrop,
    accept = '*',
    maxSize = 5 * 1024 * 1024,
    maxFiles = 100,
    multiple = true,
    initialFiles = [],
  } = options;

  const [fileTree, setFileTree] = useState<FileTreeItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = useCallback((file: File): string[] => {
    const errors: string[] = [];
    
    if (file.size > maxSize) {
      errors.push(`${file.name} is too large. Max size is ${(maxSize / 1024 / 1024).toFixed(2)}MB`);
    }
    
    if (accept !== '*') {
      const acceptedTypes = accept.split(',').map(type => type.trim());
      const fileType = file.type;
      const fileExtension = '.' + file.name.split('.').pop();
      
      const isAccepted = acceptedTypes.some(type => {
        if (type.startsWith('.')) {
          return fileExtension === type;
        }
        if (type.endsWith('/*')) {
          return fileType.startsWith(type.replace('/*', ''));
        }
        return fileType === type;
      });
      
      if (!isAccepted) {
        errors.push(`${file.name} type is not accepted. Accepted types: ${accept}`);
      }
    }
    
    return errors;
  }, [accept, maxSize]);

  const buildFileTree = useCallback((files: File[]): FileTreeItem[] => {
    const folderMap = new Map<string, FolderItem>();
    const standaloneFiles: FileItem[] = [];
    
    console.log('Building tree from files:', files.length);
    
    files.forEach(file => {
      const path = (file as any).webkitRelativePath || file.name;
      const parts = path.split('/');
      
      console.log('File path:', path, 'Parts:', parts);
      
      // If it's a standalone file (no folder structure)
      if (parts.length === 1) {
        standaloneFiles.push({
          type: 'file',
          name: file.name,
          file: file,
          size: file.size,
          path: path
        });
      } else {
        // It's inside a folder - use the first part as folder name
        const folderName = parts[0];
        
        if (!folderMap.has(folderName)) {
          console.log('Creating folder:', folderName);
          folderMap.set(folderName, {
            type: 'folder',
            name: folderName,
            children: [],
            totalSize: 0,
            fileCount: 0
          });
        }
        
        const folder = folderMap.get(folderName)!;
        folder.children.push({
          type: 'file',
          name: parts.slice(1).join('/'),
          file: file,
          size: file.size,
          path: path
        });
        folder.totalSize += file.size;
        folder.fileCount += 1;
      }
    });
    
    // Build the tree: folders first, then standalone files
    const tree: FileTreeItem[] = Array.from(folderMap.values());
    
    console.log('Created folders:', tree.map(t => t.type === 'folder' ? t.name : 'root'));
    
    // Add standalone files as a root item if any exist
    if (standaloneFiles.length > 0) {
      tree.push({
        type: 'root',
        children: standaloneFiles
      });
    }
    
    return tree;
  }, []);

  const getTotalFileCount = useCallback(() => {
    return fileTree.reduce((count, item) => {
      if (item.type === 'folder') {
        return count + item.fileCount;
      } else if (item.type === 'root') {
        return count + item.children.length;
      }
      return count;
    }, 0);
  }, [fileTree]);

  const processFiles = useCallback((newFiles: FileList | File[]) => {
    const fileArray = Array.from(newFiles);
    const allErrors: string[] = [];
    const validFiles: File[] = [];

    console.log('Processing files:', fileArray.length);

    // Check if multiple files are allowed
    if (!multiple && fileArray.length > 1) {
      allErrors.push('Only one file is allowed');
      setErrors(allErrors);
      return;
    }

    // Check if adding these files would exceed maxFiles
    const currentFileCount = getTotalFileCount();
    const newFileCount = fileArray.length;
    
    if (currentFileCount + newFileCount > maxFiles) {
      allErrors.push(`Cannot add ${newFileCount} file(s). Maximum ${maxFiles} files allowed. Currently have ${currentFileCount} file(s).`);
      setErrors(allErrors);
      return;
    }

    // Validate each file
    fileArray.forEach(file => {
      const fileErrors = validateFile(file);
      if (fileErrors.length > 0) {
        allErrors.push(...fileErrors);
      } else {
        validFiles.push(file);
      }
    });

    setErrors(allErrors);

    if (validFiles.length > 0) {
      // If not multiple, replace existing files
      if (!multiple) {
        setFileTree([]);
      }

      const newTree = buildFileTree(validFiles);
      console.log('New tree:', newTree);
      
      // Ensure we don't exceed maxFiles after building tree
      setFileTree(prev => {
        console.log('Previous tree:', prev);
        console.log('New tree to add:', newTree);
        
        // Merge folders with same names or keep separate
        const combined = multiple ? [...prev, ...newTree] : newTree;
        console.log('Combined tree:', combined);
        console.log('Combined tree length:', combined.length);
        
        // Count total files in combined tree
        const totalFiles = combined.reduce((count, item) => {
          if (item.type === 'folder') {
            return count + item.fileCount;
          } else if (item.type === 'root') {
            return count + item.children.length;
          }
          return count;
        }, 0);

        // If exceeds maxFiles, truncate
        if (totalFiles > maxFiles) {
          const truncatedTree: FileTreeItem[] = [];
          let fileCount = 0;

          for (const item of combined) {
            if (item.type === 'folder') {
              if (fileCount + item.fileCount <= maxFiles) {
                truncatedTree.push(item);
                fileCount += item.fileCount;
              } else {
                // Partially add folder
                const remainingSpace = maxFiles - fileCount;
                const truncatedFolder: FolderItem = {
                  ...item,
                  children: item.children.slice(0, remainingSpace),
                  fileCount: remainingSpace,
                  totalSize: item.children.slice(0, remainingSpace).reduce((sum, child) => sum + child.size, 0)
                };
                truncatedTree.push(truncatedFolder);
                break;
              }
            } else if (item.type === 'root') {
              if (fileCount + item.children.length <= maxFiles) {
                truncatedTree.push(item);
                fileCount += item.children.length;
              } else {
                // Partially add root files
                const remainingSpace = maxFiles - fileCount;
                const truncatedRoot: RootItem = {
                  type: 'root',
                  children: item.children.slice(0, remainingSpace)
                };
                truncatedTree.push(truncatedRoot);
                break;
              }
            }
          }

          setErrors(prev => [...prev, `Only ${maxFiles} files allowed. Some files were not added.`]);
          return truncatedTree;
        }

        return combined;
      });
      
      if (onDrop) {
        onDrop(validFiles, newTree);
      }
    }
  }, [validateFile, buildFileTree, onDrop, multiple, maxFiles, getTotalFileCount]);

  // Process initial files when component mounts
  useEffect(() => {
    if (initialFiles && initialFiles.length > 0) {
      processFiles(initialFiles);
    }
  }, []); // Only run once on mount

  const readDirectory = async (
    dirEntry: any,
    path: string,
    files: File[]
  ): Promise<void> => {
    const dirReader = dirEntry.createReader();
    
    return new Promise((resolve) => {
      const readEntries = () => {
        dirReader.readEntries(async (entries: any[]) => {
          if (entries.length === 0) {
            resolve();
            return;
          }

          for (const entry of entries) {
            if (entry.isFile) {
              await new Promise<void>((resolveFile) => {
                entry.file((file: File) => {
                  const newFile = new File([file], file.name, { type: file.type });
                  Object.defineProperty(newFile, 'webkitRelativePath', {
                    value: `${path}/${file.name}`,
                    writable: false
                  });
                  files.push(newFile);
                  console.log('Added file to array:', `${path}/${file.name}`);
                  resolveFile();
                });
              });
            } else if (entry.isDirectory) {
              await readDirectory(entry, `${path}/${entry.name}`, files);
            }
          }

          readEntries();
        });
      };

      readEntries();
    });
  };

  const handleDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const items = Array.from(e.dataTransfer.items);
    const allFiles: File[] = [];
    const folderEntries: any[] = [];

    console.log('Drop detected, items:', items.length);

    // First, identify all folders and standalone files
    for (const item of items) {
      if (item.kind === 'file') {
        const entry = (item as any).webkitGetAsEntry?.();
        if (entry) {
          console.log('Entry:', entry.name, 'isDirectory:', entry.isDirectory);
          if (entry.isDirectory) {
            folderEntries.push(entry);
          } else {
            const file = item.getAsFile();
            if (file) allFiles.push(file);
          }
        } else {
          const file = item.getAsFile();
          if (file) allFiles.push(file);
        }
      }
    }

    console.log('Found folders:', folderEntries.length);
    console.log('Folder names:', folderEntries.map(e => e.name));

    // Read each folder separately to preserve folder structure
    for (const folderEntry of folderEntries) {
      await readDirectory(folderEntry, folderEntry.name, allFiles);
    }

    console.log('Total files collected:', allFiles.length);
    console.log('Files:', allFiles.map(f => (f as any).webkitRelativePath || f.name));

    if (allFiles.length > 0) {
      processFiles(allFiles);
    }
  }, [processFiles]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget === e.target) {
      setIsDragging(false);
    }
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (selectedFiles && selectedFiles.length > 0) {
      processFiles(selectedFiles);
    }
    e.target.value = '';
  }, [processFiles]);

  const openFileDialog = useCallback(() => {
    if (fileInputRef.current) {
      fileInputRef.current.removeAttribute('webkitdirectory');
      fileInputRef.current.removeAttribute('directory');
      fileInputRef.current.click();
    }
  }, []);

  const openFolderDialog = useCallback(() => {
    if (fileInputRef.current) {
      fileInputRef.current.setAttribute('webkitdirectory', '');
      fileInputRef.current.setAttribute('directory', '');
      fileInputRef.current.click();
    }
  }, []);

  const removeItem = useCallback((index: number, childIndex?: number, type?: "file" | "folder") => {
    console.log(fileTree);
    if (type === "file") {
      const file = fileTree[index];
      const filteredChildren = file.children?.filter((_, idx) => idx !== childIndex);
      setFileTree(prev => prev.map(f => f === file ? { ...f, children: filteredChildren } : f));
    } else {
      setFileTree(prev => prev.filter((_, i) => i !== index));
    }
    setErrors([]);
  }, [fileTree]);

  const clearAll = useCallback(() => {
    setFileTree([]);
    setErrors([]);
  }, []);

  return {
    fileTree,
    isDragging,
    errors,
    fileInputRef,
    handleDrop,
    handleDragOver,
    handleDragEnter,
    handleDragLeave,
    handleFileInput,
    openFileDialog,
    openFolderDialog,
    removeItem,
    clearAll,
  };
}