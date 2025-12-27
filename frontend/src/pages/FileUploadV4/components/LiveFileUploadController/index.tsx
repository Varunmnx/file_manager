import DraggableBox from "@/components/DraggableBox";
import {
  Flex,
  Text,
  Progress,
  ActionIcon,
  Stack,
  Group,
  Box,
} from "@mantine/core";
import {
  IconMinus,
  IconX,
  IconPlayerPause,
  IconPlayerPlay,
  IconTrash,
} from "@tabler/icons-react";
import { Activity, useEffect, useState } from "react";
import {
  UploadQueueState,
  useChunkedUpload,
} from "../../context/chunked-upload.context";

const LiveFileUploadController = () => {
  const { uploadQueue } = useChunkedUpload();
  const [isMinimized, setIsMinimized] = useState(false);
  const { pauseUpload, cancelCurrentUpload } = useChunkedUpload();

const [processingUploads, setProcessingUploads] = useState<Set<string>>(new Set());

const handlePauseResume = (uploadQueueItem: UploadQueueState) => {
  const uploadId = uploadQueueItem.uploadId;
  if (!uploadId || processingUploads.has(uploadId)) return;
  
  setProcessingUploads(prev => new Set(prev).add(uploadId));
  
  pauseUpload(uploadQueueItem).finally(() => {
    console.log("pause complete")
    setProcessingUploads(prev => {
      const next = new Set(prev);
      next.delete(uploadId);
      return next;
    });
  });
};
  const handleDelete = (uploadId: string) => {
    cancelCurrentUpload(uploadId);
  };

  const handleMinimize = () => {
    setIsMinimized((prev) => !prev);
  };




  console.log("uploadQueue", uploadQueue);

  return (
    <DraggableBox
      width="500px"
      isMinimized={isMinimized}
      setIsMinimized={() => {}}
    >
      <Flex
        p={20}
        direction="column"
        gap={16}
        style={{ maxHeight: "400px", overflow: "scroll" }}
      >
        {/* Header */}
        <Flex direction="row" w="100%" justify="space-between" align="center">
          <Text fw={600} size="lg">
            Upload Manager
          </Text>
          <Flex ml="auto" gap={10}>
            <ActionIcon onClick={handleMinimize} variant="subtle" color="gray">
              <IconMinus size={16} />
            </ActionIcon>
            <ActionIcon variant="subtle" color="gray">
              <IconX size={16} />
            </ActionIcon>
          </Flex>
        </Flex>

        {/* Files with upload status */}
        <Activity mode={isMinimized ? "hidden" : "visible"}>
          <Stack gap={12}>
            {uploadQueue
              ?.filter(
                (file) =>{
                  return (file.status == "uploading") || (file.status == "paused") || (file.status == "initiating"|| file.status == "idle")
                }
              )
              .map((file, idx) => (
                <Box key={`file-item-${idx}`}>
                  <Group justify="space-between" mb={8}>
                    <Text size="sm" fw={500} style={{ flex: 1 }} truncate>
                      {file?.name ?? "unknown file"}
                    </Text>
                    {file?.uploadId && (
                      <Group gap={8}>
                        <ActionIcon
                          variant="subtle"
                          color={file.isPaused ? "blue" : "yellow"}
                          size="sm"
  onClick={() => handlePauseResume(file)}
  disabled={processingUploads.has(file.uploadId)}
  opacity={processingUploads.has(file.uploadId) ? 0.5 : 1}
                        >
                          {file.isPaused ? (
                            <IconPlayerPlay size={16} />
                          ) : (
                            <IconPlayerPause size={16} />
                          )}
                        </ActionIcon>
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          size="sm"
                          onClick={() => handleDelete(file.uploadId as string)}
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Group>
                    )}
                  </Group>
                  <Group gap={8} align="center">
                    <Progress
                      value={file?.percentage ?? 0}
                      size="sm"
                      style={{ flex: 1 }}
                      color={file.isPaused ? "gray" : "blue"}
                      animated={!file.isPaused}
                    />
                    <Text size="xs" c="dimmed" style={{ minWidth: 40 }}>
                      {file?.percentage ?? 0}%
                    </Text>
                  </Group>
                </Box>
              ))}
          </Stack>
        </Activity>
      </Flex>
    </DraggableBox>
  );
};

export default LiveFileUploadController;
