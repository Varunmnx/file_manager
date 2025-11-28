import { UploadedFile } from "@/types/file.types";
import useGetFiles from "./hooks/useGetFiles";
import { useState } from "react"; 
import FileFolderTable from "./components/Table/FileFolderTable";
import ToggleMenu from "./components/Menu";
import { Flex } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import ResourceUploadModal from "./components/Modal/ResourceUploadModal";


const Page = () => {
  const { data, isLoading } = useGetFiles();
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [opened, { open, close }] = useDisclosure(false);
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedFiles(new Set(data?.map((file: UploadedFile) => file.uploadId as string)));
    } else {
      setSelectedFiles(new Set());
    }
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

  const allSelected = (data?.length ?? 0) > 0 && selectedFiles.size === data?.length;
  const indeterminate = selectedFiles.size > 0 && selectedFiles.size < (data?.length || 0);
  
  if(isLoading) {
    return <div>Loading...</div>
  }

  return (
    <div className="w-screen h-screen flex justify-center">
      {
        opened && (
          <ResourceUploadModal opened={opened} close={close} />
        )
      }
      <div className="w-3/4 py-8">
        <Flex justify="space-between" align={"center"}>
           <h1 className="text-2xl font-bold">All Files</h1>
           <ToggleMenu onResourceUpload={open} />
        </Flex>
        <div className="mt-10" />
        <FileFolderTable allSelected={allSelected} indeterminate={indeterminate} selectedFiles={selectedFiles} handleSelectAll={handleSelectAll} handleSelectFile={handleSelectFile} data={data ?? []} />
      </div>
    </div>
  );
};

export default Page;