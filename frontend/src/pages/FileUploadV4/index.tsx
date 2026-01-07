import { UploadedFile } from "@/types/file.types";
import { useEffect, useState } from "react";
import FileFolderTable from "./components/Table/FileFolderTable";
import ToggleMenu from "./components/Menu";
import { Anchor, Breadcrumbs, Flex } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import ResourceUploadModal from "./components/Modal/ResourceUploadModal";
import LiveFileUploadController from "./components/LiveFileUploadController";
import { useChunkedUpload } from "./context/chunked-upload.context";
import useDeleteAll from "./hooks/useDeleteAll";
import CreateFolderModal from "./components/Modal/CreateFolderModal";
import useCreateFolder from "./hooks/createFolder";
import { useNavigate, useParams } from "react-router-dom";
import { useDragAndDrop } from "./hooks/useDragDrop";
import useFileGetStatus from "./hooks/useFileGetStatus";
import FileDetailsCard from "./components/FileDetailsCard";
import { API, Slug } from "@/services";

const Page = () => {
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [droppedFiles, setDroppedFiles] = useState<File[]>([]);
  const { folderId } = useParams();

  const {
    uploadQueue,
    allFilesAndFolders: data,
    refetchFilesAndFolders: refetch,
    isLoading,
    fileDetails,
  } = useChunkedUpload();
  const getUploadStatusMutation = useFileGetStatus();

  const [opened, { open, close }] = useDisclosure(false);
  const [
    isCreateNewFolderOpened,
    { open: openCreateNewFolder, close: closeCreateNewFolder },
  ] = useDisclosure(false);

  const deleteAllMutation = useDeleteAll();
  const createFolderMutation = useCreateFolder();

  const { isDragging } = useDragAndDrop({
    onFilesDropped: (files) =>{
      console.log(files)
    }
  });

  useEffect(() => {
    if (isDragging) open();
  }, [isDragging, open]);

  useEffect(() => {
    if (folderId) {
      getUploadStatusMutation.mutate(folderId);
    }
  }, [folderId, getUploadStatusMutation]);

  // Close the modal and clear dropped files when modal is closed
  const handleModalClose = () => {
    close();
    setDroppedFiles([]);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedFiles(
        new Set(data?.map((file: UploadedFile) => file._id as string)),
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
    if (uploadQueue.filter((item) => item.status == "uploading").length == 0) {
      refetch();
    }
  }, [refetch, uploadQueue]);
  const allSelected =
    (data?.length ?? 0) > 0 && selectedFiles.size === data?.length;
  const indeterminate =
    selectedFiles.size > 0 && selectedFiles.size < (data?.length || 0);

  if (isLoading || deleteAllMutation.isPending) {
    return <div>Loading...</div>;
  }

  console.log("fileDetails", fileDetails);

  async function handleLogin(){
    await API.get({
       slug: "/auth/google"
    })
  }

  return (
    <div className="w-screen h-screen flex justify-center relative overflow-x-hidden overflow-y-scroll">
      {fileDetails && <FileDetailsCard />}
<button onClick={() => window.location.href = 'http://localhost:3000/auth/google'}>
  Sign in with Google
</button>
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
      {
        uploadQueue?.filter((file) => {
          return (
            file.status == "uploading" ||
            file.status == "paused" ||
            file.status == "initiating" ||
            file.status == "idle"
          );
        })?.length > 0 &&<LiveFileUploadController />}
      <div className="w-3/4 py-8">
        <Flex justify={"right"} align={"center"}>
          <ToggleMenu
            deleteAllUploads={deleteAllUploads}
            onResourceUpload={open}
            openCreateNewFolder={openCreateNewFolder}
          />
        </Flex>
        {
          // eslint-disable-next-line no-constant-binary-expression, no-unsafe-optional-chaining
          folderId ? (
            <FileFolderLocation
              folderIds={
                folderId
                  ? // eslint-disable-next-line no-constant-binary-expression
                    ([
                      // eslint-disable-next-line no-unsafe-optional-chaining
                      ...(getUploadStatusMutation.data?.parents as string[]),
                      folderId,
                    ] )
                  : []
              }
            />
          ) : (
            <h1>F Manager</h1>
          )
        }
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

const FileFolderLocation = ({ folderIds }: { folderIds: string[] }) => {
  return (
    <Breadcrumbs>
      <Anchor href="/">Home</Anchor>
      {folderIds.map((folderId: string) => (
        <Anchor href={`/${folderId}`}>{folderId}</Anchor>
      ))}
    </Breadcrumbs>
  );
};

export default Page;
