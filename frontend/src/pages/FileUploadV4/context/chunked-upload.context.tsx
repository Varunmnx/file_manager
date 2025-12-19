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
import useFileGetStatus from "../hooks/useFileGetStatus";

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
  currentChunkProgress?: number; // Progress of current chunk (0-100)
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

interface ChunkedUploadContextValue {
  startUploading: (
    files: FileItem[],
    runWhenAnyChunkFails?: (error: string) => void,
  ) => Promise<void>;
  cancelAllUploads: () => void;
  pauseUpload: (positionIndex: number, uploadQueueItem: UploadQueueState, uploadId?:string) => void;
  cancelCurrentUpload: (positionIndex: number) => void;
  setUploadQueue: (uploadQueue: UploadQueueState[]) => void;
  uploadQueue: UploadQueueState[];
  allFilesAndFolders: UploadedFile[];
  isLoading: boolean;
  refetchFilesAndFolders: () => void;
}

interface ChunkedUploadProviderProps {
  children: ReactNode;
  chunkSize?: number;
}

const ChunkedUploadContext = createContext<ChunkedUploadContextValue | null>(
  null,
);

export function ChunkedUploadProvider({
  children,
  chunkSize = 5 * 1024 * 1024,
}: ChunkedUploadProviderProps) {
  const initiateUpload = useInitiateFileUpload();
  const getFileUploadState = useFileGetStatus() 
  const uploadControllersRef = useRef<Map<number, AbortController>>(new Map());
  const isUploadingRef = useRef(false); 
  const [uploadQueue, setUploadQueue] = useState<UploadQueueState[]>([]);
  const { data: allFilesAndFolders, isLoading, refetch: refetchFilesAndFolders } = useGetFiles();

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

  // Calculate overall progress including current chunk progress
  const calculateOverallProgress = useCallback(
    (completedChunks: number, totalChunks: number, currentChunkProgress: number) => {
      const completedPercentage = (completedChunks / totalChunks) * 100;
      const currentChunkPercentage = (currentChunkProgress / totalChunks);
      return Math.min(99, Math.round(completedPercentage + currentChunkPercentage));
    },
    []
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

        setUploadQueue((prev) =>
          prev.map((upload) => {
            if (upload.name === file.name) {
              return {
                ...upload,
                status: "initiating" as const,
                percentage: 0,
                currentChunkProgress: 0,
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
          const totalChunks = chunks.length;

          if (response?.uploadId) {
            let completedChunks = 0;

            for (const chunk of chunks) {
              if (controller.signal.aborted) {
                break;
              }

              const formData = new FormData();
              formData.append("chunk", chunk.blob, file.name);
              formData.append("uploadId", response?.uploadId ?? "no-uuid");
              formData.append("chunkIndex", chunk.index.toString());
              formData.append("chunkSize", chunk.size.toString());

              try {
                const res = await API.post({
                  slug: Slug.UPLOAD_CHUNK,
                  body: formData,
                  axiosConfig: {
                    signal: controller.signal,
                    onUploadProgress: (progressEvent) => {
                      const chunkProgress = progressEvent.total
                        ? Math.round((progressEvent.loaded / progressEvent.total) * 100)
                        : 0;

                      // Update progress with current chunk's upload progress
                      setUploadQueue((prev) =>
                        prev.map((upload) => {
                          if (upload.name === file.name) {
                            const overallProgress = calculateOverallProgress(
                              completedChunks,
                              totalChunks,
                              chunkProgress
                            );

                            return {
                              ...upload,
                              status: "uploading" as const,
                              percentage: overallProgress,
                              currentChunkProgress: chunkProgress,
                              totalChunks,
                              uploadedChunks: [completedChunks],
                            };
                          }
                          return upload;
                        }),
                      );
                    },
                  },
                });

                if (!res) {
                  if (runWhenAnyChunkFails) {
                    runWhenAnyChunkFails(
                      `Failed to upload chunk ${chunk.index + 1} for file ${file.name}`,
                    );
                  }
                  
                  setUploadQueue((prev) =>
                    prev.map((upload) => {
                      if (upload.name === file.name) {
                        return {
                          ...upload,
                          status: "error" as const,
                          error: `Failed at chunk ${chunk.index + 1}`,
                        };
                      }
                      return upload;
                    }),
                  );
                  break;
                }

                // Chunk completed successfully
                completedChunks++;

                setUploadQueue((prev) =>
                  prev.map((upload) => {
                    if (upload.name === file.name) {
                      const isComplete = completedChunks === totalChunks;
                      return {
                        ...upload,
                        status: isComplete ? ("completed" as const) : ("uploading" as const),
                        percentage: isComplete ? 100 : calculateOverallProgress(
                          completedChunks,
                          totalChunks,
                          0
                        ),
                        currentChunkProgress: 0,
                        uploadedChunks: [completedChunks],
                      };
                    }
                    return upload;
                  }),
                );

              } catch (chunkError) {
                if (chunkError instanceof Error && chunkError.name === "AbortError") {
                  console.log(`Chunk upload cancelled for file: ${file.name}`);
                  break;
                }
                
                console.error(`Error uploading chunk ${chunk.index}:`, chunkError);
                
                if (runWhenAnyChunkFails) {
                  runWhenAnyChunkFails(
                    `Error uploading chunk ${chunk.index + 1}: ${chunkError instanceof Error ? chunkError.message : 'Unknown error'}`
                  );
                }

                setUploadQueue((prev) =>
                  prev.map((upload) => {
                    if (upload.name === file.name) {
                      return {
                        ...upload,
                        status: "error" as const,
                        error: chunkError instanceof Error ? chunkError.message : 'Upload failed',
                      };
                    }
                    return upload;
                  }),
                );
                break;
              }
            }
          }
          
          refetchFilesAndFolders();
        } catch (error) {
          if (error instanceof Error && error.name === "AbortError") {
            console.log(`Upload cancelled for file at index ${fileIndex}`);
          } else {
            console.error(`Error initiating upload:`, error);
            setUploadQueue((prev) =>
              prev.map((upload) => {
                if (upload.name === file.name) {
                  return {
                    ...upload,
                    status: "error" as const,
                    error: error instanceof Error ? error.message : 'Failed to initiate upload',
                  };
                }
                return upload;
              }),
            );
          }
        } finally {
          uploadControllersRef.current.delete(fileIndex);
        }

        fileIndex++;
      }

      isUploadingRef.current = false;
    },
    [initiateUpload, refetchFilesAndFolders, splitFileIntoChunks, calculateOverallProgress],
  );

  const cancelAllUploads = useCallback(() => {
    uploadControllersRef.current.forEach((controller) => {
      controller.abort();
    });
    uploadControllersRef.current.clear();
    isUploadingRef.current = false;
    setUploadQueue([]);
    refetchFilesAndFolders();
  }, [refetchFilesAndFolders]);

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
    delete
    refetchFilesAndFolders();
  }


  async function resumeUpload(uploadQueueItem:UploadQueueState, uploadId:string) {
       const currentFileUploadState = await getFileUploadState.mutateAsync(uploadId)
  }

  const pauseUpload = useCallback((positionIndex: number,uploadQueueItem:UploadQueueState, uploadId?:string) => {
    const controller = uploadControllersRef.current.get(positionIndex);
    if (controller) {
      controller.abort();
      uploadControllersRef.current.delete(positionIndex);
    }

    setUploadQueue((prev) =>
      prev.map((upload, idx) => {
        if (idx === positionIndex) {
          if(upload.status == "paused"){
               resumeUpload(uploadQueueItem,uploadId)
          }
          return {
            ...upload,
            status: upload.status === "paused" ? "uploading" : "paused" as const,
            isPaused: !upload.isPaused,
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

export function useChunkedUpload() {
  const context = use(ChunkedUploadContext);
  if (!context) {
    throw new Error(
      "useChunkedUpload must be used within a ChunkedUploadProvider",
    );
  }
  return context;
}