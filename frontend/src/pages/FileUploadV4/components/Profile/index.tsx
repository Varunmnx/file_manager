import { useAppSelector } from "@/store";
import { clear } from "@/utils";
import { Menu, Avatar, Text, UnstyledButton, Group } from "@mantine/core";
import {
  IconLogout,
  IconUser,
} from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";

const Profile = () => {
  const profile = useAppSelector((state) => state.profileSlice.profile);
  const navigate = useNavigate();

  const handleLogout = () => {
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
              className="cursor-pointer"
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
          leftSection={<IconUser className="w-3.5 h-3.5" />}
          onClick={() => navigate("/profile")}
        >
          My Profile
        </Menu.Item>

        <Menu.Divider />

        <Menu.Item
          color="red"
          leftSection={
            <IconLogout className="w-3.5 h-3.5" />
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
