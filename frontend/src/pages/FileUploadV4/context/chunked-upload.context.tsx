/* eslint-disable @typescript-eslint/no-explicit-any */
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
import { useQueryClient } from "@tanstack/react-query";
import useDeleteAll from "../hooks/useDeleteAll";
import {
  persistUpload,
  updatePersistedUpload,
  removePersistedUpload,
} from "../utils/upload-persistence";

export interface UploadQueueState {
  type: "file";
  name: string;
  file: File;
  size: number;
  path: string;
  percentage?: number;
  isPaused?: boolean;
  _id?: string;
  chunkSize?: number;
  totalChunks?: number;
  uploadedChunks?: number[];
  currentChunkProgress?: number;
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
  pauseUpload: (uploadQueueItem: UploadQueueState) => Promise<void>;
  cancelCurrentUpload: (_id: string) => void;
  setUploadQueue: React.Dispatch<React.SetStateAction<UploadQueueState[]>>;
  uploadQueue: UploadQueueState[];
  allFilesAndFolders: UploadedFile[];
  isLoading: boolean;
  refetchFilesAndFolders: () => void;
  folderList: FolderItem[];
  setFolderList: React.Dispatch<React.SetStateAction<FolderItem[]>>;
  fileDetails: UploadedFile | undefined;
  setFileDetails: React.Dispatch<React.SetStateAction<UploadedFile | undefined>>;
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
  const currentUploadAbortController = useRef<AbortController | null>(null);
  const isUploadingRef = useRef(false);
  const [uploadQueue, setUploadQueue] = useState<UploadQueueState[]>([]);
  const [folderList, setFolderList] = useState<FolderItem[]>([]);
  const [fileDetails, setFileDetails] = useState<UploadedFile>();
  const {
    data: allFilesAndFolders,
    isLoading,
    refetch: refetchFilesAndFolders,
  } = useGetFiles(folderId);
  const pauseUploadMutation = usePauseUpload();
  const deleteFileFolderMutation = useDeleteAll();
  const queryClient = useQueryClient();

  useEffect(() => {
    refetchFilesAndFolders();
  }, [folderId]);

  // Warn user before closing/refreshing if uploads are in progress
  useEffect(() => {
    const hasActiveUploads = uploadQueue.some(
      u => u.status === "uploading" || u.status === "initiating" || u.status === "paused" || u.status === "idle"
    );

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasActiveUploads) {
        e.preventDefault();
        e.returnValue = "You have uploads in progress. Are you sure you want to leave?";
        return e.returnValue;
      }
    };

    if (hasActiveUploads) {
      window.addEventListener("beforeunload", handleBeforeUnload);
    }

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [uploadQueue]);

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

  const resumeUpload = useCallback(
    async (
      uploadQueueItem: UploadQueueState,
      currentFileUploadState: UploadedFile,
    ) => {
      const uploadedChunkIndices = [...(currentFileUploadState?.uploadedChunks || [])];
      const chunks = splitFileIntoChunks(uploadQueueItem.file);
      const file = uploadQueueItem.file;

      const uploadedSet = new Set(uploadedChunkIndices);

      // Check if all chunks are already uploaded (can happen if pause occurred right after last chunk completed)
      if (uploadedChunkIndices.length === chunks.length) {
        console.log(`All chunks already uploaded for file: ${file.name}, marking as complete`);
        setUploadQueue((prev) =>
          prev.map((upload) => {
            if (upload.name === file.name && upload.status !== "cancelled") {
              return {
                ...upload,
                status: "completed" as const,
                isPaused: false,
                percentage: 100,
                uploadedChunks: [...uploadedChunkIndices],
              };
            }
            return upload;
          }),
        );
        refetchFilesAndFolders();
        queryClient.invalidateQueries({ queryKey: ["storage-info"] });
        return;
      }

      for (let i = 0; i < chunks.length; i++) {
        if (uploadedSet.has(i)) {
          continue;
        }

        const chunk = chunks[i];
        const controller = new AbortController();
        currentUploadAbortController.current = controller;

        try {
          const formData = new FormData();
          formData.append("chunk", chunk.blob, file.name);
          formData.append("uploadId", uploadQueueItem?._id ?? "no-uuid");
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
                    if (upload.name === file.name && upload.status !== "cancelled") {
                      const overallProgress = calculateOverallProgress(
                        uploadedChunkIndices.length,
                        chunks.length,
                        chunkProgress,
                      );

                      return {
                        ...upload,
                        status: "uploading" as const,
                        isPaused: false,
                        percentage: overallProgress,
                        currentChunkProgress: chunkProgress,
                        totalChunks: chunks.length,
                        uploadedChunks: [...uploadedChunkIndices],
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

          uploadedSet.add(i);
          uploadedChunkIndices.push(i);

          setUploadQueue((prev) =>
            prev.map((upload) => {
              if (upload.name === file.name && upload.status !== "cancelled") {
                const isComplete = uploadedChunkIndices.length === chunks.length;
                return {
                  ...upload,
                  status: isComplete ? ("completed" as const) : ("uploading" as const),
                  isPaused: false,
                  percentage: isComplete
                    ? 100
                    : calculateOverallProgress(uploadedChunkIndices.length, chunks.length, 0),
                  currentChunkProgress: 0,
                  uploadedChunks: [...uploadedChunkIndices],
                };
              }
              return upload;
            }),
          );

          if (uploadedChunkIndices.length === chunks.length) {
            refetchFilesAndFolders();
            queryClient.invalidateQueries({ queryKey: ["storage-info"] });
            break;
          }

        } catch (error) {
          // Check if this was a pause action (AbortController with "paused" reason)
          const abortReason = currentUploadAbortController.current?.signal?.reason;
          const isPausedAbort = abortReason === "paused";

          // Check for both DOMException AbortError and Axios CanceledError
          const isAbortError =
            (error instanceof DOMException && error.name === "AbortError") ||
            (error instanceof Error && error.name === "CanceledError") ||
            (error instanceof Error && (error as any).code === "ERR_CANCELED");

          if (isAbortError && isPausedAbort) {
            console.log(`Upload paused for chunk at index ${i}`);
            // Don't change status here - pauseUpload already handles this
          } else if (isAbortError) {
            console.log(`Upload cancelled for chunk at index ${i}`);
            // Cancelled by user - status is handled by cancelCurrentUpload
          } else {
            console.error(`Error uploading chunk:`, error);
            setUploadQueue((prev) =>
              prev.map((upload) => {
                if (upload.name === file.name) {
                  return {
                    ...upload,
                    status: "error" as const,
                    isPaused: false,
                    error: error instanceof Error ? error.message : "Upload failed",
                  };
                }
                return upload;
              }),
            );
          }
          break;
        }
      }

      // Final check: ensure completion status is set if all chunks were uploaded
      // This handles edge cases where the loop might exit without setting completion
      if (uploadedChunkIndices.length === chunks.length) {
        setUploadQueue((prev) =>
          prev.map((upload) => {
            if (upload.name === file.name && upload.status !== "cancelled" && upload.status !== "completed") {
              return {
                ...upload,
                status: "completed" as const,
                isPaused: false,
                percentage: 100,
                uploadedChunks: [...uploadedChunkIndices],
              };
            }
            return upload;
          }),
        );
        refetchFilesAndFolders();
        queryClient.invalidateQueries({ queryKey: ["storage-info"] });
      }
    },
    [splitFileIntoChunks, calculateOverallProgress, refetchFilesAndFolders, queryClient],
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

          if (!response?.uploadId) {
            return setUploadQueue((prev) => {
              return prev.filter(upload => upload.name !== file.name);
            });
          }

          setUploadQueue((prev) => {
            return prev.map((upload) => {
              if (upload.name === file.name) {
                return {
                  ...upload,
                  _id: response?.uploadId,
                };
              }
              return upload;
            });
          });

          const chunks = splitFileIntoChunks(file?.file);
          const totalChunks = chunks.length;

          if (response?.uploadId) {
            // Persist upload info for resume capability
            persistUpload({
              uploadId: response.uploadId,
              fileName: file.name,
              fileSize: file.size,
              totalChunks,
              uploadedChunks: [],
              parentId: file.parentId?.[0],
              chunkSize,
              timestamp: Date.now(),
              originalPath: file.path,
            });

            let completedChunks = 0;
            console.log("chunks", chunks);

            for (const chunk of chunks) {
              if (currentUploadAbortController.current.signal.aborted) {
                break;
              }

              const formData = new FormData();
              console.log("chunk", chunk);
              formData.append("chunk", chunk.blob, file.name);
              formData.append("uploadId", response?.uploadId ?? "no-uuid");
              formData.append("chunkIndex", chunk.index.toString());
              formData.append("chunkSize", chunk.size.toString());

              try {
                const res = await API.post({
                  slug: Slug.UPLOAD_CHUNK,
                  body: formData,
                  axiosConfig: {
                    headers: {
                      "Content-Type": "multipart/form-data",
                    },
                    signal: currentUploadAbortController.current.signal,

                    onUploadProgress: (progressEvent) => {
                      const chunkProgress = progressEvent.total
                        ? Math.round(
                          (progressEvent.loaded / progressEvent.total) * 100,
                        )
                        : 0;

                      setUploadQueue((prev) =>
                        prev.map((upload) => {
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

                completedChunks++;

                // Update persistence with current chunk progress
                const uploadedChunksList = Array.from({ length: completedChunks }, (_, i) => i);
                const isComplete = completedChunks === totalChunks;

                if (isComplete && response?.uploadId) {
                  // Upload complete - remove from persistence
                  removePersistedUpload(response.uploadId);
                } else if (response?.uploadId) {
                  // Update persistence with progress
                  updatePersistedUpload(response.uploadId, uploadedChunksList);
                }

                setUploadQueue((prev) =>
                  prev.map((upload) => {
                    if (upload.name === file.name && upload.status !== "cancelled") {
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
                // Check if this was a pause action
                const abortReason = currentUploadAbortController.current?.signal?.reason;
                const isPausedAbort = abortReason === "paused";

                // Check for both DOMException AbortError and Axios CanceledError
                const isAbortError =
                  (chunkError instanceof DOMException && chunkError.name === "AbortError") ||
                  (chunkError instanceof Error && chunkError.name === "CanceledError") ||
                  (chunkError instanceof Error && (chunkError as any).code === "ERR_CANCELED");

                if (isAbortError) {
                  if (isPausedAbort) {
                    console.log(`Chunk upload paused for file: ${file.name}`);
                  } else {
                    console.log(`Chunk upload cancelled for file: ${file.name}`);
                  }
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
                        status: "error" as const,
                        isPaused: false,
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

        } catch (error) {
          // Check if this was a pause or cancel action
          const abortReason = currentUploadAbortController.current?.signal?.reason;
          const isPausedAbort = abortReason === "paused";

          // Check for abort errors (DOMException or Axios CanceledError)
          const isAbortError =
            (error instanceof DOMException && error.name === "AbortError") ||
            (error instanceof Error && error.name === "CanceledError") ||
            (error instanceof Error && (error as any).code === "ERR_CANCELED");

          if (isAbortError && isPausedAbort) {
            console.log(`Upload paused for file: ${file.name}`);
            // Don't set error state for paused uploads
          } else if (isAbortError) {
            console.log(`Upload cancelled for file: ${file.name}`);
            // Don't set error state for cancelled uploads
          } else if (error) {
            console.log(`Upload error for file: ${file.name}`, error);
            setUploadQueue((prev) =>
              prev.map((upload) => {
                if (
                  upload.name === file.name &&
                  upload.status !== "cancelled" &&
                  upload.status !== "paused"
                ) {
                  return {
                    ...upload,
                    status: "error" as const,
                    isPaused: false,
                    error: error instanceof Error ? error.message : "Upload failed",
                  };
                }
                return upload;
              }),
            );
          }
        } finally {
          currentUploadAbortController.current = null;
          refetchFilesAndFolders();
          queryClient.invalidateQueries({ queryKey: ["storage-info"] });
        }
      }

      isUploadingRef.current = false;
    },
    [
      initiateUpload,
      refetchFilesAndFolders,
      splitFileIntoChunks,
      calculateOverallProgress,
      queryClient,
    ],
  );

  const cancelAllUploads = useCallback(() => {
    currentUploadAbortController.current?.abort();
    currentUploadAbortController.current = null;
    isUploadingRef.current = false;
    setUploadQueue(prev => prev.map(upload => ({ ...upload, status: "cancelled" as const })));
    refetchFilesAndFolders();
  }, [refetchFilesAndFolders]);

  const cancelCurrentUpload = useCallback((_id: string) => {
    setUploadQueue((prev) =>
      prev.map((upload) => {
        if (upload?._id === _id) {
          return {
            ...upload,
            status: "cancelled" as const,
          };
        }
        return upload;
      })
    );

    // Remove from persistence
    if (_id) {
      removePersistedUpload(_id);
    }

    const controller = currentUploadAbortController.current;
    console.log(controller);
    if (controller) {
      controller.abort();
      currentUploadAbortController.current = null;
    }

    if (_id) {
      deleteFileFolderMutation.mutate(
        { uploadIds: [_id] },
        {
          onSuccess: () => {
            console.log("deleted");
            refetchFilesAndFolders();
          },
        },
      );
    }
  }, [deleteFileFolderMutation, refetchFilesAndFolders]);

  const pauseUpload = useCallback(
    async (uploadQueueItem: UploadQueueState) => {
      // Store the current pause state BEFORE toggling
      const wasPaused = uploadQueueItem.isPaused;

      // Toggle UI state immediately for responsive feedback
      setUploadQueue((prev) =>
        prev.map((upload) => {
          if (upload._id === uploadQueueItem._id) {
            return {
              ...upload,
              status: wasPaused ? "uploading" : ("paused" as const),
              isPaused: !wasPaused,
            };
          }
          return upload;
        }),
      );

      if (!wasPaused) {
        // Was uploading, now pausing - abort the current request
        const controller = currentUploadAbortController.current;
        if (controller) {
          controller.abort("paused");
        }

        // Call backend to clean up partial chunk
        if (uploadQueueItem._id) {
          const response = await getFileUploadState.mutateAsync(
            uploadQueueItem._id as string,
          );

          if (response?.uploadedChunks) {
            pauseUploadMutation.mutate({
              uploadId: uploadQueueItem._id as string,
              chunkIndex: response.uploadedChunks.length > 0
                ? response.uploadedChunks[response.uploadedChunks.length - 1] + 1
                : 0,
            });
          }
        }
      } else {
        // Was paused, now resuming - fetch current state and continue upload
        if (uploadQueueItem._id) {
          const response = await getFileUploadState.mutateAsync(
            uploadQueueItem._id as string,
          );

          if (response) {
            resumeUpload(uploadQueueItem, response as UploadedFile);
          }
        }
      }
    },
    [resumeUpload, getFileUploadState, pauseUploadMutation],
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
    setFolderList,
    fileDetails,
    setFileDetails
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