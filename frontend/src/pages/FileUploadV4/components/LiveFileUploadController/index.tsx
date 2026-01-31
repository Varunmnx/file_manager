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

    <div className="w-[500px] bg-white rounded-lg shadow-[0_4px_12px_rgba(0,0,0,0.15)] fixed bottom-5 right-5 font-sans z-[100000]">
      <div className="p-5 flex flex-col gap-4">
        {/* Header */}
        <div className="flex justify-between items-center">
          <h3 className="m-0 text-lg font-semibold">Upload Manager</h3>
          <div className="flex gap-2.5">
            <button
              onClick={handleMinimize}
              className="bg-transparent border-none cursor-pointer p-1 text-[#868e96] hover:bg-gray-100 rounded"
            >
              −
            </button>
            <button
              className="bg-transparent border-none cursor-pointer p-1 text-[#868e96] hover:bg-gray-100 rounded"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Files with folder hierarchy */}
        {!isMinimized && (
          <div className="max-h-[400px] overflow-auto">
            <div className="flex flex-col gap-1">
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
        style={{ paddingLeft: `${depth * 20}px` }}
        className="cursor-pointer py-1 px-2 rounded flex items-center gap-1 hover:bg-gray-50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span className="text-[#868e96] text-sm leading-none">
          {isExpanded ? "▼" : "▶"}
        </span>
        <span className="text-lg leading-none">
          {isExpanded ? "📂" : "📁"}
        </span>
        <span className="text-sm font-medium text-[#868e96] select-none">
          {node.name}
        </span>
      </div>

      {isExpanded && (
        <div className="flex flex-col gap-1 mt-1">
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

    <div className="p-2 rounded bg-[#f8f9fa] mb-1 border border-gray-100 hover:border-gray-200 transition-colors">
      <div className="flex justify-between mb-2 items-center">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-sm">📄</span>
          <span className="text-sm font-medium overflow-hidden text-ellipsis whitespace-nowrap text-[#495057]">
            {fileName}
          </span>
        </div>
        {file?._id && (
          <div className="flex gap-2">
            <button
              onClick={() => handlePauseResume(file)}
              disabled={processingUploads.has(file._id)}
              className={`bg-transparent border-none cursor-pointer p-1 transition-opacity ${file.isPaused ? "text-[#4dabf7]" : "text-[#fab005]"} ${processingUploads.has(file._id) ? "opacity-50 cursor-not-allowed" : "hover:bg-gray-100 rounded"}`}
            >
              {file.isPaused ? "▶" : "⏸"}
            </button>
            <button
              onClick={() => handleDelete(file._id as string)}
              className="bg-transparent border-none cursor-pointer p-1 text-[#fa5252] hover:bg-red-50 rounded transition-colors"
            >
              🗑
            </button>
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 bg-[#e9ecef] rounded overflow-hidden">
          <div
            className={`h-full transition-[width] duration-300 ease-linear ${file.isPaused ? "bg-[#868e96]" : "bg-[#4dabf7]"}`}
            style={{ width: `${file?.percentage ?? 0}%` }}
          />
        </div>
        <span className="text-xs text-[#868e96] min-w-[40px] text-right font-mono">
          {file?.percentage ?? 0}%
        </span>
      </div>
    </div>
  );
}

export default LiveFileUploadController;