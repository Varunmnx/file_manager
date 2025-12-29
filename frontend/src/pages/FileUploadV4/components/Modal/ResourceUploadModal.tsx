/* eslint-disable react-hooks/exhaustive-deps */
import Dropzone from "@/components/FileUpload";
import {
  FileItem,
  FileTreeItem,
  FolderItem,
} from "@/components/FileUpload/types";
import { Modal } from "@mantine/core";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import {
  FileItemWithParentId,
  UploadQueueState,
  useChunkedUpload,
} from "../../context/chunked-upload.context";
import { useParams } from "react-router-dom";
import useCreateFolder from "../../hooks/createFolder"; 

interface Props {
  opened: boolean;
  close: () => void;
  initialFiles?: File[];
}

const ResourceUploadModal = ({ opened, close, initialFiles = [] }: Props) => {
  const { startUploading, setUploadQueue } = useChunkedUpload();
  const params = useParams();
  const folderId = params?.folderId;
  const createFolderMutation = useCreateFolder();
  const [isLoading, setIsLoading] = useState(false);
  const [folderPathAgainstFiles] = useState<
    Map<string, Set<FileItem>>
  >(new Map());

  const onDropCallback = useCallback((files: File[], tree: FileTreeItem[]) => {
    console.log("Files dropped:", files);
    console.log("File tree:", tree);
  }, []);

  const runWhenAnyChunkFails = useCallback((error: string) => {
    toast.error(error);
  }, []);

  const groupFilesByPath = (files: FileItem[]): Map<string, FileItem[]> => {
    const pathMap = new Map<string, FileItem[]>();
    
    files.forEach((file) => {
      const pathParts = file.path.split("/");
      const folderPath = pathParts.slice(0, -1).join("/");
      
      const existingFiles = pathMap.get(folderPath) || [];
      pathMap.set(folderPath, [...existingFiles, {...file, name: file.path}]);
    });
    
    return pathMap;
  };

  /**
   * Creates a unique folder key for tracking created folders
   */
  const createFolderKey = (folderName: string, depth: number): string => {
    return `${folderName}__${depth}`;
  };

  /**
   * Processes folder structure and uploads files to appropriate parent folders
   */
  interface FolderMetadata {
    parentId: string;
    depth: number;
  }
  
  const processFolders = async (
    files: FileItem[],
    rootParentId: string,
    rootParentName: string
  ): Promise<FileItemWithParentId[]> => {
    const pathToFilesMap = groupFilesByPath(files);
    const folderPaths = Array.from(pathToFilesMap.keys());
    
    // Track created folders by their name and depth to avoid duplicates
    const createdFolders = new Map<string, FolderMetadata>();
    const filesWithParentIds: FileItemWithParentId[] = [];

    if (rootParentName) {
      createdFolders.set(createFolderKey(rootParentName, 0), {
        depth: 0,
        parentId: rootParentId,
      });
    }

    // Process each unique folder path
    for (const folderPath of folderPaths) {
      const folderNames = folderPath.split("/").filter(name => name.trim() !== "");
      let currentParentId = rootParentId;

      // Create nested folder structure
      for (let depth = 0; depth < folderNames.length; depth++) {
        const folderName = folderNames[depth];
        const folderKey = createFolderKey(folderName, depth);

        // Check if folder already created at this depth
        if (createdFolders.has(folderKey)) {
          const metadata = createdFolders.get(folderKey)!;
          currentParentId = metadata.parentId;
          continue;
        }

        // Create new folder
        try {
          const response = await createFolderMutation.mutateAsync({
            folderName,
            parent: currentParentId,
            folderSize: 0,
          });

          if (response?.uploadId) {
            createdFolders.set(folderKey, {
              depth,
              parentId: response.uploadId,
            });
            currentParentId = response.uploadId;
          } else {
            throw new Error(`Failed to create folder: ${folderName}`);
          }
        } catch (error) {
          console.error(`Error creating folder ${folderName}:`, error);
          throw error;
        }
      }

      // Assign parent ID to all files in this path
      const filesInPath = pathToFilesMap.get(folderPath) || [];
      filesInPath.forEach((file) => {
        if (currentParentId) {
          filesWithParentIds.push({
            ...file,
            parentId: [currentParentId],
          });
        } else {
          filesWithParentIds.push({
            ...file 
          });
        }
      });
    }

    return filesWithParentIds;
  };

  const onStartUpload = useCallback(
    async (tree: FileTreeItem[]) => {
      setIsLoading(true);
      let uploadQueueState: UploadQueueState[] = [];
      const files: FileItemWithParentId[] = [];
      
      for (let i = 0; i < tree.length; i++) {
        const rootORFolder = tree[i] as FileTreeItem;
        if (rootORFolder.type === "root" && rootORFolder.children.length > 0) {
          const filesWithIsPaused = rootORFolder?.children?.map((item) => ({
            ...item,
            isPaused: false,
            status: "idle" as
              | "idle"
              | "initiating"
              | "uploading"
              | "completed"
              | "paused"
              | "cancelled"
              | "error",
          }));
          uploadQueueState = filesWithIsPaused;
          
          if (folderId) {
            files.push(...rootORFolder.children?.map((item) => ({ 
              ...item, 
              parentId: [folderId as string] 
            } as FileItemWithParentId)));
          } else {
            // eslint-disable-next-line no-unsafe-optional-chaining
            files.push(...rootORFolder.children?.map((item) => ({ 
              ...item 
            } as FileItemWithParentId)));
          }

          setUploadQueue(uploadQueueState);
        } else {
          const data = await createFolderMutation.mutateAsync({
            folderName: (rootORFolder as FolderItem).name,
            parent: folderId,
            folderSize: 0,
          });
          
          if (data?.uploadId) {
            console.log("folder created");
            const processedFoldersWithFiles = await processFolders(
              rootORFolder.children, 
              data?.uploadId as string,
              (rootORFolder as FolderItem).name
            );
            files.push(...processedFoldersWithFiles);
            const uploadQueueState = processedFoldersWithFiles.map((file) => ({
              ...file,
              isPaused: false,
              status: "idle" as
                | "idle"
                | "initiating"
                | "uploading"
                | "completed"
                | "paused"
                | "cancelled"
                | "error",
            }));
            setUploadQueue(uploadQueueState);
          } else {
            toast.error("Failed to create folder");
          }
        }
      }

      console.log("files", files);
      setTimeout(
        () => startUploading(files, runWhenAnyChunkFails),
        500,
      );
     
      folderPathAgainstFiles.clear();
      close();
    },
    [close, createFolderMutation, folderId, folderPathAgainstFiles, processFolders, setUploadQueue],
  );

  return (
    <Modal
      size={"xl"}
      opened={opened}
      onClose={close}
      title="Upload Resource"
      centered
    >
      {/* Modal content */}
      <Dropzone
        maxFiles={100}
        isLoading={isLoading}
        maxSize={1000 * 1024 * 1024}
        onUpload={onStartUpload}
        onDrop={onDropCallback}
        initialFiles={initialFiles}
      />
    </Modal>
  );
};

export default ResourceUploadModal;