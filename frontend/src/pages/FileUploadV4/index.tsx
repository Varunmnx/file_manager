import { UploadedFile } from "@/types/file.types";
import { useEffect, useState } from "react";
import FileFolderTable from "./components/Table/FileFolderTable";
import ToggleMenu from "./components/Menu";
import { Flex } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import ResourceUploadModal from "./components/Modal/ResourceUploadModal";
import LiveFileUploadController from "./components/LiveFileUploadController";
import { useChunkedUpload } from "./context/chunked-upload.context";
import useDeleteAll from "./hooks/useDeleteAll";
import CreateFolderModal from "./components/Modal/CreateFolderModal";
import useCreateFolder from "./hooks/createFolder"; 
import { useNavigate } from "react-router-dom";
import { useDragAndDrop } from "./hooks/useDragDrop";

const Page = () => {
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [droppedFiles, setDroppedFiles] = useState<File[]>([]);
  
  const {
    uploadQueue,
    allFilesAndFolders: data,
    refetchFilesAndFolders: refetch,
    isLoading,
  } = useChunkedUpload(); 
  
  const [opened, { open, close }] = useDisclosure(false);
  const [
    isCreateNewFolderOpened,
    { open: openCreateNewFolder, close: closeCreateNewFolder },
  ] = useDisclosure(false);
  
  const deleteAllMutation = useDeleteAll();
  const createFolderMutation = useCreateFolder();
  
  const { isDragging } = useDragAndDrop({
    onFilesDropped: (files) => {
      console.log("Files dropped:", files);
      setDroppedFiles(files);
      open(); // Open the modal immediately when files are dropped
    },
    enabled: true,
  });

  // Close the modal and clear dropped files when modal is closed
  const handleModalClose = () => {
    close();
    setDroppedFiles([]);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedFiles(
        new Set(data?.map((file: UploadedFile) => file.uploadId as string)),
      );
    } else {
      setSelectedFiles(new Set());
    }
  };

  const deleteAllUploads = () => {
    console.log(selectedFiles);
    deleteAllMutation
      .mutateAsync({ uploadIds: Array.from(selectedFiles) })
      .then(() => refetch());
  };

  const handleCreateNewFolder = (folderName: string, parentId?: string) => {
    if (!folderName) return;
    console.log(folderName);
    createFolderMutation.mutate(
      {
        folderName,
        folderSize: 0,
        parent: parentId,
      },
      {
        onSuccess: () => {
          refetch();
          closeCreateNewFolder();
        },
      },
    );
  };

  const handleDeleteFile = (uploadId: string) => {
    deleteAllMutation
      .mutateAsync({ uploadIds: [uploadId] })
      .then(() => refetch());
  };

  const handleSelectFile = (uploadId: string, checked: boolean) => {
    const newSelected = new Set(selectedFiles);
    if (checked) {
      newSelected.add(uploadId);
    } else {
      newSelected.delete(uploadId);
    }
    setSelectedFiles(newSelected);
  };

  const navigate = useNavigate();

  const handleFileFolderClick = (entityId: string, isDirectory: boolean) => {
    console.log(entityId);
    if (isDirectory && entityId) {
      navigate(`/${entityId}`, { replace: true });
    }
  };

    useEffect(() => {
    if(uploadQueue.filter(item=>item.status == "uploading").length == 0){
      refetch()
    }
  },[refetch, uploadQueue])
  const allSelected =
    (data?.length ?? 0) > 0 && selectedFiles.size === data?.length;
  const indeterminate =
    selectedFiles.size > 0 && selectedFiles.size < (data?.length || 0);

  if (isLoading || deleteAllMutation.isPending) {
    return <div>Loading...</div>;
  }

  return (
    <div className="w-screen h-screen flex justify-center relative">
      {/* Drag overlay */}
      {isDragging && (
        <div className="fixed inset-0 bg-blue-500/20 backdrop-blur-sm z-40 flex items-center justify-center pointer-events-none">
          <div className="bg-white rounded-lg shadow-xl p-8 border-2 border-blue-500 border-dashed">
            <svg
              className="mx-auto h-16 w-16 text-blue-500 mb-4"
              stroke="currentColor"
              fill="none"
              viewBox="0 0 48 48"
            >
              <path
                d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <p className="text-xl font-semibold text-blue-600">
              Drop files anywhere to upload
            </p>
          </div>
        </div>
      )}

      {opened && (
        <ResourceUploadModal 
          opened={opened} 
          close={handleModalClose}
          initialFiles={droppedFiles}
        />
      )}
      {isCreateNewFolderOpened && (
        <CreateFolderModal
          onSubmit={handleCreateNewFolder}
          opened={isCreateNewFolderOpened}
          close={closeCreateNewFolder}
        />
      )}
      <LiveFileUploadController />
      <div className="w-3/4 py-8">
        <Flex justify="space-between" align={"center"}>
          <h1 className="text-2xl font-bold">All Files</h1>
          <ToggleMenu
            deleteAllUploads={deleteAllUploads}
            onResourceUpload={open}
            openCreateNewFolder={openCreateNewFolder}
          />
        </Flex>
        <div className="mt-10" />
        <FileFolderTable
          allSelected={allSelected}
          indeterminate={indeterminate}
          selectedFiles={selectedFiles}
          handleSelectAll={handleSelectAll}
          handleSelectFile={handleSelectFile}
          handleDeleteFile={handleDeleteFile}
          data={data ?? []}
          onFileFolderRowClick={handleFileFolderClick}
        />
      </div>
    </div>
  );
};

export default Page;