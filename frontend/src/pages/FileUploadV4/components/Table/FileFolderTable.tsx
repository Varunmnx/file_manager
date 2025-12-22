import { Checkbox, Table, ActionIcon } from "@mantine/core";
import Icon from "@/components/Icon";
import { UploadedFile } from "@/types/file.types";
import { FileTypeIconMapKeys } from "@/utils/fileTypeIcons";
import { checkAndRetrieveExtension } from "../../utils/getFileIcon";
import { formatBytes } from "@/utils/formatBytes";
import { getShortDate } from "@/utils/getDateTime";
import { IconFolder } from "@tabler/icons-react";
const TrashIcon = "https://www.svgrepo.com/show/533014/trash-blank.svg";

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
          <Table.Th style={{ width: "60px" }}>Actions</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {data?.map((file: UploadedFile) => (
          <Table.Tr onClick={() => onFileFolderRowClick?.(file._id as string, !!file?.isFolder)} key={file?.uploadId as string}>
            <Table.Td>
              <Checkbox
                checked={selectedFiles.has(file.uploadId as string)}
                onChange={(e) =>
                  handleSelectFile(
                    file.uploadId as string,
                    e.currentTarget.checked,
                  )
                }
              />
            </Table.Td>
            <Table.Td>
              {
                file.isFolder ? (
                  <IconFolder
                    size={24} 
                  />
                ) : (
                  <Icon
                    iconSize={24}
                    scaleFactor="_1.5x"
                    extension={
                      checkAndRetrieveExtension(
                        file.fileName,
                      ) as FileTypeIconMapKeys
                    }
                  />
                )
              } 
            </Table.Td>
            <Table.Td>{file.fileName}</Table.Td>
            <Table.Td>{formatBytes(file.fileSize)}</Table.Td>
            <Table.Td>
              {getShortDate(file?.createdAt as unknown as string)}
            </Table.Td>
            <Table.Td>
              <ActionIcon onClick={()=>handleDeleteFile(file.uploadId as string)} variant="subtle" color="red">
                <img
                  src={TrashIcon}
                  alt="delete"
                  style={{ width: "20px", height: "20px" }}
                />
              </ActionIcon>
            </Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
};

export default FileFolderTable;
