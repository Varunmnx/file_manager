import { Table, ActionIcon, Avatar, Group, Text, Menu, Skeleton, Box } from "@mantine/core";
import Icon from "@/components/Icon";
import { UploadedFile, CreatorInfo } from "@/types/file.types";
import { FileTypeIconMapKeys } from "@/utils/fileTypeIcons";
import { checkAndRetrieveExtension } from "../../utils/getFileIcon";
import { formatBytes } from "@/utils/formatBytes";
import { getShortDate } from "@/utils/getDateTime";
import { IconFolder, IconInfoCircle, IconFileText, IconTrash, IconDotsVertical, IconHistory, IconEye, IconShare, IconPlayerPlay } from "@tabler/icons-react";
import { MouseEvent as ReactMouseEvent, useState, useRef, useEffect } from "react";
import useFileGetStatus from "../../hooks/useFileGetStatus";
import { useChunkedUpload } from "../../context/chunked-upload.context";
import { useNavigate } from "react-router-dom";
import { RevisionHistory } from "@/components/RevisionHistory";
import useUpdateActivity from "../../hooks/useUpdateActivity";
import useMoveItem from "../../hooks/useMoveItem";
import { toast } from "sonner";
import { isMediaFile } from "../Modal/MediaPreviewModal";
import ShareModal from "../Modal/ShareModal";

interface Props {
  allSelected: boolean;
  indeterminate: boolean;
  selectedFiles: Set<string>;
  setSelectedFiles: (files: Set<string>) => void;
  handleSelectAll: (checked: boolean) => void;
  handleSelectFile: (uploadId: string, checked: boolean) => void;
  data: UploadedFile[];
  handleDeleteFile: (uploadId: string) => void;
  onFileFolderRowClick?: (entityId: string, isDirectory: boolean, ctrlKey: boolean) => void;
  onFileFolderRowDoubleClick?: (entityId: string, isDirectory: boolean) => void;
  isLoading?: boolean;
  onPreviewMedia?: (file: UploadedFile) => void;
  onDirectPreview?: (file: UploadedFile) => void;
}

// Helper function to check if file is supported by OnlyOffice
const isSupportedDocument = (fileName: string): boolean => {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const supportedExtensions = ['docx', 'doc', 'xlsx', 'xls', 'pptx', 'ppt', 'odt', 'ods', 'odp', 'pdf'];
  return supportedExtensions.includes(ext);
};

const FileFolderTable = (props: Props) => {
  const {
    handleDeleteFile,
    selectedFiles,
    setSelectedFiles,
    data,
    onFileFolderRowClick,
    onFileFolderRowDoubleClick,
    isLoading,
    onPreviewMedia,
    onDirectPreview
  } = props;

  const getFileDetailsMutation = useFileGetStatus()
  const updateActivityMutation = useUpdateActivity()
  const moveItemMutation = useMoveItem();
  const { setFileDetails, refetchFilesAndFolders } = useChunkedUpload()
  const navigate = useNavigate();

  // State for modals
  const [selectedFileForHistory, setSelectedFileForHistory] = useState<{ id: string; name: string } | null>(null);
  const [shareTarget, setShareTarget] = useState<{ id: string; name: string } | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);

  // State for visual selection box only
  const [selectionBox, setSelectionBox] = useState<{ startX: number; startY: number; currentX: number; currentY: number } | null>(null);

  // Refs for logic to avoid effect dependencies
  const dragState = useRef<{
    isSelecting: boolean;
    startX: number;
    startY: number;
    initialSelection: Set<string>;
  }>({
    isSelecting: false,
    startX: 0,
    startY: 0,
    initialSelection: new Set()
  });

  const rowRefs = useRef<Map<string, HTMLTableRowElement>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);

  const handleDragStart = (e: React.DragEvent, file: UploadedFile) => {
    let idsToMove = [file._id as string];
    if (selectedFiles.has(file._id as string)) {
      idsToMove = Array.from(selectedFiles);
    } else {
      // If dragging a file that is NOT selected, select it (and deselect others)
      setSelectedFiles(new Set([file._id as string]));
    }

    // Custom drag preview
    const preview = document.createElement("div");
    preview.className = "fixed top-0 left-0 bg-white p-3 rounded-lg shadow-xl border border-blue-200 z-[9999] flex items-center gap-3 font-medium text-slate-700 pointer-events-none";
    preview.style.position = "absolute";
    preview.style.top = "-1000px";
    // Icon
    const icon = document.createElement("div");
    icon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-blue-500"><path d="M4 22h14a2 2 0 0 0 2-2V7.5L14.5 2H6a2 2 0 0 0-2 2v4"></path><path d="M14 2v6h6"></path><path d="m3 12.5 5 5 5-5"></path></svg>`;
    preview.appendChild(icon);

    // Text
    const text = document.createElement("span");
    text.innerText = idsToMove.length > 1 ? `Moving ${idsToMove.length} items` : `Moving ${file.fileName}`;
    preview.appendChild(text);

    document.body.appendChild(preview);
    e.dataTransfer.setDragImage(preview, 0, 0);
    e.dataTransfer.setData("application/json", JSON.stringify({ ids: idsToMove }));
    e.dataTransfer.effectAllowed = "move";

    // Clean up element after drag starts
    requestAnimationFrame(() => {
      document.body.removeChild(preview);
    });
  };

  const handleDragOver = (e: React.DragEvent, targetFolder: UploadedFile) => {
    e.preventDefault();
    e.stopPropagation();

    if (targetFolder.isFolder) {
      // Check if we're dragging the folder onto itself
      try {
        const dataStr = e.dataTransfer.getData("application/json");
        if (dataStr) {
          const parsedData = JSON.parse(dataStr);
          const draggedIds: string[] = parsedData.ids || [];

          // Don't highlight if dragging folder onto itself
          if (draggedIds.includes(targetFolder._id as string)) {
            setDragOverFolderId(null);
            return;
          }
        }
      } catch (err) {
        // If we can't get the data, still allow highlighting
        // This happens in some browsers during drag
      }

      setDragOverFolderId(targetFolder._id as string);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    // Only clear if we're actually leaving the row
    const relatedTarget = e.relatedTarget as HTMLElement;
    const currentTarget = e.currentTarget as HTMLElement;

    if (!currentTarget.contains(relatedTarget)) {
      setDragOverFolderId(null);
    }
  };

  const handleDrop = async (e: React.DragEvent, targetFolder: UploadedFile) => {
    e.preventDefault();
    setDragOverFolderId(null);

    // Check if the target is a folder
    if (!targetFolder.isFolder) return;

    try {
      const dataStr = e.dataTransfer.getData("application/json");
      if (!dataStr) return;

      const parsedData = JSON.parse(dataStr);
      const draggedIds: string[] = parsedData.ids || [];

      if (draggedIds.length === 0) return;
      if (draggedIds.includes(targetFolder._id as string)) {
        return;
      }

      const movePromises = draggedIds.map(id =>
        moveItemMutation.mutateAsync({ uploadId: id, newParentId: targetFolder._id as string })
      );

      toast.promise(Promise.all(movePromises), {
        loading: `Moving ${draggedIds.length} item(s)...`,
        success: () => {
          refetchFilesAndFolders();
          setSelectedFiles(new Set());
          return "Moved successfully";
        },
        error: (err) => err?.response?.data?.message || "Failed to move some items"
      });
    } catch (err) {
      console.error("Drop error", err);
    }
  };

  // Selection Lasso Handlers
  const handleSelectionMouseDown = (e: ReactMouseEvent) => {
    // Don't start selection if clicking on interactive elements
    if ((e.target as HTMLElement).closest('button, input, a, [draggable="true"], .action-icon')) return;

    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const startX = e.clientX - rect.left + container.scrollLeft;
    const startY = e.clientY - rect.top + container.scrollTop;

    // Handle initial selection state based on modifier keys
    let startSet = new Set<string>();
    if (e.ctrlKey || e.shiftKey) {
      startSet = new Set(selectedFiles);
    } else {
      // Clear selection if no modifier
      setSelectedFiles(new Set());
    }

    // Update Ref state
    dragState.current = {
      isSelecting: true,
      startX,
      startY,
      initialSelection: startSet
    };

    // Set initial visual state
    setSelectionBox({ startX, startY, currentX: startX, currentY: startY });
  };

  // Global mouse move/up handlers for selection
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragState.current.isSelecting || !containerRef.current) return;

      const container = containerRef.current;
      const rect = container.getBoundingClientRect();
      const currentX = e.clientX - rect.left + container.scrollLeft;
      const currentY = e.clientY - rect.top + container.scrollTop;

      const { startX, startY, initialSelection } = dragState.current;

      // Update visual state
      setSelectionBox({ startX, startY, currentX, currentY });

      // Calculate intersection
      const boxLeft = Math.min(startX, currentX);
      const boxTop = Math.min(startY, currentY);
      const boxRight = Math.max(startX, currentX);
      const boxBottom = Math.max(startY, currentY);

      const newSelected = new Set(initialSelection);

      data.forEach(file => {
        const row = rowRefs.current.get(file._id as string);
        if (row) {
          const rowRect = row.getBoundingClientRect();
          const relativeRowTop = rowRect.top - rect.top + container.scrollTop;
          const relativeRowLeft = rowRect.left - rect.left + container.scrollLeft;

          // Check intersection
          const isIntersecting = !(
            boxRight < relativeRowLeft ||
            boxLeft > relativeRowLeft + rowRect.width ||
            boxBottom < relativeRowTop ||
            boxTop > relativeRowTop + rowRect.height
          );

          if (isIntersecting) {
            newSelected.add(file._id as string);
          }
        }
      });

      setSelectedFiles(newSelected);
    };

    const handleMouseUp = () => {
      if (dragState.current.isSelecting) {
        dragState.current.isSelecting = false;
        setSelectionBox(null);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [data, setSelectedFiles]);

  const handleRowClick = (e: ReactMouseEvent, file: UploadedFile) => {
    // Don't process click if it's on an interactive element
    if ((e.target as HTMLElement).closest('button, input, a, .action-icon')) return;

    onFileFolderRowClick?.(file._id as string, !!file?.isFolder, e.ctrlKey);
  };

  const handleRowDoubleClick = (e: ReactMouseEvent, file: UploadedFile) => {
    // Don't process double click if it's on an interactive element
    if ((e.target as HTMLElement).closest('button, input, a, .action-icon')) return;

    onFileFolderRowDoubleClick?.(file._id as string, !!file?.isFolder);
  };

  function handleMoreInformation(e: ReactMouseEvent<SVGSVGElement, MouseEvent>, id: string) {
    e.stopPropagation();
    e.preventDefault();
    updateActivityMutation.mutate({ uploadId: id }, {
      onSuccess: () => {
        refetchFilesAndFolders();
      }
    });
    getFileDetailsMutation.mutate(id, {
      onSuccess: (data) => {
        setFileDetails(data)
      }
    })
  }

  const handleOpenInOnlyOffice = (e: ReactMouseEvent<HTMLButtonElement, MouseEvent>, fileId: string) => {
    e.stopPropagation();
    e.preventDefault();
    updateActivityMutation.mutate({ uploadId: fileId }, {
      onSuccess: () => {
        refetchFilesAndFolders();
        navigate(`/document/${fileId}`);
      }
    });
  };

  const getInitials = (firstName: string, lastName: string) => {
    const first = firstName?.[0]?.toUpperCase() || '';
    const last = lastName?.[0]?.toUpperCase() || '';
    return first + last || '?';
  };

  const renderUser = (user?: CreatorInfo | string, date?: Date) => {
    if (!user) return <Text size="sm">-</Text>;
    if (typeof user === 'string') {
      return (
        <div className="flex flex-col">
          <Text size="sm">{user}</Text>
          {date && <Text size="xs" c="dimmed">{getShortDate(date as unknown as string)}</Text>}
        </div>
      );
    }
    return (
      <Group gap="xs">
        <Avatar src={user.picture} alt={user.firstName} radius="xl" size="sm" color="blue">
          {getInitials(user.firstName, user.lastName)}
        </Avatar>
        <div className="flex flex-col">
          <Text size="sm" fw={500}>{user.firstName} {user.lastName}</Text>
          {date && <Text size="xs" c="dimmed">{getShortDate(date as unknown as string)}</Text>}
          {!date && <Text size="xs" c="dimmed">{user.email}</Text>}
        </div>
      </Group>
    );
  };



  return (
    <div ref={containerRef} className="file-folder-table-container relative select-none min-h-full w-full" onMouseDown={handleSelectionMouseDown}>
      {/* Selection Box */}
      {selectionBox && (
        <div
          className="absolute bg-blue-500/20 border border-blue-500 z-50 pointer-events-none"
          style={{
            left: Math.min(selectionBox.startX, selectionBox.currentX),
            top: Math.min(selectionBox.startY, selectionBox.currentY),
            width: Math.abs(selectionBox.currentX - selectionBox.startX),
            height: Math.abs(selectionBox.currentY - selectionBox.startY)
          }}
        />
      )}

      <Table highlightOnHover verticalSpacing="md" className="cursor-default">
        <Table.Thead>
          <Table.Tr>
            <Table.Th className="w-[60px]">Type</Table.Th>
            <Table.Th>File Name</Table.Th>
            <Table.Th>File Size</Table.Th>
            <Table.Th>Uploaded At</Table.Th>
            <Table.Th>Created By</Table.Th>
            <Table.Th>Last Viewed</Table.Th>
            <Table.Th className="w-[120px]">Actions</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {isLoading ? (
            Array.from({ length: 5 }).map((_, index) => (
              <Table.Tr key={`skeleton-${index}`}>
                <Table.Td><Skeleton height={32} width={32} radius="sm" /></Table.Td>
                <Table.Td><Skeleton height={14} width={180} radius="xl" /></Table.Td>
                <Table.Td><Skeleton height={14} width={60} radius="xl" /></Table.Td>
                <Table.Td><Skeleton height={14} width={100} radius="xl" /></Table.Td>
                <Table.Td><Skeleton height={14} width={100} radius="xl" /></Table.Td>
                <Table.Td><Skeleton height={14} width={100} radius="xl" /></Table.Td>
                <Table.Td><Skeleton height={14} width={24} radius="xl" /></Table.Td>
              </Table.Tr>
            ))
          ) : (
            data?.map((file: UploadedFile) => (
              <Table.Tr
                onClick={(e) => handleRowClick(e, file)}
                onDoubleClick={(e) => handleRowDoubleClick(e, file)}
                key={file?._id as string}
                ref={(el) => {
                  if (el) rowRefs.current.set(file._id as string, el);
                  else rowRefs.current.delete(file._id as string);
                }}
                onDragOver={(e) => handleDragOver(e, file)}
                onDragLeave={(e) => handleDragLeave(e)}
                onDrop={(e) => handleDrop(e, file)}
                className={`transition-all duration-150 ease-in-out ${dragOverFolderId === file._id
                  ? "border-2 border-solid border-blue-600 shadow-lg"
                  : selectedFiles.has(file._id as string)
                    ? "bg-blue-50 border-b border-gray-200"
                    : "border-b border-gray-200"
                  }`}
                style={{
                  backgroundColor: dragOverFolderId === file._id
                    ? 'var(--mantine-color-blue-3)'
                    : selectedFiles.has(file._id as string)
                      ? 'var(--mantine-color-blue-1)'
                      : undefined,
                  borderColor: dragOverFolderId === file._id ? 'var(--mantine-color-blue-6)' : undefined
                }}
              >
                <Table.Td>
                  <Box
                    draggable
                    onDragStart={(e) => handleDragStart(e, file)}
                    className="flex items-center cursor-grab active:cursor-grabbing w-fit"
                  >
                    <Avatar size="md" radius="sm" className="pointer-events-none" color="indigo" variant="light">
                      {file.isFolder ? (
                        <IconFolder size={24} fill="#fab005" stroke={0.5} color="black" />
                      ) : (
                        <Icon extension={checkAndRetrieveExtension(file.fileName) as FileTypeIconMapKeys} iconSize={24} scaleFactor="_1.5x" />
                      )}
                    </Avatar>
                  </Box>
                </Table.Td>
                <Table.Td>
                  <span
                    draggable
                    onDragStart={(e) => handleDragStart(e, file)}
                    className="cursor-grab active:cursor-grabbing hover:text-blue-600 inline-block w-full"
                  >
                    {file.fileName?.split("/").pop()}
                  </span>
                </Table.Td>
                <Table.Td>
                  <Box className="flex items-center justify-start gap-2">
                    {formatBytes(file.fileSize)}
                    <IconInfoCircle className="cursor-pointer action-icon" onClick={(e) => handleMoreInformation(e as any, file._id as string)} size={16} />
                  </Box>
                </Table.Td>
                <Table.Td>{getShortDate(file?.createdAt as unknown as string)}</Table.Td>
                <Table.Td>{renderUser(file.createdBy)}</Table.Td>
                <Table.Td>{renderUser(file.lastViewedBy, file.lastViewedAt)}</Table.Td>
                <Table.Td>
                  <Box className="flex gap-2 justify-end" onClick={(e) => e.stopPropagation()}>
                    <Menu position="bottom-end" shadow="md" width={200} withinPortal>
                      <Menu.Target>
                        <ActionIcon variant="subtle" color="gray" className="action-icon">
                          <IconDotsVertical size={20} />
                        </ActionIcon>
                      </Menu.Target>

                      <Menu.Dropdown>
                        <Menu.Label>Actions</Menu.Label>
                        {!file.isFolder && isSupportedDocument(file.fileName) && (
                          <Menu.Item
                            leftSection={<IconFileText size={14} />}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenInOnlyOffice(e as any, file._id as string);
                            }}
                          >
                            Open in OnlyOffice
                          </Menu.Item>
                        )}
                        {!file.isFolder && isMediaFile(file.fileName).isMedia && (
                          <Menu.Item
                            leftSection={<IconEye size={14} />}
                            onClick={(e) => {
                              e.stopPropagation();
                              onPreviewMedia?.(file);
                            }}
                          >
                            Preview
                          </Menu.Item>
                        )}
                        {!file.isFolder && isMediaFile(file.fileName).isMedia && (
                          <Menu.Item
                            leftSection={<IconPlayerPlay size={14} />}
                            onClick={(e) => {
                              e.stopPropagation();
                              onDirectPreview?.(file);
                            }}
                          >
                            Direct Preview (R2)
                          </Menu.Item>
                        )}
                        <Menu.Item
                          leftSection={<IconHistory size={14} />}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedFileForHistory({ id: file._id as string, name: file.fileName });
                          }}
                        >
                          History
                        </Menu.Item>
                        <Menu.Item
                          leftSection={<IconShare size={14} />}
                          onClick={(e) => {
                            e.stopPropagation();
                            setShareTarget({ id: file._id as string, name: file.fileName });
                          }}
                        >
                          Share
                        </Menu.Item>
                        <Menu.Item
                          leftSection={<IconTrash size={14} />}
                          color="red"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteFile(file._id as string);
                          }}
                        >
                          Delete
                        </Menu.Item>
                      </Menu.Dropdown>
                    </Menu>
                  </Box>
                </Table.Td>
              </Table.Tr>
            )))}
        </Table.Tbody>

        {selectedFileForHistory && (
          <RevisionHistory
            fileId={selectedFileForHistory.id}
            isOpen={!!selectedFileForHistory}
            onClose={() => setSelectedFileForHistory(null)}
            onViewRevision={(version) => {
              navigate(`/document/${selectedFileForHistory.id}/revision/${version}`);
              setSelectedFileForHistory(null);
            }}
          />
        )}

      </Table>

      {shareTarget && (
        <ShareModal
          opened={!!shareTarget}
          onClose={() => setShareTarget(null)}
          itemId={shareTarget.id}
          itemName={shareTarget.name}
        />
      )}
    </div>
  );
};

export default FileFolderTable;