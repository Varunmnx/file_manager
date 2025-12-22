import { Box, Button, Input, InputLabel, Modal } from '@mantine/core'
import { useParams } from 'react-router-dom';

interface Props {
    opened: boolean;
    close: () => void;
    onSubmit: (folderName: string, parentId?: string) => void
}

const CreateFolderModal = (props: Props) => {
  const params = useParams()
  const folderId = params?.folderId
  console.log(params)
  return (
    <Modal opened={props.opened} onClose={props.close}>
        <Box p={10}>
             <InputLabel htmlFor='folder-name'>Folder Name</InputLabel>
             <Input name='folder-name' id='folder-name' placeholder="Folder Name" />
             <Button onClick={()=>props.onSubmit((document.getElementById('folder-name') as HTMLInputElement)?.value, folderId)}>Submit</Button>
        </Box>
    </Modal>
  )
}

export default CreateFolderModal