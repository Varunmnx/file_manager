import Dropzone from '@/components/FileUpload';
import { FileTreeItem, FolderItem, RootItem } from '@/components/FileUpload/types';
import { useAppDispatch } from '@/store';
import { FilesWaitingForUpload, setFilesWaitingForUpload } from '@/store/features/fileUpload/fileUploadSlice';
import { Modal } from '@mantine/core'
import { useCallback } from 'react';


interface Props{
    opened:boolean;
    close:()=>void
}


const ResourceUploadModal = ({opened,close}:Props) => {
  const dispatch = useAppDispatch()
  const onDropCallback = useCallback((files: File[], tree: FileTreeItem[]) => {
    console.log('Files dropped:', files);
    console.log('File tree:', tree);
  },[])

  const onStartUpload = useCallback((tree: FileTreeItem[]) => {
    let files : FilesWaitingForUpload [] = []
    for(let i=0;i<tree.length;i++){
        const rootORFolder = tree[i] as RootItem | FolderItem
        if(rootORFolder.type === 'root'&& rootORFolder.children.length>0){
          const filesWithIsPaused = rootORFolder?.children?.map(item=>({...item,isPaused:false}))  
          files = filesWithIsPaused
        }
    }
    dispatch(setFilesWaitingForUpload(files))
    close()
  }, [close, dispatch]);

  return (
      <Modal size={"xl"} opened={opened} onClose={close} title="Upload Resource" centered>
        {/* Modal content */}
        <Dropzone maxFiles={100} maxSize={100 * 1024 * 1024} onUpload={onStartUpload} onDrop={onDropCallback} />
      </Modal>

  )
}

export default ResourceUploadModal