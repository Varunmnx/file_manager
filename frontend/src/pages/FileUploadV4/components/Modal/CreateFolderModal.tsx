import { Button, Modal, Stack, TextInput, Group } from '@mantine/core';
import { useParams } from 'react-router-dom';
import { useState } from 'react';
import { IconFolderPlus } from '@tabler/icons-react';

interface Props {
    opened: boolean;
    close: () => void;
    onSubmit: (folderName: string, parentId?: string) => void
}

const CreateFolderModal = (props: Props) => {
  const params = useParams();
  const folderId = params?.folderId;
  const [folderName, setFolderName] = useState('');

  const handleSubmit = () => {
    if (!folderName.trim()) return;
    props.onSubmit(folderName.trim(), folderId);
    setFolderName(''); // Reset after submit
  };

  const handleClose = () => {
    setFolderName('');
    props.close();
  };

  return (
    <Modal 
        opened={props.opened} 
        onClose={handleClose} 
        title="Create New Folder"
        centered
    >
        <Stack gap="md">
             <TextInput
                label="Folder Name"
                placeholder="e.g. Finance Documents"
                value={folderName}
                onChange={(e) => setFolderName(e.currentTarget.value)}
                data-autofocus
                leftSection={<IconFolderPlus size={16} />}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSubmit();
                }}
             />
             
             <Group justify="flex-end" mt="sm">
                <Button variant="default" onClick={handleClose}>Cancel</Button>
                <Button onClick={handleSubmit} disabled={!folderName.trim()}>Create Folder</Button>
             </Group>
        </Stack>
    </Modal>
  )
}

export default CreateFolderModal