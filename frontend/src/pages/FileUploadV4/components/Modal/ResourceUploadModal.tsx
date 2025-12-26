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
}

const ResourceUploadModal = ({ opened, close }: Props) => {
  const { startUploading, setUploadQueue } = useChunkedUpload();
  const params = useParams();
  const folderId = params?.folderId;
  const createFolderMutation = useCreateFolder();
  const [folderPathAgainstFiles, setFolderPathAgainstFiles] = useState<
    Map<string, Set<FileItem>>
  >(new Map());

  const onDropCallback = useCallback((files: File[], tree: FileTreeItem[]) => {
    console.log("Files dropped:", files);
    console.log("File tree:", tree);
  }, []);

  const runWhenAnyChunkFails = useCallback((error: string) => {
    toast.error(error);
  }, []);

  const processFolders = useCallback(
    async (child: FileItem[], parentFolderIdHoldingThisFolder: string) => {
      // if(child.type)
      const files: FileItemWithParentId[] = [];

      const pathMap: Map<string, FileItem[]> = new Map();
      console.log(child);
      child.map((item) => {
        const folderPath = item.path
          .split("/")
          .slice(0, item.path.split("/").length - 1)
          .join("/");
        if (pathMap.has(folderPath)) {
          pathMap.get(folderPath)?.push(item);
        } else {
          pathMap.set(folderPath, [item]);
        }
      });
      // create folder and upload to that folder
      /**
       * Grandparent/parent/parent/filename.extension trailed to
       * parent/parent
       * parent2/parent
       * parent/parent2
       * if folder for root parent is created dont try to create it again
       */
      const folderPaths = Array.from(pathMap.keys());
      /**
       * foldername depth parentid
       */
      console.log(folderPaths);
      const parentFolderIdLookup = new Map<
        string,
        { depth: number; parentId: string }
      >();
      for (let k = 0; k < folderPaths.length; k++) {
        const folderPath = folderPaths[k];
        const folderArray = folderPath.split("/");
        console.log(folderArray);
        for (let j = 0; j < folderArray.length; j++) {
          // check if folder was created in this location if not create one
          console.log("uploading", folderArray[j]);
          const currentPId =
            j === 0
              ? parentFolderIdHoldingThisFolder
              : parentFolderIdLookup.get(folderArray[j])?.parentId &&
                  parentFolderIdLookup.get(folderArray[j])?.depth == j
                ? parentFolderIdLookup.get(folderArray[j])?.parentId
                : parentFolderIdHoldingThisFolder;

          let response = null;

          if (j >= 1 && folderArray[j].trim() !== "") {
            response = await createFolderMutation.mutateAsync({
              folderName: folderArray[j],
              parent: currentPId,
              folderSize: 0,
            });
          } else {
            response = { uploadId: currentPId };
          }

          if (response?.uploadId) {
            const currentFiles = pathMap.get(folderPath);
            if (currentFiles && response.uploadId) {
              currentFiles.map((file) => {
                files.push({
                  ...file,
                  parentId: [response.uploadId as string],
                });
              });
            }
            parentFolderIdLookup.set(folderPath, {
              depth: j,
              parentId:
                j == 0
                  ? parentFolderIdHoldingThisFolder
                  : (response.uploadId as string),
            });
          }
        }
      }
      console.log("files", files);
      return files;
    },
    [createFolderMutation],
  );

  const onStartUpload = useCallback(
    async (tree: FileTreeItem[]) => {
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
          // eslint-disable-next-line no-unsafe-optional-chaining
          files.push(...rootORFolder.children?.map((item) => ({ ...item, parentId: [folderId as string] } as FileItemWithParentId)));

          setUploadQueue(uploadQueueState);
        } else {
          const data = await createFolderMutation.mutateAsync({
            folderName: (rootORFolder as FolderItem).name,
            parent: folderId,
            folderSize: 0,
          });
          if (data?.uploadId) {
            console.log("folder created");
            const processedFoldersWithFiles  = await processFolders(rootORFolder.children, data?.uploadId as string);
            files.push(...processedFoldersWithFiles);
          } else {
            toast.error("Failed to create folder");
          }
        }
      }

   console.log("files", files);
        // setTimeout(
        //   () =>
        //     startUploading(
        //       files,
        //       runWhenAnyChunkFails,
        //     ),
        //   500,
        // );
     
      folderPathAgainstFiles.clear();

      close();
    },
    [close, createFolderMutation, folderId, folderPathAgainstFiles, processFolders, runWhenAnyChunkFails, setUploadQueue, startUploading],
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
        maxSize={1000 * 1024 * 1024}
        onUpload={onStartUpload}
        onDrop={onDropCallback}
      />
    </Modal>
  );
};

export default ResourceUploadModal;
