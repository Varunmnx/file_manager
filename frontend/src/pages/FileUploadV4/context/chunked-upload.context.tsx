/* eslint-disable react-hooks/exhaustive-deps */
import React, {
  createContext,
  use,
  useCallback,
  useRef,
  ReactNode,
  useState,
  useEffect,
} from "react";
import useInitiateFileUpload from "../hooks/useFileInitiateFileUpload";
import { FileItem, FolderItem } from "@/components/FileUpload/types";
import { ChunkData } from "@/types/upload.types";
import { API, Slug } from "@/services";
import useGetFiles from "../hooks/useGetFiles";
import { UploadedFile } from "@/types/file.types";
import useFileGetStatus from "../hooks/useFileGetStatus";
import { useParams } from "react-router-dom";
import usePauseUpload from "../hooks/usePauseUpload";
import useDeleteAll from "../hooks/useDeleteAll";

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

export interface FileItemWithParentId extends FileItem {
  parentId?: string[];
}

interface ChunkedUploadContextValue {
  startUploading: (
    files: FileItemWithParentId[],
    runWhenAnyChunkFails?: (error: string) => void 
  ) => Promise<void>;
  cancelAllUploads: () => void;
  pauseUpload: (uploadQueueItem: UploadQueueState) => void;
  cancelCurrentUpload: (uploadId: string) => void;
  setUploadQueue: React.Dispatch<React.SetStateAction<UploadQueueState[]>>;
  uploadQueue: UploadQueueState[];
  allFilesAndFolders: UploadedFile[];
  isLoading: boolean;
  refetchFilesAndFolders: () => void;
  folderList: FolderItem[];
  setFolderList: React.Dispatch<React.SetStateAction<FolderItem[]>>;
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
  const getFileUploadState = useFileGetStatus();
  const { folderId } = useParams();
  // const uploadControllersRef = useRef<Map<number, AbortController>>(new Map());
  const currentUploadAbortController = useRef<AbortController | null>(null);
  const isUploadingRef = useRef(false);
  const [uploadQueue, setUploadQueue] = useState<UploadQueueState[]>([]);
  const [folderList,setFolderList] = useState<FolderItem[]>([]);
  const {
    data: allFilesAndFolders,
    isLoading,
    refetch: refetchFilesAndFolders,
  } = useGetFiles(folderId);
  const pauseUploadMutation = usePauseUpload();
  const deleteFileFolderMutation = useDeleteAll();

  useEffect(() => {
    refetchFilesAndFolders();
  }, [folderId]);

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
    (
      completedChunks: number,
      totalChunks: number,
      currentChunkProgress: number,
    ) => {
      const completedPercentage = (completedChunks / totalChunks) * 100;
      const currentChunkPercentage = currentChunkProgress / totalChunks;
      return Math.min(
        99,
        Math.round(completedPercentage + currentChunkPercentage),
      );
    },
    [],
  );

  const startUploading = useCallback(
    async (
      files: FileItemWithParentId[],
      runWhenAnyChunkFails?: (error: string) => void
    ) => {
      isUploadingRef.current = true;

      for (const file of files) {
        const controller = new AbortController();
        currentUploadAbortController.current = controller;

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
            parent: file.parentId,
          });

          if(!response?.uploadId){
           return setUploadQueue((prev) => {
              return prev.filter(upload=>upload.name !== file.name);
            })
          }

          setUploadQueue((prev) => {
            return prev.map((upload) => {
              if (upload.name === file.name) {
                return {
                  ...upload,
                  uploadId: response?.uploadId,
                };
              }
              return upload;
            });
          });

          const chunks = splitFileIntoChunks(file?.file);
          const totalChunks = chunks.length;

          if (response?.uploadId) {
            let completedChunks = 0;

            for (const chunk of chunks) {
              if (currentUploadAbortController.current.signal.aborted) {
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
                    signal: currentUploadAbortController.current.signal,
                    onUploadProgress: (progressEvent) => {
                      const chunkProgress = progressEvent.total
                        ? Math.round(
                            (progressEvent.loaded / progressEvent.total) * 100,
                          )
                        : 0;

                      setUploadQueue((prev) =>
                        prev.map((upload) => {
                          // **FIX: Don't update if already cancelled**
                          if (
                            upload.name === file.name &&
                            upload.status !== "cancelled"
                          ) {
                            const overallProgress = calculateOverallProgress(
                              completedChunks,
                              totalChunks,
                              chunkProgress,
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
                        status: isComplete
                          ? ("completed" as const)
                          : ("uploading" as const),
                        percentage: isComplete
                          ? 100
                          : calculateOverallProgress(
                              completedChunks,
                              totalChunks,
                              0,
                            ),
                        currentChunkProgress: 0,
                        uploadedChunks: [completedChunks],
                      };
                    }
                    return upload;
                  }),
                );
              } catch (chunkError) {
                if (
                  chunkError instanceof Error &&
                  chunkError.name === "AbortError"
                ) {
                  console.log(`Chunk upload cancelled for file: ${file.name}`);
                  break;
                }

                console.error(
                  `Error uploading chunk ${chunk.index}:`,
                  chunkError,
                );

                if (runWhenAnyChunkFails) {
                  runWhenAnyChunkFails(
                    `Error uploading chunk ${chunk.index + 1}: ${chunkError instanceof Error ? chunkError.message : "Unknown error"}`,
                  );
                }

                setUploadQueue((prev) =>
                  prev.map((upload) => {
                    if (upload.name === file.name) {
                      return {
                        ...upload,
                        status: (chunkError as any).config.signal.reason == "paused"?"paused":"error" as const,
                        error:
                          chunkError instanceof Error
                            ? chunkError.message
                            : "Upload failed",
                      };
                    }
                    return upload;
                  }),
                );
                break;
              }
            }
          }

        } catch (chunkError) {
          if (chunkError) {
            console.log(`Chunk upload cancelled for file: ${file.name}`);
            // **FIX: Check if this file should be marked as cancelled**
            setUploadQueue((prev) =>
              prev.map((upload) => {
                if (
                  upload.name === file.name &&
                  upload.status !== "cancelled"
                ) {
                  return {
                    ...upload,
                    status:  (chunkError as any).config.signal.reason == "paused"?"paused":"error" as const,
                  };
                }
                return upload;
              }),
            );
            break;
          }
        } finally {
          currentUploadAbortController.current = null;
          refetchFilesAndFolders();
        }
      }

      isUploadingRef.current = false;
    },
    [
      initiateUpload,
      refetchFilesAndFolders,
      splitFileIntoChunks,
      calculateOverallProgress,
    ],
  );

  const cancelAllUploads = useCallback(() => {
    currentUploadAbortController.current?.abort();
    currentUploadAbortController.current = null;
    isUploadingRef.current = false;
    setUploadQueue(prev=>prev.map(upload => ({...upload, status: "cancelled"})));
    refetchFilesAndFolders();
  }, [refetchFilesAndFolders]);

  function cancelCurrentUpload(uploadId: string) {
    // **FIX: Set status to cancelled FIRST**
    setUploadQueue((prev) =>
      prev.map((upload) => {
        if (upload?.uploadId === uploadId) {
          return {
            ...upload,
            status: "cancelled" as const,
          };
        }
        return upload;
      })
    );

    const controller = currentUploadAbortController.current;
    console.log(controller);
    if (controller) {
      controller.abort();
      currentUploadAbortController.current = null;
    }

    if (uploadId) {
      deleteFileFolderMutation.mutate(
        { uploadIds: [uploadId] },
        {
          onSuccess: () => {
            console.log("deleted");
            refetchFilesAndFolders();
          },
        },
      );
    }
  }

  async function resumeUpload(
    uploadQueueItem: UploadQueueState,
    currentFileUploadState: UploadedFile,
  ) {
    const uploadedChunkIndices = currentFileUploadState?.uploadedChunks || [];
    const chunks = splitFileIntoChunks(uploadQueueItem.file);
    const file = uploadQueueItem.file;

    // **FIX: Find the next chunk to upload**
    const completedChunks = uploadedChunkIndices.length;

    // Create a Set for faster lookup
    const uploadedSet = new Set(uploadedChunkIndices);

    for (let i = 0; i < chunks.length; i++) {
      // **FIX: Skip already uploaded chunks**
      if (uploadedSet.has(i)) {
        continue;
      }

      const chunk = chunks[i];
      const controller = new AbortController();
      currentUploadAbortController.current = controller;

      try {
        const formData = new FormData();
        formData.append("chunk", chunk.blob, file.name);
        formData.append("uploadId", uploadQueueItem?.uploadId ?? "no-uuid");
        formData.append("chunkIndex", chunk.index.toString());
        formData.append("chunkSize", chunk.size.toString());

        const res = await API.post({
          slug: Slug.UPLOAD_CHUNK,
          body: formData,
          axiosConfig: {
            signal: currentUploadAbortController.current.signal,
            onUploadProgress: (progressEvent) => {
              const chunkProgress = progressEvent.total
                ? Math.round((progressEvent.loaded / progressEvent.total) * 100)
                : 0;

              setUploadQueue((prev) =>
                prev.map((upload) => {
                  if (upload.name === file.name) {
                    const overallProgress = calculateOverallProgress(
                      completedChunks + (i - completedChunks), // Current position in upload
                      chunks.length,
                      chunkProgress,
                    );

                    return {
                      ...upload,
                      status: "uploading" as const,
                      percentage: overallProgress,
                      currentChunkProgress: chunkProgress,
                      totalChunks: chunks.length,
                      uploadedChunks: uploadedChunkIndices,
                    };
                  }
                  return upload;
                }),
              );
            },
          },
        });

        if (!res) {
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

        // **FIX: Add to uploaded set and array**
        uploadedSet.add(i);
        uploadedChunkIndices.push(i);

        setUploadQueue((prev) =>
          prev.map((upload) => {
            if (upload.name === file.name) {
              const isComplete = uploadedChunkIndices.length === chunks.length;
              return {
                ...upload,
                status: isComplete
                  ? ("completed" as const)
                  : ("uploading" as const),
                percentage: isComplete
                  ? 100
                  : calculateOverallProgress(
                      uploadedChunkIndices.length,
                      chunks.length,
                      0,
                    ),
                currentChunkProgress: 0,
                uploadedChunks: uploadedChunkIndices,
              };
            }
            return upload;
          }),
        );
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          console.log(`Upload cancelled for chunk at index ${i}`);
        } else {
          console.error(`Error initiating upload:`, error);
        }
      } finally {
        // uploadControllersRef.current.delete(i);
      }
    }
  }

  const pauseUpload = useCallback(
    async (uploadQueueItem: UploadQueueState) => {
      setUploadQueue((prev) =>
        prev.map((upload) => {
          if (upload.uploadId === uploadQueueItem.uploadId) {
            return {
              ...upload,
              status: upload.isPaused ? "uploading" : ("paused" as const),
              isPaused: !upload.isPaused,
            };
          }
          return upload;
        }),
      );
      const controller = currentUploadAbortController.current;

      if (controller) {
        controller.abort("paused");
        currentUploadAbortController.current = null;
      }

      const response = await getFileUploadState.mutateAsync(
        uploadQueueItem.uploadId as string,
      );

      if (uploadQueueItem.isPaused && uploadQueueItem.uploadId) {
        pauseUploadMutation.mutate(
          {
            uploadId: uploadQueueItem.uploadId as string,
            chunkIndex:
              response?.uploadedChunks[response?.uploadedChunks.length - 1] ??
              0,
          },
          {
            onSuccess: () => {
              resumeUpload(uploadQueueItem, response as UploadedFile);
            },
          },
        );
      }
    },
    [resumeUpload],
  );

  const value: ChunkedUploadContextValue = {
    startUploading,
    cancelAllUploads,
    pauseUpload,
    cancelCurrentUpload,
    setUploadQueue,
    uploadQueue,
    allFilesAndFolders: allFilesAndFolders ?? [],
    isLoading,
    refetchFilesAndFolders,
    folderList,
    setFolderList
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
