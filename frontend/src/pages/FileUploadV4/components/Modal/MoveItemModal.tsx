import { Modal, Button, Group, Text, ScrollArea, List, ThemeIcon, ActionIcon, Breadcrumbs, Box } from "@mantine/core";
import { IconFolder, IconChevronRight, IconArrowLeft } from "@tabler/icons-react";
import { useState, useEffect } from "react";
import { API, Slug } from "@/services";
import { UploadedFile } from "@/types/file.types";
import useMoveItem from "../../hooks/useMoveItem";
import { toast } from "sonner";

interface Props {
  opened: boolean;
  onClose: () => void;
  itemsToMove: UploadedFile[];
  onSuccess: () => void;
}

const MoveItemModal = ({ opened, onClose, itemsToMove, onSuccess }: Props) => {
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [folders, setFolders] = useState<UploadedFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<{ id: string | null; name: string }[]>([{ id: null, name: "Home" }]);
  const moveItemMutation = useMoveItem();

  const fetchFolders = async (parentId: string | null) => {
    setLoading(true);
    try {
      const slug = parentId ? `${Slug.GET_ALL_FILES}?folderId=${parentId}` : Slug.GET_ALL_FILES;
      const data = await API.get({ slug });
      
      const movingIds = new Set(itemsToMove.map(item => item._id));
      
      // Filter only folders and exclude all items that are currently being moved
      const onlyFolders = (data as UploadedFile[]).filter(
        (item) => item.isFolder && !movingIds.has(item._id)
      );
      setFolders(onlyFolders);
    } catch (error) {
      console.error("Failed to fetch folders", error);
      toast.error("Failed to load folders");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (opened) {
      fetchFolders(null);
      setHistory([{ id: null, name: "Home" }]);
      setCurrentFolderId(null);
    }
  }, [opened]);

  const handleNavigate = (folderId: string | null, folderName: string) => {
    setCurrentFolderId(folderId);
    if (folderId === null) {
        setHistory([{ id: null, name: "Home" }]);
    } else {
        setHistory(prev => [...prev, { id: folderId, name: folderName }]);
    }
    fetchFolders(folderId);
  };

  const handleBack = () => {
    if (history.length > 1) {
      const newHistory = [...history];
      newHistory.pop();
      const previousFolder = newHistory[newHistory.length - 1];
      setHistory(newHistory);
      setCurrentFolderId(previousFolder.id);
      fetchFolders(previousFolder.id);
    }
  };

  const handleMove = async () => {
    const movePromises = itemsToMove.map(item => 
      moveItemMutation.mutateAsync({ uploadId: item._id as string, newParentId: currentFolderId })
    );

    toast.promise(Promise.all(movePromises), {
      loading: `Moving ${itemsToMove.length} item(s)...`,
      success: () => {
        onSuccess();
        onClose();
        return "Moved successfully";
      },
      error: (error) => error?.response?.data?.message || "Failed to move items"
    });
  };

  const isCurrentParent = () => {
    if (itemsToMove.length === 0) return true;
    
    // Check if every item is already in the selected currentFolderId
    return itemsToMove.every(item => {
        const lastParentId = item.parents?.[item.parents.length - 1]?.toString() || null;
        return lastParentId === currentFolderId;
    });
  };

  const modalTitle = itemsToMove.length === 1 
    ? `Move "${itemsToMove[0].fileName}"`
    : `Move ${itemsToMove.length} items`;

  return (
    <Modal opened={opened} onClose={onClose} title={modalTitle} size="md">
      <Box mb="md">
        <Group gap="xs" mb="xs">
          {history.length > 1 && (
            <ActionIcon variant="subtle" onClick={handleBack}>
              <IconArrowLeft size={16} />
            </ActionIcon>
          )}
          <Breadcrumbs separator=">">
            {history.map((item, index) => (
              <Text key={index} size="sm" fw={index === history.length - 1 ? 700 : 400}>
                {item.name}
              </Text>
            ))}
          </Breadcrumbs>
        </Group>
      </Box>

      <ScrollArea h={300} type="always">
        {loading ? (
          <Text size="sm" c="dimmed" ta="center" py="xl">Loading folders...</Text>
        ) : folders.length === 0 ? (
          <Text size="sm" c="dimmed" ta="center" py="xl">No subfolders found</Text>
        ) : (
          <List spacing="xs" size="sm" center>
            {folders.map((folder) => (
              <List.Item
                key={folder._id as string}
                icon={
                  <ThemeIcon color="yellow" size={24} variant="light">
                    <IconFolder size={16} />
                  </ThemeIcon>
                }
                className="hover:bg-gray-50 p-2 rounded-md cursor-pointer transition-colors"
                onClick={() => handleNavigate(folder._id as string, folder.fileName)}
              >
                <Group justify="space-between" wrap="nowrap" w="100%">
                  <Text size="sm" truncate>{folder.fileName}</Text>
                  <IconChevronRight size={14} color="gray" />
                </Group>
              </List.Item>
            ))}
          </List>
        )}
      </ScrollArea>

      <Group justify="right" mt="xl">
        <Button variant="subtle" onClick={onClose}>Cancel</Button>
        <Button 
          onClick={handleMove} 
          loading={moveItemMutation.isPending}
          disabled={isCurrentParent()}
        >
          Move here
        </Button>
      </Group>
    </Modal>
  );
};

export default MoveItemModal;
