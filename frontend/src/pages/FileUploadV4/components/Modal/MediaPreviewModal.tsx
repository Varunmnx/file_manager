import { Modal, ActionIcon, Group, Text, Loader } from "@mantine/core";
import { IconX, IconDownload, IconMaximize, IconMinimize, IconRefresh } from "@tabler/icons-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { UploadedFile } from "@/types/file.types";
import { API, Slug } from "@/services";

// ── Types ─────────────────────────────────────────────────────────────────────

interface MediaPreviewModalProps {
  opened: boolean;
  onClose: () => void;
  file: UploadedFile | null;
}

interface PreviewUrlResponse {
  url: string;
  fileName: string;
  fileSize: number;
  contentType: string;
  expiresInSeconds: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export const isMediaFile = (
  fileName: string
): { isMedia: boolean; type: "image" | "video" | "audio" | "pdf" | null } => {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";

  const imageExtensions = ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "ico"];
  const videoExtensions = ["mp4", "webm", "ogg", "mov", "avi", "mkv"];
  const audioExtensions = ["mp3", "wav", "flac", "m4a"];

  if (imageExtensions.includes(ext)) return { isMedia: true, type: "image" };
  if (videoExtensions.includes(ext)) return { isMedia: true, type: "video" };
  if (audioExtensions.includes(ext)) return { isMedia: true, type: "audio" };
  if (ext === "pdf") return { isMedia: true, type: "pdf" };

  return { isMedia: false, type: null };
};

// ── Component ─────────────────────────────────────────────────────────────────

const MediaPreviewModal = ({ opened, onClose, file }: MediaPreviewModalProps) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The active presigned URL for the media
  const [presignedUrl, setPresignedUrl] = useState<string | null>(null);
  // When the current URL expires (unix ms)
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  // True while we're silently refreshing in the background (not the initial load)
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const mediaInfo = file ? isMediaFile(file.fileName) : { isMedia: false, type: null };
  const fileName = file?.fileName.split("/").pop() || file?.fileName || "";

  // ── Fetch / refresh presigned URL ──────────────────────────────────────────

  const fetchPresignedUrl = useCallback(
    async (silent = false) => {
      if (!file) return;
      if (silent) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
        setError(null);
        setPresignedUrl(null);
      }

      try {
        const data = await API.get<PreviewUrlResponse>({
          slug: `${Slug.PREVIEW_URL}/${file._id}`,
        });

        if (!data) throw new Error("No response from server");

        setPresignedUrl(data.url);
        setExpiresAt(Date.now() + data.expiresInSeconds * 1000);

        if (!silent) setIsLoading(false);
      } catch (err) {
        console.error("[MediaPreview] Failed to get presigned URL:", err);
        if (!silent) {
          setError("Failed to load preview. The file may be unavailable.");
          setIsLoading(false);
        }
      } finally {
        if (silent) setIsRefreshing(false);
      }
    },
    [file]
  );

  // ── Schedule a background refresh 30s before expiry ───────────────────────

  useEffect(() => {
    if (!expiresAt || !opened) return;

    // Refresh 30 seconds before the URL expires
    const msUntilRefresh = expiresAt - Date.now() - 30_000;

    if (msUntilRefresh <= 0) {
      // Already near expiry — refresh immediately in background
      fetchPresignedUrl(true);
      return;
    }

    refreshTimerRef.current = setTimeout(() => {
      fetchPresignedUrl(true);
    }, msUntilRefresh);

    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, [expiresAt, opened, fetchPresignedUrl]);

  // ── Fetch URL when modal opens / file changes ─────────────────────────────

  useEffect(() => {
    if (!opened || !file) {
      // Reset state when modal closes
      if (!opened) {
        setPresignedUrl(null);
        setExpiresAt(null);
        setError(null);
        setIsLoading(true);
        if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      }
      return;
    }

    fetchPresignedUrl(false);
  }, [opened, file?._id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Keyboard shortcuts ────────────────────────────────────────────────────

  useEffect(() => {
    if (!opened) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      if (e.key.toLowerCase() === "f") {
        e.preventDefault();
        setIsFullscreen((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [opened]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleLoad = () => setIsLoading(false);
  const handleError = () => {
    setIsLoading(false);
    setError("Failed to load media file");
  };

  const toggleFullscreen = () => setIsFullscreen((p) => !p);

  /**
   * Download by navigating to the presigned URL with a `download` attribute set.
   * We fetch it as a blob so the browser prompts the save dialog instead of
   * opening it inline (some browsers ignore Content-Disposition on presigned URLs).
   */
  const handleDownload = async () => {
    if (!presignedUrl || !file) return;
    try {
      const response = await fetch(presignedUrl);
      const blob = await response.blob();
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = fileName;
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 10_000);
    } catch {
      // Fall back to opening the URL in a new tab
      window.open(presignedUrl, "_blank", "noopener,noreferrer");
    }
  };

  if (!file) return null;

  const showContent = !isLoading && presignedUrl && !error;

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
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between p-4 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <Text fw={500} c="white" lineClamp={1} className="max-w-[400px]">
            {fileName}
          </Text>
          <Text size="xs" c="dimmed">
            {(file.fileSize / (1024 * 1024)).toFixed(2)} MB
          </Text>
          {/* Subtle indicator that shows when bg-refresh occurs */}
          {isRefreshing && (
            <span title="Refreshing preview link…">
              <IconRefresh size={12} className="text-gray-500 animate-spin" />
            </span>
          )}
        </div>
        <Group gap="xs">
          <ActionIcon
            variant="subtle"
            color="gray"
            onClick={handleDownload}
            title="Download"
            disabled={!presignedUrl}
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
          <ActionIcon variant="subtle" color="gray" onClick={onClose} title="Close">
            <IconX size={18} />
          </ActionIcon>
        </Group>
      </div>

      {/* ── Content ───────────────────────────────────────────────────────── */}
      <div
        className="flex-1 flex items-center justify-center p-4 relative"
        style={{
          minHeight: isFullscreen ? "calc(100vh - 72px)" : "500px",
          maxHeight: isFullscreen ? "calc(100vh - 72px)" : "80vh",
        }}
      >
        {/* Loading spinner */}
        {isLoading && !error && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader color="white" size="lg" />
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="text-center">
            <Text c="red" size="lg">
              {error}
            </Text>
            <Text c="dimmed" size="sm" mt="sm">
              The file may be unavailable or the format is not supported.
            </Text>
            <button
              onClick={() => fetchPresignedUrl(false)}
              className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg border-none cursor-pointer transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* ── Image ──── */}
        {showContent && mediaInfo.type === "image" && (
          <img
            src={presignedUrl!}
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

        {/* ── Video ──── */}
        {showContent && mediaInfo.type === "video" && (
          <video
            key={presignedUrl /* re-mount when URL refreshes so the player reloads src */}
            src={presignedUrl!}
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

        {/* ── Audio ──── */}
        {showContent && mediaInfo.type === "audio" && (
          <div className="text-center">
            <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <svg width={40} height={40} viewBox="0 0 24 24" fill="white">
                <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
              </svg>
            </div>
            <Text c="white" fw={500} mb="md">
              {fileName}
            </Text>
            <audio
              key={presignedUrl}
              src={presignedUrl!}
              controls
              autoPlay
              onLoadedData={handleLoad}
              onError={handleError}
              className="w-full max-w-md"
              style={{ display: isLoading ? "none" : "block" }}
            />
          </div>
        )}

        {/* ── PDF ──── */}
        {showContent && mediaInfo.type === "pdf" && (
          <iframe
            key={presignedUrl}
            src={presignedUrl!}
            title={fileName}
            onLoad={handleLoad}
            onError={handleError}
            style={{
              width: "100%",
              height: isFullscreen ? "calc(100vh - 120px)" : "70vh",
              border: "none",
              borderRadius: "8px",
              display: isLoading ? "none" : "block",
              background: "white",
            }}
          />
        )}
      </div>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <div className="p-2 text-center border-t border-gray-800">
        <Text size="xs" c="dimmed">
          Press <kbd className="px-1 py-0.5 bg-gray-800 rounded text-gray-400">Esc</kbd> to close
          {" • "}
          <kbd className="px-1 py-0.5 bg-gray-800 rounded text-gray-400">F</kbd> for fullscreen
          {expiresAt && (
            <>
              {" • "}
              <span className="text-gray-600">
                Link valid for ~{Math.max(0, Math.round((expiresAt - Date.now()) / 60_000))} min
              </span>
            </>
          )}
        </Text>
      </div>
    </Modal>
  );
};

export default MediaPreviewModal;
