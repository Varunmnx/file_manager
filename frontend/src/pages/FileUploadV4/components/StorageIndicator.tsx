import { Progress, Text, Tooltip, Stack } from "@mantine/core";
import { useStorageInfo } from "../hooks/useStorageInfo";

function formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
}

export default function StorageIndicator() {
    const { data, isLoading } = useStorageInfo();

    if (isLoading || !data) return null;

    const { storageUsed, storageLimit } = data;
    const percentage = Math.min(100, (storageUsed / storageLimit) * 100);

    let color: string = "blue";
    if (percentage > 90) color = "red";
    else if (percentage > 70) color = "orange";
    else if (percentage > 50) color = "yellow";

    return (
        <Tooltip
            label={`${formatBytes(storageUsed)} of ${formatBytes(storageLimit)} used`}
            position="bottom"
        >
            <Stack gap={2} style={{ minWidth: 120 }}>
                <Text size="xs" c="dimmed" ta="center" style={{ userSelect: "none" }}>
                    {formatBytes(storageUsed)} / {formatBytes(storageLimit)}
                </Text>
                <Progress value={percentage} color={color} size="sm" radius="xl" />
            </Stack>
        </Tooltip>
    );
}
