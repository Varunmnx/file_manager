import { Modal, ActionIcon, Group, Text, Loader, Badge, Tooltip, CopyButton } from "@mantine/core";
import {
    IconX,
    IconDownload,
    IconMaximize,
    IconMinimize,
    IconLink,
    IconClock,
    IconCheck,
    IconCopy,
    IconExternalLink,
    IconRefresh,
} from "@tabler/icons-react";
import { useState, useEffect, useCallback } from "react";
import { UploadedFile } from "@/types/file.types";
import { API, Slug } from "@/services";
import { isMediaFile } from "./MediaPreviewModal";

interface PreviewUrlResponse {
    url: string;
    fileName: string;
    fileSize: number;
    contentType: string;
    expiresInSeconds: number;
}

interface DirectPreviewModalProps {
    opened: boolean;
    onClose: () => void;
    file: UploadedFile | null;
}

const DirectPreviewModal = ({ opened, onClose, file }: DirectPreviewModalProps) => {
    const [isLoading, setIsLoading] = useState(true);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [previewData, setPreviewData] = useState<PreviewUrlResponse | null>(null);
    const [timeLeft, setTimeLeft] = useState<number>(0);

    const mediaInfo = file ? isMediaFile(file.fileName) : { isMedia: false, type: null };

    const fetchPreviewUrl = useCallback(async () => {
        if (!file || !opened) return;

        try {
            setIsLoading(true);
            setError(null);
            setPreviewData(null);

            const res = await API.get<PreviewUrlResponse>({
                slug: `${Slug.PREVIEW_URL}/${file._id}`,
            });

            if (res) {
                setPreviewData(res);
                setTimeLeft(res.expiresInSeconds);
                setIsLoading(false);
            }
        } catch (err: any) {
            console.error("Failed to get preview URL:", err);
            setError(err?.response?.data?.message || "Failed to load preview");
            setIsLoading(false);
        }
    }, [file, opened]);

    useEffect(() => {
        fetchPreviewUrl();
    }, [fetchPreviewUrl]);

    // Countdown timer for URL expiry
    useEffect(() => {
        if (!previewData || timeLeft <= 0) return;

        const interval = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) {
                    clearInterval(interval);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [previewData, timeLeft]);

    // Keyboard shortcuts
    useEffect(() => {
        if (!opened) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.target as HTMLElement).tagName === "INPUT" || (e.target as HTMLElement).tagName === "TEXTAREA") return;

            if (e.key.toLowerCase() === "f") {
                e.preventDefault();
                setIsFullscreen((prev) => !prev);
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [opened]);

    const handleDownload = () => {
        if (previewData?.url) {
            const link = document.createElement("a");
            link.href = previewData.url;
            link.download = previewData.fileName;
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            link.click();
        }
    };

    const handleOpenInNewTab = () => {
        if (previewData?.url) {
            window.open(previewData.url, "_blank", "noopener,noreferrer");
        }
    };

    const formatTimeLeft = (seconds: number): string => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, "0")}`;
    };

    const formatBytes = (bytes: number): string => {
        if (bytes === 0) return "0 B";
        const sizes = ["B", "KB", "MB", "GB"];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
    };

    if (!file) return null;

    const fileName = file.fileName.split("/").pop() || file.fileName;
    const isExpired = timeLeft <= 0 && previewData !== null;

    return (
        <Modal
            opened={opened}
            onClose={onClose}
            size={isFullscreen ? "100%" : "xl"}
            fullScreen={isFullscreen}
            padding={0}
            withCloseButton={false}
            centered
            styles={{
                content: {
                    background: "#0a0a0f",
                    borderRadius: isFullscreen ? 0 : "16px",
                    overflow: "hidden",
                    border: "1px solid rgba(255,255,255,0.06)",
                },
                body: {
                    padding: 0,
                    height: isFullscreen ? "100vh" : "auto",
                    display: "flex",
                    flexDirection: "column",
                },
            }}
        >
            {/* Header */}
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 16px",
                    borderBottom: "1px solid rgba(255,255,255,0.06)",
                    background: "rgba(255,255,255,0.02)",
                    backdropFilter: "blur(20px)",
                }}
            >
                <div style={{ display: "flex", alignItems: "center", gap: "12px", overflow: "hidden", flex: 1 }}>
                    {/* Direct R2 badge */}
                    <Tooltip label="Loaded directly from R2 storage via presigned URL">
                        <Badge
                            size="xs"
                            variant="gradient"
                            gradient={{ from: "orange", to: "red", deg: 135 }}
                            style={{ flexShrink: 0 }}
                            leftSection={<IconLink size={10} />}
                        >
                            Direct R2
                        </Badge>
                    </Tooltip>

                    <Text fw={500} c="white" lineClamp={1} style={{ maxWidth: 300 }}>
                        {fileName}
                    </Text>

                    <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>
                        {formatBytes(file.fileSize)}
                    </Text>
                </div>

                <Group gap={6}>
                    {/* Expiry timer */}
                    {previewData && (
                        <Tooltip label={isExpired ? "URL expired — click refresh" : `Presigned URL expires in ${formatTimeLeft(timeLeft)}`}>
                            <Badge
                                size="sm"
                                variant="light"
                                color={isExpired ? "red" : timeLeft < 120 ? "orange" : "teal"}
                                leftSection={<IconClock size={10} />}
                                style={{ cursor: isExpired ? "pointer" : "default" }}
                                onClick={isExpired ? fetchPreviewUrl : undefined}
                            >
                                {isExpired ? "Expired" : formatTimeLeft(timeLeft)}
                            </Badge>
                        </Tooltip>
                    )}

                    {/* Copy URL */}
                    {previewData?.url && !isExpired && (
                        <CopyButton value={previewData.url} timeout={2000}>
                            {({ copied, copy }) => (
                                <Tooltip label={copied ? "Copied!" : "Copy R2 URL"}>
                                    <ActionIcon variant="subtle" color={copied ? "teal" : "gray"} onClick={copy} size="sm">
                                        {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                                    </ActionIcon>
                                </Tooltip>
                            )}
                        </CopyButton>
                    )}

                    {/* Refresh URL */}
                    <Tooltip label="Refresh presigned URL">
                        <ActionIcon variant="subtle" color="gray" onClick={fetchPreviewUrl} size="sm">
                            <IconRefresh size={14} />
                        </ActionIcon>
                    </Tooltip>

                    {/* Open in new tab */}
                    {previewData?.url && !isExpired && (
                        <Tooltip label="Open in new tab">
                            <ActionIcon variant="subtle" color="gray" onClick={handleOpenInNewTab} size="sm">
                                <IconExternalLink size={14} />
                            </ActionIcon>
                        </Tooltip>
                    )}

                    {/* Download */}
                    <Tooltip label="Download">
                        <ActionIcon variant="subtle" color="gray" onClick={handleDownload} size="sm" disabled={!previewData?.url || isExpired}>
                            <IconDownload size={14} />
                        </ActionIcon>
                    </Tooltip>

                    {/* Fullscreen */}
                    <Tooltip label={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}>
                        <ActionIcon variant="subtle" color="gray" onClick={() => setIsFullscreen(!isFullscreen)} size="sm">
                            {isFullscreen ? <IconMinimize size={14} /> : <IconMaximize size={14} />}
                        </ActionIcon>
                    </Tooltip>

                    {/* Close */}
                    <ActionIcon variant="subtle" color="gray" onClick={onClose} size="sm">
                        <IconX size={14} />
                    </ActionIcon>
                </Group>
            </div>

            {/* Content */}
            <div
                style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "16px",
                    minHeight: isFullscreen ? "calc(100vh - 100px)" : "500px",
                    maxHeight: isFullscreen ? "calc(100vh - 100px)" : "80vh",
                    position: "relative",
                }}
            >
                {isLoading && (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
                        <Loader color="white" size="lg" />
                        <Text c="dimmed" size="sm">
                            Generating presigned URL...
                        </Text>
                    </div>
                )}

                {error && (
                    <div style={{ textAlign: "center" }}>
                        <Text c="red" size="lg">
                            {error}
                        </Text>
                        <Text c="dimmed" size="sm" mt="sm">
                            The file may not exist or access was denied.
                        </Text>
                        <ActionIcon variant="light" color="blue" size="lg" mt="md" onClick={fetchPreviewUrl}>
                            <IconRefresh size={20} />
                        </ActionIcon>
                    </div>
                )}

                {isExpired && !isLoading && !error && (
                    <div style={{ textAlign: "center" }}>
                        <div
                            style={{
                                width: 80,
                                height: 80,
                                borderRadius: "50%",
                                background: "linear-gradient(135deg, rgba(239,68,68,0.2), rgba(239,68,68,0.05))",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                margin: "0 auto 16px",
                            }}
                        >
                            <IconClock size={36} color="#ef4444" />
                        </div>
                        <Text c="white" fw={600} size="lg">
                            Preview URL Expired
                        </Text>
                        <Text c="dimmed" size="sm" mt={4}>
                            The presigned URL has expired for security. Click below to generate a new one.
                        </Text>
                        <ActionIcon variant="light" color="blue" size="xl" mt="lg" onClick={fetchPreviewUrl} radius="xl">
                            <IconRefresh size={22} />
                        </ActionIcon>
                    </div>
                )}

                {/* Image */}
                {!isLoading && !error && !isExpired && previewData && mediaInfo.type === "image" && (
                    <img
                        src={previewData.url}
                        alt={fileName}
                        onError={() => setError("Failed to load image from R2")}
                        style={{
                            maxWidth: "100%",
                            maxHeight: "100%",
                            objectFit: "contain",
                            borderRadius: "8px",
                            transition: "opacity 0.3s ease",
                        }}
                    />
                )}

                {/* Video */}
                {!isLoading && !error && !isExpired && previewData && mediaInfo.type === "video" && (
                    <video
                        src={previewData.url}
                        controls
                        autoPlay
                        onError={() => setError("Failed to load video from R2")}
                        style={{
                            maxWidth: "100%",
                            maxHeight: "100%",
                            borderRadius: "8px",
                        }}
                    />
                )}

                {/* Audio */}
                {!isLoading && !error && !isExpired && previewData && mediaInfo.type === "audio" && (
                    <div style={{ textAlign: "center", width: "100%", maxWidth: 500 }}>
                        <div
                            style={{
                                width: 96,
                                height: 96,
                                margin: "0 auto 24px",
                                borderRadius: "50%",
                                background: "linear-gradient(135deg, #8b5cf6, #ec4899)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                boxShadow: "0 0 60px rgba(139, 92, 246, 0.3)",
                            }}
                        >
                            <svg width={40} height={40} viewBox="0 0 24 24" fill="white">
                                <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                            </svg>
                        </div>
                        <Text c="white" fw={500} mb="md">
                            {fileName}
                        </Text>
                        <audio src={previewData.url} controls autoPlay onError={() => setError("Failed to load audio from R2")} style={{ width: "100%" }} />
                    </div>
                )}

                {/* PDF */}
                {!isLoading && !error && !isExpired && previewData && previewData.contentType === "application/pdf" && (
                    <iframe
                        src={previewData.url}
                        title={fileName}
                        style={{
                            width: "100%",
                            height: "100%",
                            border: "none",
                            borderRadius: "8px",
                            minHeight: isFullscreen ? "calc(100vh - 100px)" : "500px",
                        }}
                    />
                )}

                {/* Non-previewable file */}
                {!isLoading && !error && !isExpired && previewData && !mediaInfo.isMedia && previewData.contentType !== "application/pdf" && (
                    <div style={{ textAlign: "center" }}>
                        <Text c="white" fw={500} mb="sm">
                            {fileName}
                        </Text>
                        <Text c="dimmed" size="sm" mb="lg">
                            This file type cannot be previewed. Use the download button above.
                        </Text>
                    </div>
                )}
            </div>

            {/* Footer */}
            <div
                style={{
                    padding: "8px 16px",
                    borderTop: "1px solid rgba(255,255,255,0.06)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                }}
            >
                <Text size="xs" c="dimmed">
                    Press <kbd style={{ padding: "1px 6px", background: "rgba(255,255,255,0.1)", borderRadius: 4, color: "#9ca3af", fontSize: 11 }}>Esc</kbd> to close
                    {" • "}
                    <kbd style={{ padding: "1px 6px", background: "rgba(255,255,255,0.1)", borderRadius: 4, color: "#9ca3af", fontSize: 11 }}>F</kbd> for fullscreen
                </Text>
                {previewData && (
                    <Text size="xs" c="dimmed">
                        {previewData.contentType} • {formatBytes(previewData.fileSize)}
                    </Text>
                )}
            </div>
        </Modal>
    );
};

export default DirectPreviewModal;
