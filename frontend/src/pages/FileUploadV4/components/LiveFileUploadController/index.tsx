import { useState } from "react";
import { useChunkedUpload } from "../../context/chunked-upload.context";

// Mock types for demonstration
interface UploadQueueState {
  type: "file";
  name: string;
  file: File;
  size: number;
  path: string;
  percentage?: number;
  isPaused?: boolean;
  _id?: string;
  status?: "idle" | "initiating" | "uploading" | "completed" | "paused" | "cancelled" | "error";
}

interface FileNode {
  name: string;
  type: "file" | "folder";
  path: string;
  children?: FileNode[];
  file?: UploadQueueState;
}

const LiveFileUploadController = () => {
  const {uploadQueue} = useChunkedUpload()
  const [isMinimized, setIsMinimized] = useState(false);
  const [processingUploads] = useState<Set<string>>(new Set());

  const handlePauseResume = (uploadQueueItem: UploadQueueState) => {
    const _id = uploadQueueItem._id;
    if (!_id || processingUploads.has(_id)) return;
    
    console.log("Pause/Resume:", uploadQueueItem.name);
  };

  const handleDelete = (_id: string) => {
    console.log("Delete:", _id);
  };

  const handleMinimize = () => {
    setIsMinimized((prev) => !prev);
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

  const fileTree = buildFileTree(
    uploadQueue.filter(
      (file) =>
        file.status === "uploading" ||
        file.status === "paused" ||
        file.status === "initiating" ||
        file.status === "idle"
    )
  );

  return (
    <div
      style={{
        width: "500px",
        backgroundColor: "white",
        borderRadius: "8px",
        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        position: "fixed",
        bottom: "20px",
        right: "20px",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 600 }}>Upload Manager</h3>
          <div style={{ display: "flex", gap: "10px" }}>
            <button
              onClick={handleMinimize}
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: "4px",
                color: "#868e96",
              }}
            >
              −
            </button>
            <button
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: "4px",
                color: "#868e96",
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Files with folder hierarchy */}
        {!isMinimized && (
          <div style={{ maxHeight: "400px", overflow: "auto" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              {fileTree.map((node, idx) => (
                <FileTreeNode
                  key={idx}
                  node={node}
                  handlePauseResume={handlePauseResume}
                  processingUploads={processingUploads}
                  handleDelete={handleDelete}
                  depth={0}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

interface FileTreeNodeProps {
  node: FileNode;
  handlePauseResume: (uploadQueueItem: UploadQueueState) => void;
  processingUploads: Set<string>;
  handleDelete: (_id: string) => void;
  depth: number;
}

function FileTreeNode(props: FileTreeNodeProps) {
  const { node, handlePauseResume, processingUploads, handleDelete, depth } = props;
  const [isExpanded, setIsExpanded] = useState(true);

  if (node.type === "file" && node.file) {
    return (
      <div style={{ paddingLeft: `${depth * 20}px` }}>
        <FileUploadWithStatus
          file={node.file}
          handlePauseResume={handlePauseResume}
          processingUploads={processingUploads}
          handleDelete={handleDelete}
        />
      </div>
    );
  }

  return (
    <div>
      <div
        style={{
          paddingLeft: `${depth * 20}px`,
          cursor: "pointer",
          padding: "4px 8px",
          borderRadius: "4px",
          display: "flex",
          alignItems: "center",
          gap: "4px",
        }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span style={{ color: "#868e96", fontSize: "14px" }}>
          {isExpanded ? "▼" : "▶"}
        </span>
        <span style={{ fontSize: "18px" }}>
          {isExpanded ? "📂" : "📁"}
        </span>
        <span style={{ fontSize: "14px", fontWeight: 500, color: "#868e96" }}>
          {node.name}
        </span>
      </div>

      {isExpanded && (
        <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginTop: "4px" }}>
          {node.children?.map((child, idx) => (
            <FileTreeNode
              key={idx}
              node={child}
              handlePauseResume={handlePauseResume}
              processingUploads={processingUploads}
              handleDelete={handleDelete}
              depth={depth + 1}
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
}

function FileUploadWithStatus(props: FileUploadWithStatusProps) {
  const { file, handlePauseResume, processingUploads, handleDelete } = props;
  const fileName = file.name.split("/").pop() || "unknown file";

  return (
    <div
      style={{
        padding: "8px",
        borderRadius: "4px",
        backgroundColor: "#f8f9fa",
        marginBottom: "4px",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: "14px" }}>📄</span>
          <span style={{ fontSize: "14px", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {fileName}
          </span>
        </div>
        {file?._id && (
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={() => handlePauseResume(file)}
              disabled={processingUploads.has(file._id)}
              style={{
                background: "transparent",
                border: "none",
                cursor: processingUploads.has(file._id) ? "not-allowed" : "pointer",
                padding: "4px",
                opacity: processingUploads.has(file._id) ? 0.5 : 1,
                color: file.isPaused ? "#4dabf7" : "#fab005",
              }}
            >
              {file.isPaused ? "▶" : "⏸"}
            </button>
            <button
              onClick={() => handleDelete(file._id as string)}
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: "4px",
                color: "#fa5252",
              }}
            >
              🗑
            </button>
          </div>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <div
          style={{
            flex: 1,
            height: "8px",
            backgroundColor: "#e9ecef",
            borderRadius: "4px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${file?.percentage ?? 0}%`,
              height: "100%",
              backgroundColor: file.isPaused ? "#868e96" : "#4dabf7",
              transition: "width 0.3s ease",
            }}
          />
        </div>
        <span style={{ fontSize: "12px", color: "#868e96", minWidth: "40px", textAlign: "right" }}>
          {file?.percentage ?? 0}%
        </span>
      </div>
    </div>
  );
}

export default LiveFileUploadController;