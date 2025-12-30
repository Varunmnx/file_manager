import { Checkbox, Table, ActionIcon } from "@mantine/core";
import Icon from "@/components/Icon";
import { UploadedFile } from "@/types/file.types";
import { FileTypeIconMapKeys } from "@/utils/fileTypeIcons";
import { checkAndRetrieveExtension } from "../../utils/getFileIcon";
import { formatBytes } from "@/utils/formatBytes";
import { getShortDate } from "@/utils/getDateTime";
import { IconFolder, IconInfoCircle } from "@tabler/icons-react";
import { MouseEvent } from "react";
import useFileGetStatus from "../../hooks/useFileGetStatus";
import { useChunkedUpload } from "../../context/chunked-upload.context";
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

  const getFileDetailsMutation = useFileGetStatus()
  const {setFileDetails} = useChunkedUpload()

  function handleMoreInformation(e: MouseEvent<SVGSVGElement, MouseEvent>, id:string) {
    e.stopPropagation();
    e.preventDefault();
    console.log(id)
    getFileDetailsMutation.mutate(id,{

      onSuccess: (data) => {
        console.log(data)
        setFileDetails(data)
      }
    })
  }

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
            <Table.Td>{file.fileName?.split("/").pop()} </Table.Td>
            <Table.Td className="flex items-center justify-start gap-20">{formatBytes(file.fileSize)}  <IconInfoCircle className="cursor-pointer" onClick={(e)=>handleMoreInformation(e as any ,file._id  as string)} size={16}/></Table.Td>
            <Table.Td>
              {getShortDate(file?.createdAt as unknown as string)}
            </Table.Td>
            <Table.Td>
              <ActionIcon onClick={()=>handleDeleteFile(file._id as string)} variant="subtle" color="red">
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
