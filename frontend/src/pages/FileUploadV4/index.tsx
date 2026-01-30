import { UploadedFile } from "@/types/file.types";
import { useEffect, useState, lazy, Suspense } from "react";
import { toast } from "sonner";
import FileFolderTable from "./components/Table/FileFolderTable"; 
import { Anchor, Breadcrumbs, Flex } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import LiveFileUploadController from "./components/LiveFileUploadController";
import { useChunkedUpload } from "./context/chunked-upload.context";
import useDeleteAll from "./hooks/useDeleteAll";
import useCreateFolder from "./hooks/createFolder";
import useCreateFile from "./hooks/createFile";
import { useNavigate, useParams } from "react-router-dom";
import { useDragAndDrop } from "./hooks/useDragDrop";
import useFileGetStatus from "./hooks/useFileGetStatus"; 
import useMoveItem from "./hooks/useMoveItem";
import Profile from "./components/Profile";
import MoveItemModal from "./components/Modal/MoveItemModal";

const ResourceUploadModal = lazy(() => import("./components/Modal/ResourceUploadModal"));
const CreateFolderModal = lazy(() => import("./components/Modal/CreateFolderModal"));
const CreateFileModal = lazy(() => import("./components/Modal/CreateFileModal"));


const Page = () => {
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [droppedFiles, setDroppedFiles] = useState<File[]>([]);
  const { folderId } = useParams();
  const moveItemMutation = useMoveItem();

  const {
    uploadQueue,
    allFilesAndFolders: data,
    refetchFilesAndFolders: refetch,
    isLoading, 
  } = useChunkedUpload();
  const getUploadStatusMutation = useFileGetStatus();
  
  const [opened, { open, close }] = useDisclosure(false);
  const [
    isCreateNewFolderOpened,
    { open: openCreateNewFolder, close: closeCreateNewFolder },
  ] = useDisclosure(false);
  
  const [
    isCreateNewFileOpened,
    { open: openCreateNewFile, close: closeCreateNewFile },
  ] = useDisclosure(false);

  const deleteAllMutation = useDeleteAll();
  const createFolderMutation = useCreateFolder();
  const createFileMutation = useCreateFile();

  const { isDragging } = useDragAndDrop({
    onFilesDropped: (files) =>{
      setDroppedFiles(files);
      open();
    }
  });

  useEffect(() => {
    if (isDragging) open();
  }, [isDragging, open]);

  useEffect(() => {
    if (folderId) {
      getUploadStatusMutation.mutate(folderId);
    }
  }, [folderId]);

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
    deleteAllMutation
      .mutateAsync({ uploadIds: Array.from(selectedFiles) })
      .then(() => refetch());
  };

  const handleCreateNewFolder = (folderName: string, parentId?: string) => {
    if (!folderName) return;
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
        onError: (error: any) => {
            if (error?.status === 409 || error?.response?.status === 409) {
                toast.error(`Folder "${folderName}" already exists in this location`);
            } else {
                toast.error("Failed to create folder");
            }
        }
      },
    );
  };

  const handleCreateNewFile = (fileName: string, parentId?: string) => {
    if (!fileName) return;
    createFileMutation.mutate(
      {
        fileName,
        parent: parentId,
      },
      {
        onSuccess: () => {
          refetch();
          closeCreateNewFile();
        },
        onError: (error: any) => {
            if (error?.status === 409 || error?.response?.status === 409) {
                toast.error(`File "${fileName}" already exists in this location`);
            } else {
                toast.error("Failed to create file");
            }
        }
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
    if (isDirectory && entityId) {
      navigate(`/folder/${entityId}`, { replace: true });
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

  function getParents(){
    if(getUploadStatusMutation.data?.parents && getUploadStatusMutation.data.parents.length > 0){
      return getUploadStatusMutation.data?.parents
    }
    return []
  }

  const handleMoveDroppedItems = (draggedIds: string[], targetFolderId: string | null) => {
    const movePromises = draggedIds.map(id => 
      moveItemMutation.mutateAsync({ uploadId: id, newParentId: targetFolderId })
    );

    toast.promise(Promise.all(movePromises), {
      loading: `Moving ${draggedIds.length} items...`,
      success: () => {
        refetch();
        return "Moved successfully";
      },
      error: (err) => err?.response?.data?.message || "Failed to move items"
    });
  };

  const [itemsToMoveInModal, setItemsToMoveInModal] = useState<UploadedFile[]>([]);

  const handleMoveSelected = () => {
    const selectedItems = data?.filter(item => selectedFiles.has(item._id as string)) || [];
    if (selectedItems.length > 0) {
      setItemsToMoveInModal(selectedItems);
    }
  };

  if (isLoading || deleteAllMutation.isPending) {
    return (<div>{"Loading..."}</div>)
  }

  return (
    <div className="w-screen h-screen flex justify-center relative overflow-x-hidden overflow-y-scroll">
      <Suspense fallback={null}>
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
        {isCreateNewFileOpened && (
          <CreateFileModal
            onSubmit={handleCreateNewFile}
            opened={isCreateNewFileOpened}
            close={closeCreateNewFile}
          />
        )}
      </Suspense>
      {itemsToMoveInModal.length > 0 && (
        <MoveItemModal
          opened={itemsToMoveInModal.length > 0}
          onClose={() => setItemsToMoveInModal([])}
          itemsToMove={itemsToMoveInModal}
          onSuccess={() => {
            refetch();
            setSelectedFiles(new Set());
            setItemsToMoveInModal([]);
          }}
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
        })?.length > 0 && <LiveFileUploadController />}
      <div className="w-full max-w-7xl px-4 md:px-8 py-8">
        <Flex justify={"right"} align={"center"}>
          <Profile
            deleteAllUploads={deleteAllUploads}
            onResourceUpload={open}
            openCreateNewFolder={openCreateNewFolder}
            openCreateNewFile={openCreateNewFile}
            moveSelectedUploads={handleMoveSelected}
            hasSelectedItems={selectedFiles.size > 0}
          />
        </Flex>
        {
          folderId ? (
            <FileFolderLocation
              onDrop={handleMoveDroppedItems}
              folderIds={
                [ 
                  ...getParents(),
                  folderId,
                ]
              }
            />
          ) : (
            <h1 
              onDragOver={(e) => {
                e.preventDefault();
                e.currentTarget.style.color = "var(--mantine-color-blue-6)";
              }}
              onDragLeave={(e) => {
                e.currentTarget.style.color = "inherit";
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.currentTarget.style.color = "inherit";
                try {
                  const dataTransfer = JSON.parse(e.dataTransfer.getData("application/json"));
                  const draggedIds = dataTransfer.ids || [];
                  if (draggedIds.length > 0) {
                    handleMoveDroppedItems(draggedIds, null);
                  }
                } catch(err) { console.error(err); }
              }}
              className="transition-colors cursor-default"
            >
              F Manager
            </h1>
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

interface FileFolderLocationProps {
    folderIds: string[];
    onDrop: (draggedIds: string[], targetFolderId: string | null) => void;
}

const FileFolderLocation = ({ folderIds, onDrop }: FileFolderLocationProps) => {
  const navigate = useNavigate()
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  
  const handleDrop = (e: React.DragEvent, targetId: string | null) => {
    e.preventDefault();
    setDragOverId(null);
    try {
      const data = JSON.parse(e.dataTransfer.getData("application/json"));
      if (data.ids && onDrop) {
        onDrop(data.ids, targetId);
      }
    } catch(err) { console.error(err); }
  };

  return (
    <Breadcrumbs>
      <Anchor 
        onClick={() => navigate("/")}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOverId("home");
        }}
        onDragLeave={() => setDragOverId(null)}
        onDrop={(e) => handleDrop(e, null)}
        className="cursor-pointer transition-colors"
        c={dragOverId === "home" ? "blue" : "dimmed"}
        fw={dragOverId === "home" ? 700 : 400}
      >
        Home
      </Anchor>
      {folderIds.map((folderId: string) => (
        <Anchor 
          key={folderId} 
          onClick={()=>navigate(`/folder/${folderId}`)}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOverId(folderId);
          }}
          onDragLeave={() => setDragOverId(null)}
          onDrop={(e) => handleDrop(e, folderId)}
          className="cursor-pointer transition-colors"
          c={dragOverId === folderId ? "blue" : "dimmed"}
          fw={dragOverId === folderId ? 700 : 400}
        >
          {folderId}
        </Anchor>
      ))}
    </Breadcrumbs>
  );
};

export default Page;
