import {
  createContext,
  use,
  useCallback,
  useRef,
  ReactNode,
  useState,
} from "react";
import useInitiateFileUpload from "../hooks/useFileInitiateFileUpload";
import { FileItem } from "@/components/FileUpload/types";
import { ChunkData } from "@/types/upload.types";
import { API, Slug } from "@/services"; 
import useGetFiles from "../hooks/useGetFiles";
import { UploadedFile } from "@/types/file.types";

export interface UploadQueueState {
  type: "file";
  name: string;
  file: File;
  size: number;
  path: string;
  percentage?: number;
  isPaused?: boolean;
  uploadId?: string;
  chunkSize?: number;
  totalChunks?: number;
  uploadedChunks?: number[];
  error?: string;
  lastActivity?: Date;
  fileHash?: string;
  status?:
    | "idle"
    | "initiating"
    | "uploading"
    | "completed"
    | "paused"
    | "cancelled"
    | "error";
}

// Types
interface ChunkedUploadContextValue {
  startUploading: (
    files: FileItem[],
    runWhenAnyChunkFails?: (error: string) => void,
  ) => Promise<void>;
  cancelAllUploads: () => void;
  pauseUpload: (positionIndex: number) => void;
  cancelCurrentUpload: (positionIndex: number) => void;
  setUploadQueue: (uploadQueue: UploadQueueState[]) => void;
  uploadQueue: UploadQueueState[];
  allFilesAndFolders: UploadedFile[];
  isLoading: boolean;
  refetchFilesAndFolders:()=>void
}

interface ChunkedUploadProviderProps {
  children: ReactNode;
  chunkSize?: number;
}

// Create Context
const ChunkedUploadContext = createContext<ChunkedUploadContextValue | null>(
  null,
);

// Provider Component
export function ChunkedUploadProvider({
  children,
  chunkSize = 5 * 1024 * 1024,
}: ChunkedUploadProviderProps) {
  const initiateUpload = useInitiateFileUpload(); 
  const uploadControllersRef = useRef<Map<number, AbortController>>(new Map());
  const isUploadingRef = useRef(false);
  const [uploadQueue, setUploadQueue] = useState<UploadQueueState[]>([]);
  const { data:allFilesAndFolders, isLoading, refetch:refetchFilesAndFolders } = useGetFiles();

  const splitFileIntoChunks = useCallback(
    (file: File): ChunkData[] => {
      const chunks: ChunkData[] = [];
      let offset = 0;
      let index = 0;

      while (offset < file.size) {
        const size = Math.min(chunkSize, file.size - offset);
        const blob = file.slice(offset, offset + size);

        chunks.push({ blob, index, size });
        offset += size;
        index++;
      }
      return chunks;
    },
    [chunkSize],
  );

  const startUploading = useCallback(
    async (
      files: FileItem[],
      runWhenAnyChunkFails?: (error: string) => void,
    ) => {
      isUploadingRef.current = true;
      let fileIndex = 0;

      for (const file of files) {
        const controller = new AbortController();
        uploadControllersRef.current.set(fileIndex, controller);

        // USE FUNCTIONAL UPDATE
        setUploadQueue((prev) =>
          prev.map((upload) => {
            if (upload.name === file.name) {
              return {
                ...upload,
                status: "initiating" as const,
              };
            }
            return upload;
          }),
        );

        try {
          const response = await initiateUpload.mutateAsync({
            fileName: file.name,
            fileSize: file.size,
          });

          const chunks = splitFileIntoChunks(file?.file);

          if (response?.uploadId) {
            let chunkIndex = 0;
            for (const chunk of chunks) {
              if (controller.signal.aborted) {
                break;
              }

              chunkIndex++;
              const formData = new FormData();
              formData.append("chunk", chunk.blob, file.name);
              formData.append("uploadId", response?.uploadId ?? "no-uuid");
              formData.append("chunkIndex", chunk.index.toString());
              formData.append("chunkSize", chunk.size.toString());

              const res = await API.post({
                slug: Slug.UPLOAD_CHUNK,
                body: formData,
                axiosConfig: {
                  signal: controller.signal,
                },
              });

              console.log("res", res);

              if (!res && runWhenAnyChunkFails) {
                runWhenAnyChunkFails(
                  `Failed to upload chunk ${chunkIndex} for file ${file.name}`,
                );
                break;
              } else if (res) {
                // USE FUNCTIONAL UPDATE
                setUploadQueue((prev) =>
                  prev.map((upload) => {
                    if (upload.name === file.name) {
                      return {
                        ...upload,
                        status:
                          chunkIndex === chunks.length
                            ? ("completed" as const)
                            : ("uploading" as const),
                        percentage: Math.round(
                          (chunkIndex / chunks.length) * 100,
                        ),
                      };
                    }
                    return upload;
                  }),
                );
              }
            }
          }
          refetchFilesAndFolders();
        } catch (error) {
          if (error instanceof Error && error.name === "AbortError") {
            console.log(`Upload cancelled for file at index ${fileIndex}`);
          } else {
            throw error;
          }
        } finally {
          uploadControllersRef.current.delete(fileIndex);
        }

        fileIndex++;
      }

      isUploadingRef.current = false;
    },
    [initiateUpload, refetchFilesAndFolders, splitFileIntoChunks], // REMOVE uploadQueue from dependencies
  );

  const cancelAllUploads = useCallback(() => {
    // Abort all active uploads
    uploadControllersRef.current.forEach((controller) => {
      controller.abort();
    });
    uploadControllersRef.current.clear();
    isUploadingRef.current = false;
    setUploadQueue([]);
    refetchFilesAndFolders();
  }, []);

  function cancelCurrentUpload(currentUploadIndexPosition: number) {
    const controller = uploadControllersRef.current.get(
      currentUploadIndexPosition,
    );
    if (controller) {
      controller.abort();
      uploadControllersRef.current.delete(currentUploadIndexPosition);

      setUploadQueue((prev) =>
        prev.map((upload, idx) => {
          if (idx === currentUploadIndexPosition) {
            return {
              ...upload,
              status: "cancelled" as const,
            };
          }
          return upload;
        }),
      );
    }
    refetchFilesAndFolders();

  }

  const pauseUpload = useCallback((positionIndex: number) => {
    const controller = uploadControllersRef.current.get(positionIndex);
    if (controller) {
      controller.abort();
      uploadControllersRef.current.delete(positionIndex);
    }

    setUploadQueue((prev) =>
      prev.map((upload, idx) => {
        if (idx === positionIndex) {
          return {
            ...upload,
            status: "paused" as const,
            isPaused: true,
          };
        }
        return upload;
      }),
    );
  }, []);

  const value: ChunkedUploadContextValue = {
    startUploading,
    cancelAllUploads,
    pauseUpload,
    cancelCurrentUpload,
    setUploadQueue,
    uploadQueue,
    allFilesAndFolders: allFilesAndFolders ?? [],
    isLoading,
    refetchFilesAndFolders
  };

  return <ChunkedUploadContext value={value}>{children}</ChunkedUploadContext>;
}

// Custom Hook using React 19's `use` hook
export function useChunkedUpload() {
  const context = use(ChunkedUploadContext);
  if (!context) {
    throw new Error(
      "useChunkedUpload must be used within a ChunkedUploadProvider",
    );
  }
  return context;
}

// Example Usage:
/*
// 1. Wrap your app or component tree with the provider:
<ChunkedUploadProvider chunkSize={5 * 1024 * 1024}>
  <YourApp />
</ChunkedUploadProvider>

// 2. Use the hook in any child component:
function UploadComponent() {
  const { startUploading, cancelUpload, pauseUpload } = useChunkedUpload();
  
  const handleUpload = async (files: FileItem[]) => {
    await startUploading(files, (error) => {
      console.error('Upload failed:', error);
    });
  };
  
  return (
    <div>
      <button onClick={() => handleUpload(files)}>Upload</button>
      <button onClick={cancelUpload}>Cancel</button>
      <button onClick={() => pauseUpload(0)}>Pause</button>
    </div>
  );
}
*/
