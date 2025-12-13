import DraggableBox from "@/components/DraggableBox"
import { useAppDispatch, useAppSelector } from "@/store"
import { setFilesUploading } from "@/store/features/fileUpload/fileUploadSlice"
import { Flex, Text, Progress, ActionIcon, Stack, Group, Box } from "@mantine/core"
import { IconMinus, IconX, IconPlayerPause, IconPlayerPlay, IconTrash } from "@tabler/icons-react"
import { Activity, useState } from "react"

const LiveFileUploadController = () => {
 const files = useAppSelector(state=>state.fileUpload.filesWaitingForUpload)
 const [isMinimized, setIsMinimized] = useState(false)
 const dispatch = useAppDispatch()
  const handlePauseResume = (indexPosition: number) => {
    const filesWithUpdatedStatus = files.map((file, idx) => idx === indexPosition ? {...file, isPaused: !file.isPaused} : file)
    dispatch(setFilesUploading(filesWithUpdatedStatus))
  }

  const handleDelete = (indexPosition: number) => {
    const filesWithoutDeleted = files.filter((_, idx) => idx !== indexPosition)
    dispatch(setFilesUploading(filesWithoutDeleted))
  }

  const handleMinimize = () => {
    setIsMinimized(prev=>!prev)
  }

  return (
    <DraggableBox width="500px" isMinimized={isMinimized} setIsMinimized={() => {}}>
      <Flex p={20} direction="column" gap={16}>
        {/* Header */}
        <Flex direction="row" w="100%" justify="space-between" align="center">
          <Text fw={600} size="lg">Upload Manager</Text>
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
            {files.map((file, idx) => (
              <Box key={`file-item-${idx}`}>
                <Group justify="space-between" mb={8}>
                  <Text size="sm" fw={500} style={{ flex: 1 }} truncate>
                    {file?.name ?? "unknown file"}
                  </Text>
                  <Group gap={8}>
                    <ActionIcon
                      variant="subtle"
                      color={file.isPaused ? "blue" : "yellow"}
                      size="sm"
                      onClick={() => handlePauseResume(idx)}
                    >
                      {file.isPaused ? <IconPlayerPlay size={16} /> : <IconPlayerPause size={16} />}
                    </ActionIcon>
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      size="sm"
                      onClick={() => handleDelete(idx)}
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Group>
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
  )
}

export default LiveFileUploadController