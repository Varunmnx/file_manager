import { useAppSelector } from "@/store";
import { clear } from "@/utils";
import { Menu, Avatar, Text, UnstyledButton, Group, rem } from "@mantine/core";
import {
  IconFolder,
  IconLogout,
  IconTrash,
  IconUpload,
  IconUser,
} from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";

interface Props {
  deleteAllUploads: () => void;
  onResourceUpload: () => void;
  openCreateNewFolder: () => void;
}

const Profile = ({
  deleteAllUploads,
  onResourceUpload,
  openCreateNewFolder,
}: Props) => {
  const profile = useAppSelector((state) => state.profileSlice.profile);
  const navigate = useNavigate();

  const handleLogout = () => {
    // Add your logout logic here
    // e.g., dispatch(logout()), clear tokens, etc.
    clear()
    window.location.reload()
  };

    const getInitials = () => {
    if (!profile?.firstName) return '?';
    const first = profile.firstName[0]?.toUpperCase() || '';
    const last = profile.lastName?.[0]?.toUpperCase() || '';
    return first + last;
  };

  return (
    <Menu shadow="md" width={200} position="bottom-end" withArrow>
      <Menu.Target>
        <UnstyledButton>
          <Group gap="sm">
          <Avatar 
              src={profile?.picture || undefined}
              alt={profile?.firstName || 'User'}
              radius="xl"
              size="md"
              style={{ cursor: 'pointer' }}
              imageProps={{ 
                crossOrigin: 'anonymous',
                referrerPolicy: 'no-referrer'
              }}
            >
              {getInitials()}
            </Avatar>
          </Group>
        </UnstyledButton>
      </Menu.Target>

      <Menu.Dropdown>
        <Menu.Label>
          <Text size="sm" fw={500}>
            {profile?.firstName}
          </Text>
          <Text size="xs" c="dimmed">
            {profile?.email}
          </Text>
        </Menu.Label>

        <Menu.Divider />

        <Menu.Item
          leftSection={<IconUser style={{ width: rem(14), height: rem(14) }} />}
          onClick={() => navigate("/profile")}
        >
          My Profile
        </Menu.Item>

        <Menu.Label>Application</Menu.Label>
        <Menu.Item
          onClick={onResourceUpload}
          leftSection={<IconUpload size={14} />}
        >
          Upload
        </Menu.Item>
        <Menu.Item
          onClick={deleteAllUploads}
          leftSection={<IconTrash size={14} />}
        >
          Delete All
        </Menu.Item>
        <Menu.Item
          onClick={openCreateNewFolder}
          leftSection={<IconFolder size={14} />}
        >
          Create New Folder
        </Menu.Item>

        <Menu.Item
          color="red"
          leftSection={
            <IconLogout style={{ width: rem(14), height: rem(14) }} />
          }
          onClick={handleLogout}
        >
          Logout
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
};

export default Profile;
