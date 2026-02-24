import { useState, useMemo, useEffect } from "react";
import { useChunkedUpload, UploadQueueState } from "../../context/chunked-upload.context";
import {
  IconUpload,
  IconCheck,
  IconX,
  IconBan,
  IconPlayerPause,
  IconPlayerPlay,
  IconTrash,
  IconRefresh,
  IconFile,
  IconFileText,
  IconPhoto,
  IconVideo,
  IconMusic,
  IconFileZip,
  IconPresentation,
  IconFileSpreadsheet,
  IconFolder,
  IconFolderOpen,
  IconChevronDown,
  IconChevronRight,
  IconChevronUp,
  IconLoader2,
} from "@tabler/icons-react";

// Tab types for upload status
type UploadTab = "uploading" | "completed" | "failed" | "cancelled";

interface FileNode {
  name: string;
  type: "file" | "folder";
  path: string;
  children?: FileNode[];
  file?: UploadQueueState;
}

const LiveFileUploadController = () => {
  const { uploadQueue, pauseUpload, cancelCurrentUpload, setUploadQueue } = useChunkedUpload();
  const [isMinimized, setIsMinimized] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<UploadTab>("uploading");
  const [processingUploads, setProcessingUploads] = useState<Set<string>>(new Set());

  // Show the controller when uploads are added
  useEffect(() => {
    if (uploadQueue.length > 0 && !isVisible) {
      setIsVisible(true);
    }
  }, [uploadQueue.length, isVisible]);

  const handlePauseResume = async (uploadQueueItem: UploadQueueState) => {
    const _id = uploadQueueItem._id;
    if (!_id || processingUploads.has(_id)) return;

    // Add to processing set to prevent double-clicks
    setProcessingUploads(prev => new Set(prev).add(_id));

    try {
      await pauseUpload(uploadQueueItem);
    } finally {
      // Remove from processing set
      setProcessingUploads(prev => {
        const newSet = new Set(prev);
        newSet.delete(_id);
        return newSet;
      });
    }
  };

  const handleDelete = (_id: string) => {
    if (!_id || processingUploads.has(_id)) return;
    cancelCurrentUpload(_id);
  };

  const handleRetry = (uploadQueueItem: UploadQueueState) => {
    // Reset the status to idle so it can be re-queued
    setUploadQueue(prev =>
      prev.map(upload => {
        if (upload._id === uploadQueueItem._id || upload.name === uploadQueueItem.name) {
          return {
            ...upload,
            status: "idle" as const,
            error: undefined,
            percentage: 0,
          };
        }
        return upload;
      })
    );
  };

  const handleClearCompleted = () => {
    setUploadQueue(prev => prev.filter(upload => upload.status !== "completed"));
  };

  const handleClearFailed = () => {
    setUploadQueue(prev => prev.filter(upload => upload.status !== "error"));
  };

  const handleClearCancelled = () => {
    setUploadQueue(prev => prev.filter(upload => upload.status !== "cancelled"));
  };

  const handleMinimize = () => {
    setIsMinimized((prev) => !prev);
  };

  const handleClose = () => {
    // Only allow closing if no uploads are in progress
    const hasActiveUploads = uploadQueue.some(
      u => u.status === "uploading" || u.status === "initiating"
    );
    if (!hasActiveUploads) {
      setUploadQueue([]);
      setIsVisible(false); // Hide the controller
    }
  };

  // Filter uploads by status
  const uploadingFiles = useMemo(() => 
    uploadQueue.filter(f => 
      f.status === "uploading" || f.status === "paused" || f.status === "initiating" || f.status === "idle"
    ), [uploadQueue]
  );

  const completedFiles = useMemo(() => 
    uploadQueue.filter(f => f.status === "completed"), [uploadQueue]
  );

  const failedFiles = useMemo(() => 
    uploadQueue.filter(f => f.status === "error"), [uploadQueue]
  );

  const cancelledFiles = useMemo(() => 
    uploadQueue.filter(f => f.status === "cancelled"), [uploadQueue]
  );

  // Get current tab's files
  const getCurrentFiles = () => {
    switch (activeTab) {
      case "uploading": return uploadingFiles;
      case "completed": return completedFiles;
      case "failed": return failedFiles;
      case "cancelled": return cancelledFiles;
      default: return [];
    }
  };

  function buildFileTree(files: UploadQueueState[]): FileNode[] {
    const root: FileNode[] = [];

    files.forEach((file) => {
      const parts = file.name.split("/");
      let currentLevel = root;

      parts.forEach((part, index) => {
        const isFile = index === parts.length - 1;
        let node = currentLevel.find((n) => n.name === part);

        if (!node) {
          const pathParts = parts.slice(0, index + 1);
          node = {
            name: part,
            type: isFile ? "file" : "folder",
            path: pathParts.join("/"),
            children: isFile ? undefined : [],
            file: isFile ? file : undefined,
          };
          currentLevel.push(node);
        }

        if (!isFile && node.children) {
          currentLevel = node.children;
        }
      });
    });

    return root;
  }

  const fileTree = buildFileTree(getCurrentFiles());

  // Tab counts
  const tabCounts = {
    uploading: uploadingFiles.length,
    completed: completedFiles.length,
    failed: failedFiles.length,
    cancelled: cancelledFiles.length,
  };

  // Don't render if not visible (user closed it)
  if (!isVisible) {
    return null;
  }

  const tabs: { id: UploadTab; label: string; icon: React.ReactNode; color: string }[] = [
    { id: "uploading", label: "Uploading", icon: <IconUpload size={14} />, color: "#4dabf7" },
    { id: "completed", label: "Completed", icon: <IconCheck size={14} />, color: "#40c057" },
    { id: "failed", label: "Failed", icon: <IconX size={14} />, color: "#fa5252" },
    { id: "cancelled", label: "Cancelled", icon: <IconBan size={14} />, color: "#868e96" },
  ];

  return (
    <div className="w-[520px] bg-white rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] fixed bottom-5 right-5 font-sans z-[100000] overflow-hidden border border-gray-100">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-4 text-white">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <IconFolder size={20} />
            <h3 className="m-0 text-base font-semibold">Upload Manager</h3>
            <span className="bg-white/20 text-xs px-2 py-0.5 rounded-full">
              {uploadQueue.length} file{uploadQueue.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="flex gap-1">
            <button
              onClick={handleMinimize}
              className="bg-white/10 hover:bg-white/20 border-none cursor-pointer p-1.5 rounded-lg text-white transition-all w-8 h-8 flex items-center justify-center"
              title={isMinimized ? "Expand" : "Minimize"}
            >
              {isMinimized ? <IconChevronUp size={16} /> : <IconChevronDown size={16} />}
            </button>
            <button
              onClick={handleClose}
              className="bg-white/10 hover:bg-white/20 border-none cursor-pointer p-1.5 rounded-lg text-white transition-all w-8 h-8 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={uploadingFiles.length > 0}
              title={uploadingFiles.length > 0 ? "Cannot close while uploading" : "Close"}
            >
              <IconX size={16} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        {!isMinimized && (
          <div className="flex gap-1 mt-3">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border-none cursor-pointer ${
                  activeTab === tab.id
                    ? "bg-white text-blue-600 shadow-sm"
                    : "bg-white/10 text-white/90 hover:bg-white/20"
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
                {tabCounts[tab.id] > 0 && (
                  <span
                    className={`min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[10px] font-bold ${
                      activeTab === tab.id
                        ? "bg-blue-100 text-blue-600"
                        : "bg-white/20 text-white"
                    }`}
                  >
                    {tabCounts[tab.id]}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      {!isMinimized && (
        <div className="p-4">
          {/* Clear button for completed/failed/cancelled tabs */}
          {activeTab !== "uploading" && tabCounts[activeTab] > 0 && (
            <div className="flex justify-end mb-3">
              <button
                onClick={
                  activeTab === "completed"
                    ? handleClearCompleted
                    : activeTab === "failed"
                    ? handleClearFailed
                    : handleClearCancelled
                }
                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg transition-all border-none cursor-pointer"
              >
                <IconTrash size={14} />
                Clear All {activeTab === "completed" ? "Completed" : activeTab === "failed" ? "Failed" : "Cancelled"}
              </button>
            </div>
          )}

          {/* Empty state */}
          {fileTree.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-gray-400">
              <div className="mb-2">
                {activeTab === "uploading" && <IconUpload size={40} stroke={1.5} />}
                {activeTab === "completed" && <IconCheck size={40} stroke={1.5} />}
                {activeTab === "failed" && <IconX size={40} stroke={1.5} />}
                {activeTab === "cancelled" && <IconBan size={40} stroke={1.5} />}
              </div>
              <span className="text-sm">
                No {activeTab} uploads
              </span>
            </div>
          )}

          {/* File list */}
          <div className="max-h-[350px] overflow-auto">
            <div className="flex flex-col gap-1">
              {fileTree.map((node, idx) => (
                <FileTreeNode
                  key={idx}
                  node={node}
                  handlePauseResume={handlePauseResume}
                  processingUploads={processingUploads}
                  handleDelete={handleDelete}
                  handleRetry={handleRetry}
                  depth={0}
                  activeTab={activeTab}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface FileTreeNodeProps {
  node: FileNode;
  handlePauseResume: (uploadQueueItem: UploadQueueState) => void;
  processingUploads: Set<string>;
  handleDelete: (_id: string) => void;
  handleRetry: (uploadQueueItem: UploadQueueState) => void;
  depth: number;
  activeTab: UploadTab;
}

function FileTreeNode(props: FileTreeNodeProps) {
  const { node, handlePauseResume, processingUploads, handleDelete, handleRetry, depth, activeTab } = props;
  const [isExpanded, setIsExpanded] = useState(true);

  if (node.type === "file" && node.file) {
    return (
      <div style={{ paddingLeft: `${depth * 20}px` }}>
        <FileUploadWithStatus
          file={node.file}
          handlePauseResume={handlePauseResume}
          processingUploads={processingUploads}
          handleDelete={handleDelete}
          handleRetry={handleRetry}
          activeTab={activeTab}
        />
      </div>
    );
  }

  return (
    <div>
      <div
        style={{ paddingLeft: `${depth * 20}px` }}
        className="cursor-pointer py-2 px-3 rounded-lg flex items-center gap-2 hover:bg-gray-50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span className="text-gray-400">
          {isExpanded ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
        </span>
        <span className="text-amber-500">
          {isExpanded ? <IconFolderOpen size={18} /> : <IconFolder size={18} />}
        </span>
        <span className="text-sm font-medium text-gray-600 select-none">
          {node.name}
        </span>
      </div>

      {isExpanded && (
        <div className="flex flex-col gap-1">
          {node.children?.map((child, idx) => (
            <FileTreeNode
              key={idx}
              node={child}
              handlePauseResume={handlePauseResume}
              processingUploads={processingUploads}
              handleDelete={handleDelete}
              handleRetry={handleRetry}
              depth={depth + 1}
              activeTab={activeTab}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface FileUploadWithStatusProps {
  file: UploadQueueState;
  handlePauseResume: (uploadQueueItem: UploadQueueState) => void;
  processingUploads: Set<string>;
  handleDelete: (_id: string) => void;
  handleRetry: (uploadQueueItem: UploadQueueState) => void;
  activeTab: UploadTab;
}

function FileUploadWithStatus(props: FileUploadWithStatusProps) {
  const { file, handlePauseResume, processingUploads, handleDelete, handleRetry, activeTab } = props;
  const fileName = file.name.split("/").pop() || "unknown file";

  const getStatusColor = () => {
    switch (file.status) {
      case "completed": return "bg-green-50 border-green-200";
      case "error": return "bg-red-50 border-red-200";
      case "cancelled": return "bg-gray-50 border-gray-200";
      case "paused": return "bg-yellow-50 border-yellow-200";
      default: return "bg-blue-50 border-blue-100";
    }
  };

  const getProgressColor = () => {
    switch (file.status) {
      case "completed": return "bg-green-500";
      case "error": return "bg-red-500";
      case "cancelled": return "bg-gray-400";
      case "paused": return "bg-yellow-500";
      default: return "bg-blue-500";
    }
  };

  const getStatusBadge = () => {
    switch (file.status) {
      case "completed":
        return (
          <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
            <IconCheck size={12} /> Complete
          </span>
        );
      case "error":
        return (
          <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">
            <IconX size={12} /> Failed
          </span>
        );
      case "cancelled":
        return (
          <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">
            <IconBan size={12} /> Cancelled
          </span>
        );
      case "paused":
        return (
          <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 font-medium">
            <IconPlayerPause size={12} /> Paused
          </span>
        );
      case "initiating":
        return (
          <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
            <IconLoader2 size={12} className="animate-spin" /> Starting...
          </span>
        );
      default:
        return null;
    }
  };

  const getFileIcon = () => {
    const ext = fileName.split(".").pop()?.toLowerCase();
    const iconProps = { size: 20, stroke: 1.5 };
    
    switch (ext) {
      case "pdf": 
        return <IconFileText {...iconProps} className="text-red-500" />;
      case "doc":
      case "docx": 
        return <IconFileText {...iconProps} className="text-blue-500" />;
      case "xls":
      case "xlsx": 
        return <IconFileSpreadsheet {...iconProps} className="text-green-600" />;
      case "ppt":
      case "pptx": 
        return <IconPresentation {...iconProps} className="text-orange-500" />;
      case "jpg":
      case "jpeg":
      case "png":
      case "gif":
      case "webp": 
        return <IconPhoto {...iconProps} className="text-purple-500" />;
      case "mp4":
      case "mov":
      case "avi": 
        return <IconVideo {...iconProps} className="text-pink-500" />;
      case "mp3":
      case "wav": 
        return <IconMusic {...iconProps} className="text-indigo-500" />;
      case "zip":
      case "rar":
      case "7z": 
        return <IconFileZip {...iconProps} className="text-amber-600" />;
      default: 
        return <IconFile {...iconProps} className="text-gray-500" />;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  return (
    <div className={`p-3 rounded-xl mb-2 border transition-all ${getStatusColor()}`}>
      <div className="flex justify-between mb-2 items-start">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {getFileIcon()}
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-sm font-medium overflow-hidden text-ellipsis whitespace-nowrap text-gray-700">
              {fileName}
            </span>
            <span className="text-xs text-gray-400">
              {formatFileSize(file.size)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {getStatusBadge()}
          
          {/* Action buttons based on tab */}
          {activeTab === "uploading" && file._id && (
            <div className="flex gap-1">
              <button
                onClick={() => handlePauseResume(file)}
                disabled={processingUploads.has(file._id) || file.status === "initiating"}
                className={`w-8 h-8 flex items-center justify-center rounded-lg border-none cursor-pointer transition-all ${
                  file.isPaused 
                    ? "bg-green-100 text-green-600 hover:bg-green-200" 
                    : "bg-yellow-100 text-yellow-600 hover:bg-yellow-200"
                } ${(processingUploads.has(file._id) || file.status === "initiating") ? "opacity-50 cursor-not-allowed" : ""}`}
                title={file.isPaused ? "Resume" : "Pause"}
              >
                {file.isPaused ? <IconPlayerPlay size={16} /> : <IconPlayerPause size={16} />}
              </button>
              <button
                onClick={() => handleDelete(file._id as string)}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-red-100 text-red-500 hover:bg-red-200 border-none cursor-pointer transition-all"
                title="Cancel"
              >
                <IconX size={16} />
              </button>
            </div>
          )}

          {activeTab === "failed" && (
            <button
              onClick={() => handleRetry(file)}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-blue-100 text-blue-600 hover:bg-blue-200 border-none cursor-pointer transition-all"
              title="Retry"
            >
              <IconRefresh size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Progress bar - show for uploading/paused */}
      {(activeTab === "uploading" || file.status === "uploading" || file.status === "paused" || file.status === "initiating") && (
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2 bg-white rounded-full overflow-hidden shadow-inner">
            <div
              className={`h-full transition-all duration-300 ease-out rounded-full ${getProgressColor()}`}
              style={{ width: `${file?.percentage ?? 0}%` }}
            />
          </div>
          <span className="text-xs text-gray-500 min-w-[45px] text-right font-mono font-medium">
            {file?.percentage ?? 0}%
          </span>
        </div>
      )}

      {/* Error message */}
      {file.status === "error" && file.error && (
        <div className="mt-2 text-xs text-red-600 bg-red-100 px-2 py-1 rounded-lg flex items-center gap-1">
          <IconX size={12} />
          {file.error}
        </div>
      )}
    </div>
  );
}

export default LiveFileUploadController;