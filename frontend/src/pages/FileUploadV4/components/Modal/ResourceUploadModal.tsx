import Dropzone from '@/components/FileUpload';
import { FileTreeItem } from '@/components/FileUpload/types';
import { Modal } from '@mantine/core'
import { useCallback } from 'react';


interface Props{
    opened:boolean;
    close:()=>void
}

const ResourceUploadModal = ({opened,close}:Props) => {
  const onDropCallback = useCallback((files: File[], tree: FileTreeItem[]) => {
    console.log('Files dropped:', files);
    console.log('File tree:', tree);
  },[])
  return (
      <Modal size={"xl"} opened={opened} onClose={close} title="Upload Resource" centered>
        {/* Modal content */}
        <Dropzone maxFiles={100} maxSize={100 * 1024 * 1024} onDrop={onDropCallback} />
      </Modal>

  )
}

export default ResourceUploadModal