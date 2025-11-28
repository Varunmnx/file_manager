import { Menu, Button } from '@mantine/core';
import {
  IconUpload
} from '@tabler/icons-react';


interface Props {
  onResourceUpload: () => void
}

export default function ToggleMenu(props:Props) {
  const { onResourceUpload } = props

  return (
    <Menu shadow="md" width={200}>
      <Menu.Target>
        <Button>Actions</Button>
      </Menu.Target>

      <Menu.Dropdown>
        <Menu.Label>Application</Menu.Label>
        <Menu.Item onClick={onResourceUpload} leftSection={<IconUpload size={14} />}>
          Upload 
        </Menu.Item>
        {/* <Menu.Item leftSection={<IconMessageCircle size={14} />}>
          Messages
        </Menu.Item>
        <Menu.Item leftSection={<IconPhoto size={14} />}>
          Gallery
        </Menu.Item>
        <Menu.Item
          leftSection={<IconSearch size={14} />}
          rightSection={
            <Text size="xs" c="dimmed">
              ⌘K
            </Text>
          }
        >
          Search
        </Menu.Item> */}

        {/* <Menu.Divider /> */}

        {/* <Menu.Label>Danger zone</Menu.Label>
        <Menu.Item
          leftSection={<IconArrowsLeftRight size={14} />}
        >
          Transfer my data
        </Menu.Item>
        <Menu.Item
          color="red"
          leftSection={<IconTrash size={14} />}
        >
          Delete my account
        </Menu.Item> */}
      </Menu.Dropdown>
    </Menu>
  );
}