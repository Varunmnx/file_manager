import { Accordion, Group, Text, Button, Box, Flex } from "@mantine/core";
import { IconFolder, IconFile, IconX } from "@tabler/icons-react";
import { formatBytes } from "@/utils/formatBytes";
import { FileItem, FolderItem } from "./types";

interface FolderItemProps {
  folder: FolderItem;
  onRemove: () => void;
}

interface TreeNode {
  name: string;
  isFolder: boolean;
  size: number;
  fullPath: string;
  originalFile?: File;
  children: Map<string, TreeNode>;
  fileCount: number;
  totalSize: number;
}

/**
 * Builds a tree structure from flat FileItem array
 * Identifies folders by analyzing paths
 * Skips the first path part if it matches the parent folder name
 */
function buildFileTree(items: FileItem[], parentFolderName: string): TreeNode[] {
  const root = new Map<string, TreeNode>();

  // Build the tree structure
  items.forEach((item) => {
    let pathParts = item.path.split("/").filter(part => part.trim() !== "");
    
    // Remove the parent folder name if it's the first part of the path
    if (pathParts.length > 0 && pathParts[0] === parentFolderName) {
      pathParts = pathParts.slice(1);
    }
    
    // Skip if path is empty after removing parent
    if (pathParts.length === 0) return;
    
    let currentLevel = root;

    // Traverse/create path
    for (let i = 0; i < pathParts.length; i++) {
      const part = pathParts[i];
      const isFile = i === pathParts.length - 1;
      const fullPath = pathParts.slice(0, i + 1).join("/");

      if (!currentLevel.has(part)) {
        currentLevel.set(part, {
          name: part,
          isFolder: !isFile,
          size: isFile ? item.size : 0,
          fullPath,
          originalFile: isFile ? item.file : undefined,
          children: new Map(),
          fileCount: isFile ? 1 : 0,
          totalSize: isFile ? item.size : 0,
        });
      }

      const node = currentLevel.get(part)!;
      
      if (isFile) {
        // Update file node
        node.size = item.size;
        node.originalFile = item.file;
        node.isFolder = false;
      }

      currentLevel = node.children;
    }
  });

  // Calculate folder statistics recursively
  function calculateStats(node: TreeNode): void {
    if (node.children.size > 0) {
      node.isFolder = true;
      let totalFiles = 0;
      let totalSize = 0;

      node.children.forEach((child) => {
        calculateStats(child);
        totalFiles += child.fileCount;
        totalSize += child.totalSize;
      });

      node.fileCount = totalFiles;
      node.totalSize = totalSize;
    }
  }

  const rootNodes = Array.from(root.values());
  rootNodes.forEach(calculateStats);

  return rootNodes;
}

/**
 * Recursive component to render nested file/folder structure
 */
function NestedItem({ 
  node, 
  depth = 0 
}: { 
  node: TreeNode; 
  depth?: number;
}) {
  if (!node.isFolder) {
    // Render file
    return (
      <Group 
        wrap="nowrap" 
        p="xs" 
        pl={`${depth * 24 + 12}px`}
        align="center" 
        gap="sm"
        style={{
          borderLeft: depth > 0 ? "1px solid #e9ecef" : "none",
        }}
      >
        <IconFile size={16} color="#868e96" />
        <Box style={{ flex: 1, minWidth: 0 }}>
          <Text size="xs" fw={500} lineClamp={1}>
            {node.name}
          </Text>
          <Text size="xs" c="dimmed">
            {formatBytes(node.size)}
          </Text>
        </Box>
      </Group>
    );
  }

  // Render folder with nested content
  const childNodes = Array.from(node.children.values());

  return (
    <Box>
      <Accordion 
        variant="contained"
        chevronPosition="right"
        styles={{
          item: {
            marginLeft: depth > 0 ? `${depth * 16}px` : 0,
            border: "none",
          },
          control: {
            padding: "8px 12px",
          },
          content: {
            padding: 0,
          },
        }}
      >
        <Accordion.Item value={node.fullPath}>
          <Accordion.Control>
            <Flex gap="sm" align="center">
              <IconFolder size={18} color="#fab005" />
              <Box style={{ flex: 1, minWidth: 0 }}>
                <Text size="xs" fw={600} lineClamp={1}>
                  {node.name}
                </Text>
                <Text size="xs" c="dimmed">
                  {node.fileCount} {node.fileCount === 1 ? 'file' : 'files'} • {formatBytes(node.totalSize)}
                </Text>
              </Box>
            </Flex>
          </Accordion.Control>

          <Accordion.Panel>
            {childNodes.map((child) => (
              <NestedItem 
                key={child.fullPath} 
                node={child} 
                depth={depth + 1} 
              />
            ))}
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>
    </Box>
  );
}

/**
 * Main folder component with delete functionality
 */
export function FolderItemComponent({ folder, onRemove }: FolderItemProps) {
  const treeNodes = buildFileTree(folder.children, folder.name);

  return (
    <Accordion variant="default" chevronPosition="left">
      <Accordion.Item value={folder.name} >
        <Accordion.Control
          pr={0}
          onClick={(event) => {
            if ((event.target as HTMLElement).closest("[data-delete-button]")) {
              event.preventDefault();
            }
          }}
        >
          <Flex gap="md" align="center" justify="space-between" w="100%">
            <Flex gap="md" align="center" style={{ flex: 1, minWidth: 0 }}>
              <IconFolder size={24} color="#fab005" />
              <Box style={{ flex: 1, minWidth: 0 }}>
                <Text size="sm" fw={600} lineClamp={1}>
                  {folder.name}
                </Text>
                <Text size="xs" c="dimmed">
                  {folder.fileCount} {folder.fileCount === 1 ? 'file' : 'files'} • {formatBytes(folder.totalSize)}
                </Text>
              </Box>
            </Flex>

            <Button
              data-delete-button
              size="compact-sm"
              variant="subtle"
              color="red"
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
            >
              <IconX size={16} />
            </Button>
          </Flex>
        </Accordion.Control>

        <Accordion.Panel p="xs">
          {treeNodes.length > 0 ? (
            treeNodes.map((node) => (
              <NestedItem 
                key={node.fullPath} 
                node={node} 
                depth={0} 
              />
            ))
          ) : (
            <Text size="xs" c="dimmed" p="md" ta="center">
              No files in this folder
            </Text>
          )}
        </Accordion.Panel>
      </Accordion.Item>
    </Accordion>
  );
}