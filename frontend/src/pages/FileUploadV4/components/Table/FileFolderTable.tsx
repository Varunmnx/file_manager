/* eslint-disable @typescript-eslint/no-explicit-any */
import { Checkbox, Table, ActionIcon, Avatar, Group, Text } from "@mantine/core";
import Icon from "@/components/Icon";
import { UploadedFile, CreatorInfo } from "@/types/file.types";
import { FileTypeIconMapKeys } from "@/utils/fileTypeIcons";
import { checkAndRetrieveExtension } from "../../utils/getFileIcon";
import { formatBytes } from "@/utils/formatBytes";
import { getShortDate } from "@/utils/getDateTime";
import { IconFolder, IconInfoCircle, IconFileText, IconHistory, IconTrash } from "@tabler/icons-react";
import { MouseEvent, useState } from "react";
import useFileGetStatus from "../../hooks/useFileGetStatus";
import { useChunkedUpload } from "../../context/chunked-upload.context";
import { useNavigate } from "react-router-dom";
import { RevisionHistory } from "@/components/RevisionHistory";


interface Props {
  allSelected: boolean;
  indeterminate: boolean;
  selectedFiles: Set<string>;
  handleSelectAll: (checked: boolean) => void;
  handleSelectFile: (uploadId: string, checked: boolean) => void;
  data: UploadedFile[];
  handleDeleteFile: (uploadId: string) => void;
  onFileFolderRowClick?: (entityId: string,isDirectory: boolean) => void;
}

import useUpdateActivity from "../../hooks/useUpdateActivity";

// Helper function to check if file is supported by OnlyOffice
const isSupportedDocument = (fileName: string): boolean => {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const supportedExtensions = ['docx', 'doc', 'xlsx', 'xls', 'pptx', 'ppt', 'odt', 'ods', 'odp', 'pdf'];
  return supportedExtensions.includes(ext);
};

const FileFolderTable = (props: Props) => {
  const {
    allSelected,
    indeterminate,
    selectedFiles,
    handleSelectAll,
    handleSelectFile,
    handleDeleteFile,
    data,
    onFileFolderRowClick
  } = props;

  const getFileDetailsMutation = useFileGetStatus()
  const updateActivityMutation = useUpdateActivity()
  const {setFileDetails, refetchFilesAndFolders} = useChunkedUpload()
  const navigate = useNavigate();
  
  // State for revision history modal
  const [selectedFileForHistory, setSelectedFileForHistory] = useState<{ id: string; name: string } | null>(null);

  function handleMoreInformation(e: MouseEvent<SVGSVGElement, MouseEvent>, id:string) {
    e.stopPropagation();
    e.preventDefault();
    console.log(id)
    
    // Update last viewed
    updateActivityMutation.mutate({ uploadId: id }, {
      onSuccess: () => {
        refetchFilesAndFolders();
      }
    });

    getFileDetailsMutation.mutate(id,{

      onSuccess: (data) => {
        console.log(data)
        setFileDetails(data)
      }
    })
  }

  const handleOpenInOnlyOffice = (e: MouseEvent<HTMLButtonElement, MouseEvent>, fileId: string) => {
    e.stopPropagation();
    e.preventDefault();
    
    // Update last opened
    updateActivityMutation.mutate({ uploadId: fileId }, {
      onSuccess: () => {
        refetchFilesAndFolders();
        navigate(`/document/${fileId}`);
      }
    });
  };

  const handleShowHistory = (e: MouseEvent<HTMLButtonElement, MouseEvent>, file: UploadedFile) => {
    e.stopPropagation();
    e.preventDefault();
    setSelectedFileForHistory({
      id: file._id as string,
      name: file.fileName.split('/').pop() || file.fileName
    });
  };

  const getInitials = (firstName: string, lastName: string) => {
    const first = firstName?.[0]?.toUpperCase() || '';
    const last = lastName?.[0]?.toUpperCase() || '';
    return first + last || '?';
  };

  const renderUser = (user?: CreatorInfo | string, date?: Date) => {
    if (!user) return <Text size="sm">-</Text>;
    
    // Handle string (legacy or simple ID)
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
            <Avatar 
                src={user.picture} 
                alt={user.firstName} 
                radius="xl" 
                size="sm"
                color="blue"
            >
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
    <Table highlightOnHover verticalSpacing="md">
      <Table.Thead>
        <Table.Tr>
          <Table.Th style={{ width: "40px" }}>
            <Checkbox
              checked={allSelected}
              indeterminate={indeterminate}
              onChange={(e) => handleSelectAll(e.currentTarget.checked)}
            />
          </Table.Th>
          <Table.Th style={{ width: "60px" }}>Type</Table.Th>
          <Table.Th>File Name</Table.Th>
          <Table.Th>File Size</Table.Th>
          <Table.Th>Uploaded At</Table.Th>
          <Table.Th>Created By</Table.Th>
          <Table.Th>Last Viewed</Table.Th>
          <Table.Th style={{ width: "120px" }}>Actions</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {data?.map((file: UploadedFile) => (
          <Table.Tr onClick={() => onFileFolderRowClick?.(file._id as string, !!file?.isFolder)} key={file?._id as string}>
            <Table.Td>
              <Checkbox
                checked={selectedFiles.has(file._id as string)}
                onChange={(e) =>
                  handleSelectFile(
                    file._id as string,
                    e.currentTarget.checked,
                  )
                }
              />
            </Table.Td>
            <Table.Td>
               <Avatar 
                  size="md" 
                  radius="sm" 
                  className="cursor-pointer"
                  color="indigo"
                  variant="light"
               >
                 {
                    file.isFolder ? (
                       <IconFolder size={24} fill="var(--mantine-color-yellow-5)" stroke={0.5} color="black" />
                    ) : (
                       <Icon 
                          extension={checkAndRetrieveExtension(file.fileName) as FileTypeIconMapKeys}
                          iconSize={24}
                          scaleFactor="_1.5x" 
                       />
                    )
                 }
               </Avatar>
            </Table.Td>
            <Table.Td>{file.fileName?.split("/").pop()} </Table.Td>
            <Table.Td>
              <div className="flex items-center justify-start gap-2">
                {formatBytes(file.fileSize)}
                <IconInfoCircle className="cursor-pointer" onClick={(e)=>handleMoreInformation(e as any ,file._id  as string)} size={16}/>
              </div>
            </Table.Td>
            <Table.Td>
              {getShortDate(file?.createdAt as unknown as string)}
            </Table.Td>
            <Table.Td>
              {renderUser(file.createdBy)}
            </Table.Td>
            <Table.Td>
              {renderUser(file.lastViewedBy, file.lastViewedAt)}
            </Table.Td>
            <Table.Td>
              <div className="flex gap-2">
                {!file.isFolder && isSupportedDocument(file.fileName) && (
                  <>
                    <ActionIcon 
                      onClick={(e) => handleOpenInOnlyOffice(e as any, file._id as string)} 
                      variant="subtle" 
                      color="blue"
                      title="Open in OnlyOffice"
                    >
                      <IconFileText size={20} />
                    </ActionIcon>
                    <ActionIcon 
                      onClick={(e) => handleShowHistory(e as any, file)} 
                      variant="subtle" 
                      color="violet"
                      title="View Version History"
                    >
                      <IconHistory size={20} />
                    </ActionIcon>
                  </>
                )}
                <ActionIcon onClick={()=>handleDeleteFile(file._id as string)} variant="subtle" color="red">
                  <IconTrash size={20} />
                </ActionIcon>
              </div>
            </Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
      
      {/* Version History Modal */}
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
  );
};

export default FileFolderTable;
