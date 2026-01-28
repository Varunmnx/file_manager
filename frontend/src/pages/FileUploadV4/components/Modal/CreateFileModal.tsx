import { Box, Button, Input, InputLabel, Modal, Select, Stack } from '@mantine/core'
import { useParams } from 'react-router-dom';
import { useState } from 'react';

interface Props {
    opened: boolean;
    close: () => void;
    onSubmit: (fileName: string, parentId?: string) => void
}

const CreateFileModal = (props: Props) => {
  const params = useParams()
  const folderId = params?.folderId
  const [name, setName] = useState('');
  const [extension, setExtension] = useState<string | null>('.docx');

  const handleSubmit = () => {
    if (!name.trim() || !extension) return;
    const fullName = `${name.trim()}${extension}`;
    props.onSubmit(fullName, folderId);
    setName(''); // reset
  };

  return (
    <Modal opened={props.opened} onClose={props.close} title="Create New File">
        <Box p={10}>
             <Stack>
                <div>
                    <InputLabel htmlFor='file-name'>File Name</InputLabel>
                    <Input 
                        name='file-name' 
                        id='file-name' 
                        placeholder="My Document" 
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                    />
                </div>
                <div>
                    <InputLabel htmlFor='file-type'>File Type</InputLabel>
                    <Select
                        id='file-type'
                        data={[
                            { value: '.docx', label: 'Word Document (.docx)' },
                            { value: '.xlsx', label: 'Excel Spreadsheet (.xlsx)' },
                            { value: '.pptx', label: 'PowerPoint Presentation (.pptx)' },
                            { value: '.txt', label: 'Text File (.txt)' },
                        ]}
                        value={extension}
                        onChange={setExtension}
                        allowDeselect={false}
                    />
                </div>
                <Button onClick={handleSubmit} disabled={!name.trim()}>Create</Button>
             </Stack>
        </Box>
    </Modal>
  )
}

export default CreateFileModal
