import DraggableBox from "@/components/DraggableBox"
import { Flex, Text, Progress, ActionIcon, Stack, Group, Box } from "@mantine/core"
import { IconMinus, IconX, IconPlayerPause, IconPlayerPlay, IconTrash } from "@tabler/icons-react"
import { useState } from "react"

const LiveFileUploadController = () => {
  const [files, setFiles] = useState([
    { id: 1, fileName: "a.xls", percentage: 10, isPaused: false },
    { id: 2, fileName: "b.xls", percentage: 20, isPaused: false },
    { id: 3, fileName: "c.xls", percentage: 30, isPaused: true }
  ])

  const handlePauseResume = (id: number) => {
    setFiles(files.map(file => 
      file.id === id ? { ...file, isPaused: !file.isPaused } : file
    ))
  }

  const handleDelete = (id: number) => {
    setFiles(files.filter(file => file.id !== id))
  }

  return (
    <DraggableBox width="500px" isMinimized={false} setIsMinimized={() => {}}>
      <Flex p={20} direction="column" gap={16}>
        {/* Header */}
        <Flex direction="row" w="100%" justify="space-between" align="center">
          <Text fw={600} size="lg">Upload Manager</Text>
          <Flex ml="auto" gap={10}>
            <ActionIcon variant="subtle" color="gray">
              <IconMinus size={16} />
            </ActionIcon>
            <ActionIcon variant="subtle" color="gray">
              <IconX size={16} />
            </ActionIcon>
          </Flex>
        </Flex>

        {/* Files with upload status */}
        <Stack gap={12}>
          {files.map((file) => (
            <Box key={file.id}>
              <Group justify="space-between" mb={8}>
                <Text size="sm" fw={500} style={{ flex: 1 }} truncate>
                  {file.fileName}
                </Text>
                <Group gap={8}>
                  <ActionIcon
                    variant="subtle"
                    color={file.isPaused ? "blue" : "yellow"}
                    size="sm"
                    onClick={() => handlePauseResume(file.id)}
                  >
                    {file.isPaused ? <IconPlayerPlay size={16} /> : <IconPlayerPause size={16} />}
                  </ActionIcon>
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    size="sm"
                    onClick={() => handleDelete(file.id)}
                  >
                    <IconTrash size={16} />
                  </ActionIcon>
                </Group>
              </Group>
              <Group gap={8} align="center">
                <Progress
                  value={file.percentage}
                  size="sm"
                  style={{ flex: 1 }}
                  color={file.isPaused ? "gray" : "blue"}
                  animated={!file.isPaused}
                />
                <Text size="xs" c="dimmed" style={{ minWidth: 40 }}>
                  {file.percentage}%
                </Text>
              </Group>
            </Box>
          ))}
        </Stack>
      </Flex>
    </DraggableBox>
  )
}

export default LiveFileUploadController