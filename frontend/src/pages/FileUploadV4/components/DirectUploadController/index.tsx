import { useState, useCallback, useRef } from "react";
import { API, Slug } from "@/services";
import { useParams } from "react-router-dom";
import { useChunkedUpload } from "../../context/chunked-upload.context";
import { toast } from "sonner";
import {
    IconUpload,
    IconCheck,
    IconX,
    IconFile,
    IconFileText,
    IconPhoto,
    IconVideo,
    IconMusic,
    IconFileZip,
    IconPresentation,
    IconFileSpreadsheet,
    IconChevronUp,
    IconChevronDown,
    IconTrash,
    IconCloudUpload,
    IconRefresh,
    IconBolt,
} from "@tabler/icons-react";

// ── Types ────────────────────────────────────────

interface DirectUploadItem {
    id: string;
    file: File;
    fileName: string;
    fileSize: number;
    status: "pending" | "initiating" | "uploading" | "confirming" | "completed" | "error";
    progress: number;
    uploadId?: string;
    presignedUrl?: string;
    error?: string;
    speed?: number; // bytes/sec
    startTime?: number;
}

interface InitiateResponse {
    uploadId: string;
    presignedUrl: string;
    r2Key: string;
    expiresInSeconds: number;
}

// ── Content type helper ──────────────────────────

const getMimeType = (fileName: string): string => {
    const ext = fileName.split(".").pop()?.toLowerCase() || "";
    const mimes: Record<string, string> = {
        jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
        gif: "image/gif", webp: "image/webp", svg: "image/svg+xml",
        bmp: "image/bmp", ico: "image/x-icon",
        mp4: "video/mp4", webm: "video/webm", ogg: "video/ogg",
        mov: "video/quicktime", avi: "video/x-msvideo", mkv: "video/x-matroska",
        mp3: "audio/mpeg", wav: "audio/wav", flac: "audio/flac", m4a: "audio/mp4",
        pdf: "application/pdf", zip: "application/zip",
        doc: "application/msword",
        docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        xls: "application/vnd.ms-excel",
        xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ppt: "application/vnd.ms-powerpoint",
        pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    };
    return mimes[ext] || "application/octet-stream";
};

// ── File icon helper ─────────────────────────────

const getFileIcon = (fileName: string) => {
    const ext = fileName.split(".").pop()?.toLowerCase();
    const iconProps = { size: 20, stroke: 1.5 };

    switch (ext) {
        case "pdf": return <IconFileText {...iconProps} className="text-red-500" />;
        case "doc": case "docx": return <IconFileText {...iconProps} className="text-blue-500" />;
        case "xls": case "xlsx": return <IconFileSpreadsheet {...iconProps} className="text-green-600" />;
        case "ppt": case "pptx": return <IconPresentation {...iconProps} className="text-orange-500" />;
        case "jpg": case "jpeg": case "png": case "gif": case "webp": return <IconPhoto {...iconProps} className="text-purple-500" />;
        case "mp4": case "mov": case "avi": case "mkv": return <IconVideo {...iconProps} className="text-pink-500" />;
        case "mp3": case "wav": case "flac": return <IconMusic {...iconProps} className="text-indigo-500" />;
        case "zip": case "rar": case "7z": return <IconFileZip {...iconProps} className="text-amber-600" />;
        default: return <IconFile {...iconProps} className="text-gray-500" />;
    }
};

// ── Format helpers ───────────────────────────────

const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
};

const formatSpeed = (bytesPerSec: number): string => {
    if (bytesPerSec < 1024) return `${bytesPerSec.toFixed(0)} B/s`;
    if (bytesPerSec < 1024 * 1024) return `${(bytesPerSec / 1024).toFixed(1)} KB/s`;
    return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
};

// ── Main Component ───────────────────────────────

const DirectUploadController = () => {
    const [uploads, setUploads] = useState<DirectUploadItem[]>([]);
    const [isMinimized, setIsMinimized] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const abortControllers = useRef<Map<string, XMLHttpRequest>>(new Map());
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { folderId } = useParams();
    const { refetchFilesAndFolders } = useChunkedUpload();

    // ── Upload a single file ───────────────────────

    const uploadFile = useCallback(async (item: DirectUploadItem) => {
        const updateItem = (id: string, patch: Partial<DirectUploadItem>) => {
            setUploads((prev) => prev.map((u) => (u.id === id ? { ...u, ...patch } : u)));
        };

        try {
            // Step 1: Get presigned URL from backend
            updateItem(item.id, { status: "initiating" });

            const res = await API.post<InitiateResponse>({
                slug: Slug.DIRECT_UPLOAD,
                body: {
                    fileName: item.fileName,
                    fileSize: item.fileSize,
                    contentType: getMimeType(item.fileName),
                    parentId: folderId || undefined,
                },
            });

            if (!res) throw new Error("Failed to get upload URL");

            updateItem(item.id, {
                status: "uploading",
                uploadId: res.uploadId,
                presignedUrl: res.presignedUrl,
                startTime: Date.now(),
            });

            // Step 2: Upload directly to R2 via XHR (for progress tracking)
            await new Promise<void>((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                abortControllers.current.set(item.id, xhr);

                xhr.upload.onprogress = (e) => {
                    if (e.lengthComputable) {
                        const progress = Math.round((e.loaded / e.total) * 100);
                        const elapsed = (Date.now() - (item.startTime || Date.now())) / 1000;
                        const speed = elapsed > 0 ? e.loaded / elapsed : 0;
                        updateItem(item.id, { progress, speed });
                    }
                };

                xhr.onload = () => {
                    abortControllers.current.delete(item.id);
                    if (xhr.status >= 200 && xhr.status < 300) {
                        resolve();
                    } else {
                        const errMsg = `R2 upload failed: HTTP ${xhr.status} — ${xhr.responseText?.slice(0, 200) || "no body"}`;
                        console.error("[DirectUpload] R2 PUT failed:", errMsg);
                        reject(new Error(errMsg));
                    }
                };

                xhr.onerror = () => {
                    abortControllers.current.delete(item.id);
                    // Status 0 means CORS blocked or network error
                    const corsHint = xhr.status === 0 ? " (possible CORS block — check R2 bucket CORS policy)" : "";
                    console.error(`[DirectUpload] XHR network error${corsHint}`, { status: xhr.status });
                    reject(new Error(`Network error uploading to R2${corsHint}`));
                };

                xhr.onabort = () => {
                    abortControllers.current.delete(item.id);
                    reject(new Error("Upload cancelled"));
                };

                xhr.open("PUT", res.presignedUrl);
                xhr.setRequestHeader("Content-Type", getMimeType(item.fileName));
                xhr.send(item.file);
            });

            // Step 3: Confirm upload with backend
            updateItem(item.id, { status: "confirming", progress: 100 });

            await API.post({
                slug: `${Slug.DIRECT_UPLOAD_CONFIRM}/${res.uploadId}`,
            });

            updateItem(item.id, { status: "completed", progress: 100 });

            // Refresh file list
            refetchFilesAndFolders();

        } catch (err: any) {
            if (err.message === "Upload cancelled") {
                updateItem(item.id, { status: "error", error: "Cancelled" });
            } else {
                console.error("Direct upload error:", err);
                updateItem(item.id, {
                    status: "error",
                    error: err?.response?.data?.message || err.message || "Upload failed",
                });
            }
        }
    }, [folderId, refetchFilesAndFolders]);

    // ── Add files to queue & start uploads ─────────

    const addFiles = useCallback((files: FileList | File[]) => {
        const fileArray = Array.from(files);
        if (fileArray.length === 0) return;

        const newItems: DirectUploadItem[] = fileArray.map((file) => ({
            id: `direct-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            file,
            fileName: file.name,
            fileSize: file.size,
            status: "pending" as const,
            progress: 0,
        }));

        setUploads((prev) => [...prev, ...newItems]);

        // Start uploading each file
        newItems.forEach((item) => uploadFile(item));

        toast.success(`${fileArray.length} file(s) queued for direct R2 upload`);
    }, [uploadFile]);

    // ── Cancel upload ──────────────────────────────

    const cancelUpload = useCallback((id: string) => {
        const xhr = abortControllers.current.get(id);
        if (xhr) {
            xhr.abort();
        }
        setUploads((prev) => prev.filter((u) => u.id !== id));
    }, []);

    // ── Retry failed upload ────────────────────────

    const retryUpload = useCallback((item: DirectUploadItem) => {
        const newItem: DirectUploadItem = {
            ...item,
            id: `direct-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            status: "pending",
            progress: 0,
            error: undefined,
            uploadId: undefined,
            presignedUrl: undefined,
        };
        setUploads((prev) => [...prev.filter((u) => u.id !== item.id), newItem]);
        uploadFile(newItem);
    }, [uploadFile]);

    // ── Clear completed ────────────────────────────

    const clearCompleted = useCallback(() => {
        setUploads((prev) => prev.filter((u) => u.status !== "completed"));
    }, []);

    // ── Drag & Drop handlers ──────────────────────

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        if (e.dataTransfer.files.length > 0) {
            addFiles(e.dataTransfer.files);
        }
    }, [addFiles]);

    // ── Counts ─────────────────────────────────────

    const activeCount = uploads.filter((u) => ["pending", "initiating", "uploading", "confirming"].includes(u.status)).length;
    const completedCount = uploads.filter((u) => u.status === "completed").length;
    const errorCount = uploads.filter((u) => u.status === "error").length;

    if (uploads.length === 0) {
        return (
            <>
                <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                        if (e.target.files) addFiles(e.target.files);
                        e.target.value = "";
                    }}
                />
                {/* Floating action button */}
                <button
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`fixed bottom-5 left-5 z-[100000] flex items-center gap-2 px-4 py-3 rounded-xl border-none cursor-pointer transition-all shadow-lg ${isDragging
                        ? "bg-orange-500 text-white scale-110 shadow-orange-200"
                        : "bg-gradient-to-r from-orange-500 to-red-500 text-white hover:shadow-xl hover:scale-105"
                        }`}
                    title="Direct R2 Upload"
                >
                    <IconBolt size={20} />
                    <span className="font-semibold text-sm">Direct Upload</span>
                </button>
            </>
        );
    }

    return (
        <>
            <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                    if (e.target.files) addFiles(e.target.files);
                    e.target.value = "";
                }}
            />

            <div className="w-[520px] bg-white rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] fixed bottom-5 left-5 font-sans z-[100000] overflow-hidden border border-gray-100">
                {/* Header */}
                <div className="bg-gradient-to-r from-orange-500 to-red-500 p-4 text-white">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <IconBolt size={20} />
                            <h3 className="m-0 text-base font-semibold">Direct Upload</h3>
                            <span className="bg-white/20 text-xs px-2 py-0.5 rounded-full">
                                {uploads.length} file{uploads.length !== 1 ? "s" : ""}
                            </span>
                        </div>
                        <div className="flex gap-1">
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="bg-white/10 hover:bg-white/20 border-none cursor-pointer p-1.5 rounded-lg text-white transition-all w-8 h-8 flex items-center justify-center"
                                title="Add more files"
                            >
                                <IconUpload size={16} />
                            </button>
                            <button
                                onClick={() => setIsMinimized((prev) => !prev)}
                                className="bg-white/10 hover:bg-white/20 border-none cursor-pointer p-1.5 rounded-lg text-white transition-all w-8 h-8 flex items-center justify-center"
                                title={isMinimized ? "Expand" : "Minimize"}
                            >
                                {isMinimized ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
                            </button>
                            <button
                                onClick={() => {
                                    if (activeCount === 0) setUploads([]);
                                }}
                                className="bg-white/10 hover:bg-white/20 border-none cursor-pointer p-1.5 rounded-lg text-white transition-all w-8 h-8 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={activeCount > 0}
                                title={activeCount > 0 ? "Cannot close while uploading" : "Close"}
                            >
                                <IconX size={16} />
                            </button>
                        </div>
                    </div>

                    {/* Stats bar */}
                    {!isMinimized && (
                        <div className="flex gap-3 mt-3">
                            {activeCount > 0 && (
                                <span className="flex items-center gap-1 bg-white/10 text-xs px-2.5 py-1 rounded-lg">
                                    <IconCloudUpload size={14} />
                                    {activeCount} uploading
                                </span>
                            )}
                            {completedCount > 0 && (
                                <span className="flex items-center gap-1 bg-white/10 text-xs px-2.5 py-1 rounded-lg">
                                    <IconCheck size={14} />
                                    {completedCount} done
                                </span>
                            )}
                            {errorCount > 0 && (
                                <span className="flex items-center gap-1 bg-white/10 text-xs px-2.5 py-1 rounded-lg">
                                    <IconX size={14} />
                                    {errorCount} failed
                                </span>
                            )}
                            {completedCount > 0 && (
                                <button
                                    onClick={clearCompleted}
                                    className="flex items-center gap-1 bg-white/10 hover:bg-white/20 text-xs px-2.5 py-1 rounded-lg text-white border-none cursor-pointer transition-all ml-auto"
                                >
                                    <IconTrash size={12} />
                                    Clear done
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* Drop zone */}
                {!isMinimized && (
                    <div
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        className={`mx-4 mt-3 mb-1 border-2 border-dashed rounded-xl p-3 text-center transition-all cursor-pointer ${isDragging
                            ? "border-orange-400 bg-orange-50 text-orange-600"
                            : "border-gray-200 bg-gray-50 text-gray-400 hover:border-orange-300 hover:text-orange-500"
                            }`}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <span className="text-xs font-medium">
                            {isDragging ? "Drop files here!" : "Click or drop files for direct R2 upload"}
                        </span>
                    </div>
                )}

                {/* File list */}
                {!isMinimized && (
                    <div className="p-4 pt-2 max-h-[350px] overflow-auto">
                        <div className="flex flex-col gap-2">
                            {uploads.map((item) => (
                                <DirectUploadItem
                                    key={item.id}
                                    item={item}
                                    onCancel={cancelUpload}
                                    onRetry={retryUpload}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </>
    );
};

// ── Individual file upload item ──────────────────

interface DirectUploadItemProps {
    item: DirectUploadItem;
    onCancel: (id: string) => void;
    onRetry: (item: DirectUploadItem) => void;
}

function DirectUploadItemComponent({ item, onCancel, onRetry }: DirectUploadItemProps) {
    const statusColors: Record<string, string> = {
        pending: "bg-gray-50 border-gray-200",
        initiating: "bg-blue-50 border-blue-200",
        uploading: "bg-orange-50 border-orange-200",
        confirming: "bg-yellow-50 border-yellow-200",
        completed: "bg-green-50 border-green-200",
        error: "bg-red-50 border-red-200",
    };

    const progressColors: Record<string, string> = {
        pending: "bg-gray-400",
        initiating: "bg-blue-500",
        uploading: "bg-gradient-to-r from-orange-500 to-red-500",
        confirming: "bg-yellow-500",
        completed: "bg-green-500",
        error: "bg-red-500",
    };

    const statusLabel: Record<string, { text: string; badge: string }> = {
        pending: { text: "Queued", badge: "bg-gray-100 text-gray-600" },
        initiating: { text: "Starting...", badge: "bg-blue-100 text-blue-700" },
        uploading: { text: `${item.progress}%`, badge: "bg-orange-100 text-orange-700" },
        confirming: { text: "Confirming...", badge: "bg-yellow-100 text-yellow-700" },
        completed: { text: "Complete", badge: "bg-green-100 text-green-700" },
        error: { text: "Failed", badge: "bg-red-100 text-red-700" },
    };

    const sl = statusLabel[item.status] || statusLabel.pending;
    const isActive = ["pending", "initiating", "uploading", "confirming"].includes(item.status);

    return (
        <div className={`p-3 rounded-xl border transition-all ${statusColors[item.status] || "bg-gray-50 border-gray-200"}`}>
            <div className="flex justify-between mb-2 items-start">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    {getFileIcon(item.fileName)}
                    <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-sm font-medium overflow-hidden text-ellipsis whitespace-nowrap text-gray-700">
                            {item.fileName}
                        </span>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400">{formatBytes(item.fileSize)}</span>
                            {item.speed && item.status === "uploading" && item.speed > 0 && (
                                <span className="text-xs text-orange-500 font-mono">{formatSpeed(item.speed)}</span>
                            )}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${sl.badge}`}>
                        {item.status === "completed" && <IconCheck size={12} />}
                        {item.status === "error" && <IconX size={12} />}
                        {(item.status === "initiating" || item.status === "confirming") && (
                            <svg className="animate-spin" width={12} height={12} viewBox="0 0 24 24" fill="none">
                                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="28 62" />
                            </svg>
                        )}
                        {sl.text}
                    </span>

                    {isActive && (
                        <button
                            onClick={() => onCancel(item.id)}
                            className="w-7 h-7 flex items-center justify-center rounded-lg bg-red-100 text-red-500 hover:bg-red-200 border-none cursor-pointer transition-all"
                            title="Cancel upload"
                        >
                            <IconX size={14} />
                        </button>
                    )}

                    {item.status === "error" && (
                        <button
                            onClick={() => onRetry(item)}
                            className="w-7 h-7 flex items-center justify-center rounded-lg bg-blue-100 text-blue-600 hover:bg-blue-200 border-none cursor-pointer transition-all"
                            title="Retry"
                        >
                            <IconRefresh size={14} />
                        </button>
                    )}
                </div>
            </div>

            {/* Progress bar */}
            {isActive && (
                <div className="flex items-center gap-3">
                    <div className="flex-1 h-2 bg-white rounded-full overflow-hidden shadow-inner">
                        <div
                            className={`h-full transition-all duration-300 ease-out rounded-full ${progressColors[item.status] || "bg-gray-400"}`}
                            style={{ width: `${item.progress}%` }}
                        />
                    </div>
                    <span className="text-xs text-gray-500 min-w-[40px] text-right font-mono font-medium">
                        {item.progress}%
                    </span>
                </div>
            )}

            {/* Error message */}
            {item.status === "error" && item.error && (
                <div className="mt-2 text-xs text-red-600 bg-red-100 px-2 py-1 rounded-lg flex items-center gap-1">
                    <IconX size={12} />
                    {item.error}
                </div>
            )}
        </div>
    );
}

// Give it a display name
const DirectUploadItem = DirectUploadItemComponent;

export default DirectUploadController;
