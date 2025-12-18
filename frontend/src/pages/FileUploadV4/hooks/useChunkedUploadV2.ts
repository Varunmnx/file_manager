import { useAppDispatch } from "@/store";
import useInitiateFileUpload from "./useFileInitiateFileUpload";
import { FileItem } from "@/components/FileUpload/types";
import { ChunkData } from "@/types/upload.types";
import { useCallback, useRef } from "react";
import useFileUpload from "./useFileUpload";
import { updateUploadQueue } from "@/store/features/fileUpload/fileUploadSlice";
import { API, Slug } from "@/services";

export function useChunkedUploadV2({
  chunkSize = 5 * 1024 * 1024,
}: { chunkSize?: number } = {}) {
  // const fileUploadQueue = useAppSelector(
  //   (state) => state.fileUpload.uploadQueue,
  // );
  const dispatch = useAppDispatch();
  const initiateUpload = useInitiateFileUpload();
  const fileUploadMutation = useFileUpload();
  const currentChunkedUploadController = useRef<AbortController | null>(
    new AbortController(),
  );

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

  async function startUploading(
    files: FileItem[],
    runWhenAnyChunkFails?: (error: string) => void,
  ) {
    /**
     * initiate upload -
     * perform chunking -
     * attach abort controller -
     * start uploading each chunk -
     * update progress -
     * finish upload when completed -
     * ! await for each file to finish the entire step (sequential file upload)
     */
    let fileIndex = 0;
    for (const file of files) {
      dispatch(
        updateUploadQueue({
          positionIndex: fileIndex,
          uploadPayload: {
            status: "uploading",
          },
        }),
      );
      fileIndex++;
      // initiate
      await initiateUpload.mutateAsync({
        fileName: file.name,
        fileSize: file.size,
      });

      //perform chunking
      const chunks = splitFileIntoChunks(file?.file);

      if (initiateUpload.isSuccess) {
        let chunkIndex = 0;
        for (const chunk of chunks) {
          chunkIndex++;
          const formData = new FormData();
          formData.append("chunk", chunk.blob, file.name);
          formData.append(
            "uploadId",
            initiateUpload?.data?.uploadId ?? "no-uuid",
          );
          formData.append("chunkIndex", chunk.index.toString());
          formData.append("chunkSize", chunk.size.toString());

          await API.post({
            slug: Slug.UPLOAD_CHUNK,
            body: formData,
            axiosConfig: {
              signal: currentChunkedUploadController.current?.signal,
            },
          });

          if (fileUploadMutation.isError && runWhenAnyChunkFails) {
            runWhenAnyChunkFails(fileUploadMutation.error.message);
            break;
          } else if (fileUploadMutation.isSuccess) {
            dispatch(
              updateUploadQueue({
                positionIndex: fileIndex,
                uploadPayload: {
                  percentage: Math.round((chunkIndex / chunks.length) * 100),
                },
              }),
            );
            break;
          }
        }
      }
    }
  }

  function cancelUpload() {
    currentChunkedUploadController.current?.abort();
  }

  function pauseUpload(positionIndex: number) {
    currentChunkedUploadController.current?.abort();
    dispatch(
      updateUploadQueue({
        positionIndex,
        uploadPayload: {
          status: "paused",
        },
      }),
    );
  }

  return { startUploading, cancelUpload, pauseUpload };
}
