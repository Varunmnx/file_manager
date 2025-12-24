import Dropzone from '@/components/FileUpload';
import { FileItem, FileTreeItem, FolderItem, RootItem } from '@/components/FileUpload/types'; 
import { Modal } from '@mantine/core'
import { useCallback } from 'react';  
import { toast } from 'sonner';
import { UploadQueueState, useChunkedUpload } from '../../context/chunked-upload.context';
import { useParams } from 'react-router-dom';


interface Props{
    opened:boolean;
    close:()=>void
}


const ResourceUploadModal = ({opened,close}:Props) => { 
  const { startUploading, setUploadQueue } = useChunkedUpload()
  const params = useParams()
  const folderId = params?.folderId

  const onDropCallback = useCallback((files: File[], tree: FileTreeItem[]) => {
    console.log('Files dropped:', files);
    console.log('File tree:', tree);
  },[])
 
  const runWhenAnyChunkFails = useCallback((error: string) => {
    toast.error(error)
  }, []);

  const onStartUpload = useCallback((tree: FileTreeItem[]) => {
    let uploadQueueState : UploadQueueState [] = []
    const files:FileItem[] = []
    for(let i=0;i<tree.length;i++){
        const rootORFolder = tree[i] as RootItem | FolderItem
        if(rootORFolder.type === 'root'&& rootORFolder.children.length>0){
          const filesWithIsPaused = rootORFolder?.children?.map(item=>({...item,isPaused:false, status:"idle" as any}))  
          uploadQueueState = filesWithIsPaused
          files.push(...rootORFolder.children)
        }else {
          // create folder 
          // use folder uuid as parent id and upload files recursively also check if child have folder if so again create a folder and upload files under it 
        }
    }
    setUploadQueue(uploadQueueState)
    if(folderId){ 
      setTimeout(()=>startUploading(files,runWhenAnyChunkFails,[folderId]),500)
    }
    else { 
      setTimeout(()=>startUploading(files,runWhenAnyChunkFails,),500)
    }
    close()
  }, [close, folderId, runWhenAnyChunkFails, setUploadQueue, startUploading]);

  return (
      <Modal size={"xl"} opened={opened} onClose={close} title="Upload Resource" centered>
        {/* Modal content */}
        <Dropzone maxFiles={100} maxSize={1000 * 1024 * 1024} onUpload={onStartUpload} onDrop={onDropCallback} />
      </Modal>

  )
}

export default ResourceUploadModal