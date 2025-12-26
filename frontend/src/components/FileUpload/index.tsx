import "./index.css"
import {FileTreeItem} from "./types"   
import { useDropzone } from "./hooks/useDropZone";
import { FolderItemComponent } from "./FolderItem";
import FileItemComponent from "./FileItem";

interface DropzoneProps {
  accept?: string;
  maxSize?: number;
  maxFiles?: number;
  multiple?: boolean;
  onDrop?: (files: File[], tree: FileTreeItem[]) => void;
  className?: string;
  onUpload: (tree: FileTreeItem[]) => void
}

export default function Dropzone({ 
  accept = '*',
  maxSize = 5 * 1024 * 1024,
  maxFiles = 100,
  multiple = true,
  onDrop,
  className = '',
  onUpload
}: DropzoneProps) {
  const {
    fileTree,
    isDragging,
    errors,
    fileInputRef,
    handleDrop,
    handleDragOver,
    handleDragEnter,
    handleDragLeave,
    handleFileInput,
    openFileDialog,
    openFolderDialog,
    removeItem,
    clearAll,
  } = useDropzone({ accept, maxSize, maxFiles, multiple, onDrop }); 

  return (
    <div className={`w-full max-w-2xl mx-auto p-4 ${className}`}>
      {/* Dropzone Area */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center
          transition-all duration-200 ease-in-out
          ${isDragging 
            ? 'border-blue-500 bg-blue-50' 
            : 'border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100'
          }
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleFileInput}
          className="hidden"
        />
        
        <svg 
          className="mx-auto h-12 w-12 text-gray-400 mb-4" 
          stroke="currentColor" 
          fill="none" 
          viewBox="0 0 48 48"
        >
          <path 
            d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round" 
          />
        </svg>
        
        <p className="text-lg font-medium text-gray-700 mb-4">
          {isDragging ? 'Drop files or folders here' : 'Drop files/folders or click to upload'}
        </p>
        
        <div className="flex gap-3 justify-center">
          <button
            onClick={openFileDialog}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium"
          >
            Select Files
          </button>
          <button
            onClick={openFolderDialog}
            className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm font-medium"
          >
            Select Folder
          </button>
        </div>
        
        <p className="text-sm text-gray-500 mt-4">
          {accept !== '*' ? `Accepted: ${accept}` : 'Any file type'} | 
          Max {(maxSize / 1024 / 1024).toFixed(0)}MB per file
        </p>
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <h4 className="text-sm font-semibold text-red-800 mb-2">Errors:</h4>
          <ul className="text-sm text-red-600 space-y-1">
            {errors.map((error, index) => (
              <li key={index}>• {error}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Files/Folders Tree */}
      {fileTree.length > 0 && (
        <div className="mt-4">
          <div className="flex justify-between items-center mb-3">
            <h4 className="text-sm font-semibold text-gray-700">
              Uploaded Items ({fileTree.length})
            </h4>
                        <button
              onClick={()=>{
                onUpload(fileTree);
              }}
              className="text-sm text-red-600 hover:text-red-800 font-medium"
            >
              Upload Files
            </button>
            <button
              onClick={clearAll}
              className="text-sm text-red-600 hover:text-red-800 font-medium"
            >
              Clear All
            </button>
          </div>
          
          <div className="space-y-2">
            {fileTree.map((item, index) => (
              <div key={index} className="flex flex-col gap-2">
                {item.type === 'folder' ? (
                  <FolderItemComponent
                    folder={item}  
                    onRemove={() => removeItem(index)}
                  />
                ) : item.type === 'root' ? (
                  item.children.map((child, childIndex) => (
                    <FileItemComponent
                      key={childIndex}
                      file={child}
                      onRemove={() => removeItem(index, childIndex,"file")}
                    />
                  ))
                ) : null}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}





 