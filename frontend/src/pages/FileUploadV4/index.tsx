import { UploadedFile } from "@/types/file.types";
import { useState } from "react";
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

const Page = () => {
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const {
    uploadQueue,
    allFilesAndFolders: data,
    refetchFilesAndFolders: refetch,
    isLoading,
  } = useChunkedUpload(); 
  const [opened, { open, close }] = useDisclosure(uploadQueue?.length > 0);
  const [
    isCreateNewFolderOpened,
    { open: openCreateNewFolder, close: closeCreateNewFolder },
  ] = useDisclosure(uploadQueue?.length > 0);
  const deleteAllMutation = useDeleteAll();
  const createFolderMutation = useCreateFolder();

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

  const navigate = useNavigate()

  const handleFileFolderClick = (entityId: string,isDirectory: boolean) => {
    console.log(entityId);
    if(isDirectory && entityId) {
      navigate(`/${entityId}`,{replace:true})
    }
  }

  const allSelected =
    (data?.length ?? 0) > 0 && selectedFiles.size === data?.length;
  const indeterminate =
    selectedFiles.size > 0 && selectedFiles.size < (data?.length || 0);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="w-screen h-screen flex justify-center">
      {opened && <ResourceUploadModal opened={opened} close={close} />}
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
