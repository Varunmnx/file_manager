import { UploadedFile } from "@/types/file.types";
import { useEffect, useState, lazy, Suspense } from "react";
import { toast } from "sonner";
import FileFolderTable from "./components/Table/FileFolderTable"; 
import { Anchor, Breadcrumbs, ActionIcon, Tooltip, Group, Text as MantineText } from "@mantine/core";
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
import { IconTrash, IconArrowsMove, IconFolderPlus, IconFilePlus, IconUpload, IconX } from "@tabler/icons-react";

const ResourceUploadModal = lazy(() => import("./components/Modal/ResourceUploadModal"));
const CreateFolderModal = lazy(() => import("./components/Modal/CreateFolderModal"));
const CreateFileModal = lazy(() => import("./components/Modal/CreateFileModal"));


const Page = () => {
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [droppedFiles, setDroppedFiles] = useState<File[]>([]);
  const { folderId } = useParams();
  const moveItemMutation = useMoveItem();
  const navigate = useNavigate();

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

  const [isHomeDragOver, setIsHomeDragOver] = useState(false);

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

  const handleFileFolderClick = (entityId: string, isDirectory: boolean, ctrlKey: boolean) => {
    const newSelected = new Set(selectedFiles);
    
    if (ctrlKey) {
      // Ctrl+Click: Toggle selection (add/remove from multi-selection)
      if (newSelected.has(entityId)) {
        newSelected.delete(entityId);
      } else {
        newSelected.add(entityId);
      }
      setSelectedFiles(newSelected);
    } else {
      // Regular click: Select exclusively or deselect if it's the only one selected
      const isCurrentlySelected = selectedFiles.has(entityId);
      const isOnlySelection = selectedFiles.size === 1 && isCurrentlySelected;
      
      if (isOnlySelection) {
        // Clicking the only selected item - deselect it
        setSelectedFiles(new Set());
      } else {
        // Select this item exclusively (deselect all others)
        setSelectedFiles(new Set([entityId]));
      }
    }
  };

  const handleFileFolderDoubleClick = (entityId: string, isDirectory: boolean) => {
    if (isDirectory && entityId) {
      navigate(`/folder/${entityId}`);
    } else if (!isDirectory) {
       // Open file logic (e.g. OnlyOffice or Preview)
       if (entityId) {
           navigate(`/document/${entityId}`);
       }
    }
  };

  useEffect(() => {
    setSelectedFiles(new Set());
  }, [folderId]);

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
    // Prevent moving into self (current folder)
    if (targetFolderId === folderId || (targetFolderId === null && !folderId)) {
        return;
    }

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



  return (
    <div 
      onClick={(e) => {
        // Deselect if clicking outside the table container and not on interactive/toolbar elements
        const target = e.target as HTMLElement;
        if (!target.closest('.file-folder-table-container, .toolbar-container, button, input, a, .mantine-Menu-dropdown, .mantine-Modal-content')) {
          setSelectedFiles(new Set());
        }
      }}
      className="w-screen h-screen flex justify-center relative overflow-x-hidden overflow-y-scroll bg-gray-50"
    >
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
        <div className="toolbar-container flex justify-between items-center mb-6">
             {/* Left side: Breadcrumbs or Title */}
             <div className="flex-1">
                {
                  folderId ? (
                    <FileFolderLocation
                      onDrop={handleMoveDroppedItems}
                      folderIds={[...getParents(), folderId]}
                    />
                  ) : (
                    <h1 
                      onDragOver={(e) => {
                        e.preventDefault();
                        setIsHomeDragOver(true);
                      }}
                      onDragLeave={() => setIsHomeDragOver(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setIsHomeDragOver(false);
                        try {
                          const dataTransfer = JSON.parse(e.dataTransfer.getData("application/json"));
                          const draggedIds = dataTransfer.ids || [];
                          if (draggedIds.length > 0) {
                            handleMoveDroppedItems(draggedIds, null);
                          }
                        } catch(err) { console.error(err); }
                      }}
                      className={`text-2xl font-bold transition-colors cursor-default ${isHomeDragOver ? "text-blue-600" : "text-gray-800"}`}
                    >
                      F Manager
                    </h1>
                  )
                }
             </div>

             {/* Right side: Actions & Profile */}
             <div className="flex items-center gap-4">
                {/* Global Actions */}
                <Group gap="xs">
                    <Tooltip label="Upload File">
                        <ActionIcon onClick={open} variant="light" size="lg" radius="md">
                            <IconUpload size={20} />
                        </ActionIcon>
                    </Tooltip>
                    <Tooltip label="New Folder">
                        <ActionIcon onClick={openCreateNewFolder} variant="light" size="lg" radius="md">
                            <IconFolderPlus size={20} />
                        </ActionIcon>
                    </Tooltip>
                    <Tooltip label="New File">
                        <ActionIcon onClick={openCreateNewFile} variant="light" size="lg" radius="md">
                            <IconFilePlus size={20} />
                        </ActionIcon>
                    </Tooltip>
                </Group>

                {/* Selection Actions */}
                {selectedFiles.size > 0 && (
                    <div className="flex items-center gap-2 pl-4 border-l border-gray-300">
                        <MantineText size="sm" fw={500} style={{userSelect: "none"}}>{selectedFiles.size} Selected</MantineText>
                        <Tooltip label="Deselect All">
                            <ActionIcon onClick={() => setSelectedFiles(new Set())} variant="subtle" color="gray" size="lg" radius="md">
                                <IconX size={20} />
                            </ActionIcon>
                        </Tooltip>
                        
                        <div className="w-px h-6 bg-gray-300 mx-1" />

                        <Tooltip label={`Move ${selectedFiles.size} Item(s)`}>
                            <ActionIcon onClick={handleMoveSelected} variant="filled" color="blue" size="lg" radius="md">
                                <IconArrowsMove size={20} />
                            </ActionIcon>
                        </Tooltip>
                        <Tooltip label={`Delete ${selectedFiles.size} Item(s)`}>
                            <ActionIcon onClick={deleteAllUploads} variant="filled" color="red" size="lg" radius="md">
                                <IconTrash size={20} />
                            </ActionIcon>
                        </Tooltip>
                    </div>
                )}

                <div className="pl-2">
                    <Profile />
                </div>
             </div>
        </div>

        <div className="min-h-[500px] flex flex-col">
             <FileFolderTable
              isLoading={isLoading || createFolderMutation.isPending || createFileMutation.isPending || deleteAllMutation.isPending}
              allSelected={allSelected}
              indeterminate={indeterminate}
              selectedFiles={selectedFiles}
              setSelectedFiles={setSelectedFiles}
              handleSelectAll={handleSelectAll}
              handleSelectFile={handleSelectFile}
              handleDeleteFile={handleDeleteFile}
              data={data ?? []}
              onFileFolderRowClick={handleFileFolderClick}
              onFileFolderRowDoubleClick={handleFileFolderDoubleClick}
            />
        </div>
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