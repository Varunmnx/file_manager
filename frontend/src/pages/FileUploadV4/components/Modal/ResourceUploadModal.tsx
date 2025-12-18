import Dropzone from '@/components/FileUpload';
import { FileTreeItem, FolderItem, RootItem } from '@/components/FileUpload/types'; 
import { Modal } from '@mantine/core'
import { useCallback } from 'react';  
import { toast } from 'sonner';
import { UploadQueueState, useChunkedUpload } from '../../context/chunked-upload.context';


interface Props{
    opened:boolean;
    close:()=>void
}


const ResourceUploadModal = ({opened,close}:Props) => { 
  const { startUploading, setUploadQueue } = useChunkedUpload()

  const onDropCallback = useCallback((files: File[], tree: FileTreeItem[]) => {
    console.log('Files dropped:', files);
    console.log('File tree:', tree);
  },[])
 
  const runWhenAnyChunkFails = useCallback((error: string) => {
    toast.error(error)
  }, []);

  const onStartUpload = useCallback((tree: FileTreeItem[]) => {
    let files : UploadQueueState [] = []
    for(let i=0;i<tree.length;i++){
        const rootORFolder = tree[i] as RootItem | FolderItem
        if(rootORFolder.type === 'root'&& rootORFolder.children.length>0){
          const filesWithIsPaused = rootORFolder?.children?.map(item=>({...item,isPaused:false}))  
          files = filesWithIsPaused
        }
    }
    setUploadQueue(files)
    startUploading(files,runWhenAnyChunkFails)
    close()
  }, [close, runWhenAnyChunkFails, setUploadQueue, startUploading]);

  return (
      <Modal size={"xl"} opened={opened} onClose={close} title="Upload Resource" centered>
        {/* Modal content */}
        <Dropzone maxFiles={100} maxSize={100 * 1024 * 1024} onUpload={onStartUpload} onDrop={onDropCallback} />
      </Modal>

  )
}

export default ResourceUploadModal