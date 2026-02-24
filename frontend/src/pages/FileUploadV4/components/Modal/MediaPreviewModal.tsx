import axios from "axios";
import { Modal, ActionIcon, Group, Text, Loader } from "@mantine/core";
import { IconX, IconDownload, IconMaximize, IconMinimize } from "@tabler/icons-react";
import { useState, useEffect } from "react";
import { UploadedFile } from "@/types/file.types";
import { Config } from "@/config";
import { loadString, StorageKeys } from "@/utils/storage";

interface MediaPreviewModalProps {
  opened: boolean;
  onClose: () => void;
  file: UploadedFile | null;
}

// Helper to check if file is media type
export const isMediaFile = (fileName: string): { isMedia: boolean; type: "image" | "video" | "audio" | null } => {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  
  const imageExtensions = ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "ico"];
  const videoExtensions = ["mp4", "webm", "ogg", "mov", "avi", "mkv"];
  const audioExtensions = ["mp3", "wav", "flac", "m4a", "ogg"];

  if (imageExtensions.includes(ext)) return { isMedia: true, type: "image" };
  if (videoExtensions.includes(ext)) return { isMedia: true, type: "video" };
  if (audioExtensions.includes(ext)) return { isMedia: true, type: "audio" };
  
  return { isMedia: false, type: null };
};

const MediaPreviewModal = ({ opened, onClose, file }: MediaPreviewModalProps) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  const mediaInfo = file ? isMediaFile(file.fileName) : { isMedia: false, type: null };

  useEffect(() => {
    let active = true;
    const previousUrl = blobUrl;

    const fetchMedia = async () => {
      if (!file || !opened) return;
      
      try {
        setIsLoading(true);
        setError(null);
        setBlobUrl(null); // Clear previous

        const token = loadString(StorageKeys.TOKEN);
        const response = await axios.get(`${Config.API_URL}/upload/media/${file._id}`, {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob'
        });

        if (active) {
          const url = URL.createObjectURL(response.data);
          setBlobUrl(url);
          setIsLoading(false);
        }
      } catch (err) {
        if (active) {
          console.error(err);
          setError("Failed to load media file");
          setIsLoading(false);
        }
      }
    };

    fetchMedia();

    return () => {
      active = false;
      if (previousUrl) URL.revokeObjectURL(previousUrl);
    };
  }, [opened, file?._id]);

  // Clean up current URL when unmounting
  useEffect(() => {
      return () => {
          if (blobUrl) URL.revokeObjectURL(blobUrl);
      }
  }, [blobUrl]);

  // Handle keyboard shortcuts
  useEffect(() => {
    if (!opened) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'f') {
        // Don't trigger if user is typing in an input (though there are none in this modal)
        if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;
        
        e.preventDefault();
        setIsFullscreen(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [opened]);


  const handleLoad = () => {
    setIsLoading(false);
  };

  const handleError = () => {
    setIsLoading(false);
    setError("Failed to load media file");
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const handleDownload = () => {
    if (file && blobUrl) {
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = file.fileName;
      link.click();
    }
  };

  if (!file) return null;

  const fileName = file.fileName.split("/").pop() || file.fileName;

  const showContent = !isLoading && blobUrl && !error;

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
          background: "rgba(0, 0, 0, 0.95)",
          borderRadius: isFullscreen ? 0 : "12px",
          overflow: "hidden",
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
      <div className="flex items-center justify-between p-4 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <Text fw={500} c="white" lineClamp={1} className="max-w-[400px]">
            {fileName}
          </Text>
          <Text size="xs" c="dimmed">
            {(file.fileSize / (1024 * 1024)).toFixed(2)} MB
          </Text>
        </div>
        <Group gap="xs">
          <ActionIcon
            variant="subtle"
            color="gray"
            onClick={handleDownload}
            title="Download"
          >
            <IconDownload size={18} />
          </ActionIcon>
          <ActionIcon
            variant="subtle"
            color="gray"
            onClick={toggleFullscreen}
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? <IconMinimize size={18} /> : <IconMaximize size={18} />}
          </ActionIcon>
          <ActionIcon
            variant="subtle"
            color="gray"
            onClick={onClose}
            title="Close"
          >
            <IconX size={18} />
          </ActionIcon>
        </Group>
      </div>

      {/* Content */}
      <div 
        className="flex-1 flex items-center justify-center p-4"
        style={{ 
          minHeight: isFullscreen ? "calc(100vh - 72px)" : "500px",
          maxHeight: isFullscreen ? "calc(100vh - 72px)" : "80vh",
        }}
      >
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader color="white" size="lg" />
          </div>
        )}

        {error && (
          <div className="text-center">
            <Text c="red" size="lg">{error}</Text>
            <Text c="dimmed" size="sm" mt="sm">
              The file may be corrupted or the format is not supported.
            </Text>
          </div>
        )}

        {!error && showContent && mediaInfo.type === "image" && (
          <img
            src={blobUrl || ""}
            alt={fileName}
            onLoad={handleLoad}
            onError={handleError}
            style={{
              maxWidth: "100%",
              maxHeight: "100%",
              objectFit: "contain",
              display: isLoading ? "none" : "block",
              borderRadius: "8px",
            }}
          />
        )}

        {!error && showContent && mediaInfo.type === "video" && (
          <video
            src={blobUrl || ""}
            controls
            autoPlay
            onLoadedData={handleLoad}
            onError={handleError}
            style={{
              maxWidth: "100%",
              maxHeight: "100%",
              display: isLoading ? "none" : "block",
              borderRadius: "8px",
            }}
          />
        )}

        {!error && showContent && mediaInfo.type === "audio" && (
          <div className="text-center">
            <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <svg
                width={40}
                height={40}
                viewBox="0 0 24 24"
                fill="white"
              >
                <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
              </svg>
            </div>
            <Text c="white" fw={500} mb="md">{fileName}</Text>
            <audio
              src={blobUrl || ""}
              controls
              autoPlay
              onLoadedData={handleLoad}
              onError={handleError}
              className="w-full max-w-md"
              style={{ display: isLoading ? "none" : "block" }}
            />
          </div>
        )}
      </div>

      {/* Keyboard shortcuts hint */}
      <div className="p-2 text-center border-t border-gray-800">
        <Text size="xs" c="dimmed">
          Press <kbd className="px-1 py-0.5 bg-gray-800 rounded text-gray-400">Esc</kbd> to close
          {" • "}
          <kbd className="px-1 py-0.5 bg-gray-800 rounded text-gray-400">F</kbd> for fullscreen
        </Text>
      </div>
    </Modal>
  );
};

export default MediaPreviewModal;
