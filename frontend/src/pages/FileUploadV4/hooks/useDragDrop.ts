/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react';

interface UseDragAndDropOptions {
  onFilesDropped: (files: File[]) => void;
  enabled?: boolean;
}

export const useDragAndDrop = ({ onFilesDropped, enabled = true }: UseDragAndDropOptions) => {
  const [isDragging, setIsDragging] = useState(false); 

  useEffect(() => {
    if (!enabled) return;

    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      
      // setDragCounter(prev => prev + 1);
      
      if (e.dataTransfer?.items && e.dataTransfer.items.length > 0) {
        setIsDragging(true);
      }
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      
      // setDragCounter(prev => {
      //   const newCount = prev - 1;
      //   if (newCount === 0) {
      //     setIsDragging(false);
      //   }
      //   return newCount;
      // });
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    const handleDrop = async (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      
      setIsDragging(false);
      // setDragCounter(0);

      const files: File[] = [];
      const items = e.dataTransfer?.items;
console.log(" items>>>>>>>>>>>>>>>>", e)
      if (items) {
        // Process DataTransferItemList
        for (let i = 0; i < items.length; i++) {
          const item = items[i].webkitGetAsEntry();
          if (item) {
            await traverseFileTree(item, files);
          }
        }
      } else if (e.dataTransfer?.files) {
        // Fallback to files
        files.push(...Array.from(e.dataTransfer.files));
      }

      if (files.length > 0) {
        onFilesDropped(files);
      }
    };

    // Add event listeners to document
    document.addEventListener('dragenter', handleDragEnter);
    document.addEventListener('dragleave', handleDragLeave);
    document.addEventListener('dragover', handleDragOver);
    document.addEventListener('drop', handleDrop);

    // Cleanup
    return () => {
      document.removeEventListener('dragenter', handleDragEnter);
      document.removeEventListener('dragleave', handleDragLeave);
      document.removeEventListener('dragover', handleDragOver);
      document.removeEventListener('drop', handleDrop);
    };
  }, [enabled, onFilesDropped]);

  return { isDragging };
};

// Helper function to recursively traverse directory structure
async function traverseFileTree(item: any, files: File[], path = ''): Promise<void> {
  return new Promise((resolve) => {
    if (item.isFile) {
      item.file((file: File) => {
        // Create a new File object with the full path
        const newFile = new File([file], path + file.name, {
          type: file.type,
          lastModified: file.lastModified,
        });
        
        // Store the relative path as a property
        Object.defineProperty(newFile, 'webkitRelativePath', {
          value: path + file.name,
          writable: false,
        });
        
        files.push(newFile);
        resolve();
      });
    } else if (item.isDirectory) {
      const dirReader = item.createReader();
      dirReader.readEntries(async (entries: any[]) => {
        for (const entry of entries) {
          await traverseFileTree(entry, files, path + item.name + '/');
        }
        resolve();
      });
    } else {
      resolve();
    }
  });
}