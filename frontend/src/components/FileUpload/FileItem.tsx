import "./index.css";
import { formatBytes } from "@/utils/formatBytes";
import { FileItem } from "./types";
import Icon from "../Icon";
import { checkAndRetrieveExtension } from "@/pages/FileUploadV4/utils/getFileIcon";
import { FileTypeIconMapKeys } from "@/utils/fileTypeIcons";
import { Button } from "@mantine/core";
import { IconX } from "@tabler/icons-react";

// FileItem.tsx
interface FileItemProps {
  file: FileItem;
  onRemove: () => void;
}

export default function FileItemComponent({ file, onRemove }: FileItemProps) {
  return (
    <div className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:shadow-sm transition-shadow">
      <div className="flex items-center space-x-3 flex-1 min-w-0">
        <Icon
          iconSize={32}
          scaleFactor="_1.5x"
          extension={
            checkAndRetrieveExtension(file.name) as FileTypeIconMapKeys
          }
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">
            {file.name}
          </p>
          <p className="text-xs text-gray-500">{formatBytes(file.size)}</p>
        </div>
      </div>
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
    </div>
  );
}
