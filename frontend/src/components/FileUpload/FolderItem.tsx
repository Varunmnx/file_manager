import { Accordion, Group, Text, Button, Box, Flex } from "@mantine/core";
import { IconFolder, IconFile, IconX } from "@tabler/icons-react";
import { formatBytes } from "@/utils/formatBytes";
import { FolderItem } from "./types";

interface FolderItemProps {
  folder: FolderItem;
  onRemove: () => void;
}

export function FolderItemComponent({ folder, onRemove }: FolderItemProps) {
  return (
    <Accordion variant="default" chevronPosition="left">
      <Accordion.Item value={folder.name}>
        <Accordion.Control
          icon={
            <Button
              data-delete-button
              size="compact-sm"
              variant="subtle"
              color="red"
              onClick={(e) => {
                e.stopPropagation(); // Prevent accordion toggle
                onRemove();
              }}
              ml="auto"
            >
              <IconX size={16} />
            </Button>
          }
          pr={0}
          onClick={(event) => {
            // Prevent accordion toggle when clicking delete icon
            if ((event.target as HTMLElement).closest("[data-delete-button]")) {
              event.preventDefault();
            }
          }}
        >
          <Flex gap="md" align="center" direction={"row"}>
            <IconFolder size={24} color="gray" />
            <Text size="sm" fw={600} lineClamp={1}>
              {folder.name}
            </Text>
            <Text size="xs" c="dimmed">
              {folder.fileCount} files • {formatBytes(folder.totalSize)}
            </Text>
          </Flex>
          {/* Delete button inside the control */}
        </Accordion.Control>

        <Accordion.Panel>
          <Box p="xs">
            {folder.children.map((child, index) => (
              <Group key={index} wrap="nowrap" p="xs" align="center" gap="sm">
                <IconFile size={24} color="gray" />
                <Box style={{ flex: 1, minWidth: 0 }}>
                  <Text size="xs" fw={500} lineClamp={1}>
                    {child.name}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {formatBytes(child.size)}
                  </Text>
                </Box>
              </Group>
            ))}
          </Box>
        </Accordion.Panel>
      </Accordion.Item>
    </Accordion>
  );
}
