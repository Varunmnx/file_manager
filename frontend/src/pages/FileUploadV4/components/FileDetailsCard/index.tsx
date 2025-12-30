import { X, Download, Share2, Trash2, Edit, Eye, Clock, HardDrive } from 'lucide-react'; 
import { useChunkedUpload } from '../../context/chunked-upload.context';
import { formatBytes } from '@/utils/formatBytes';
import { formatDate } from '@/utils/getDateTime';
import Icon from '@/components/Icon';
import { checkAndRetrieveExtension } from '../../utils/getFileIcon';
import { FileTypeIconMapKeys } from '@/utils/fileTypeIcons';
import { IconFolder } from '@tabler/icons-react';
import { useEffect, useRef } from 'react';

 

export default function FileDetailsCard() { 
  const fileDetailsRef = useRef<HTMLDivElement>(null)
  const {setFileDetails,fileDetails} = useChunkedUpload()
  
  useEffect(() => {
    window.addEventListener('click', (event) => {
      if (fileDetailsRef.current && !fileDetailsRef.current.contains(event.target as Node)) {
        setFileDetails(undefined)
      }
    })
    return () => {
      window.removeEventListener('click', (event) => {
        if (fileDetailsRef.current && !fileDetailsRef.current.contains(event.target as Node)) {
          setFileDetails(undefined)
        }
      })
    }
  }, [fileDetails]);

  return ( 
      <div
        ref={fileDetailsRef}
        className={`fixed top-0 left-0 h-full w-96 bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out ${
          fileDetails ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="bg-linear-to-r from-blue-600 to-blue-700 text-white p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="bg-opacity-20 p-3 rounded-lg">
                 {fileDetails?.isFolder ? (
                  <IconFolder
                    size={24} 
                  />
                ) : (
                  <Icon
                    iconSize={24}
                    scaleFactor="_1.5x"
                    extension={
                      checkAndRetrieveExtension(
                        fileDetails?.fileName as string
                      ) as FileTypeIconMapKeys
                    }
                  />
                )}
              </div>
              <div>
                <h2 className="text-lg font-semibold">File Details</h2>
                <p className="text-blue-100 text-sm">Document Information</p>
              </div>
            </div>
            <button
              onClick={() => setFileDetails(undefined)}
              className="group group-hover:bg-white hover:bg-opacity-20 p-2 rounded-full transition-colors"
            >
              <X size={20} className='group-hover:text-black cursor-pointer' />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto h-[calc(100%-140px)] ">
          {/* File Preview Icon */}
          <div className="flex justify-center mb-6">
            <div className="bg-red-50 p-8 rounded-xl">
              {fileDetails?.isFolder ? (
                  <IconFolder
                    size={24} 
                  />
                ) : (
                  <Icon
                    iconSize={24}
                    scaleFactor="_1.5x"
                    extension={
                      checkAndRetrieveExtension(
                        fileDetails?.fileName as string
                      ) as FileTypeIconMapKeys
                    }
                  />
                )}
            </div>
          </div>

          {/* File Name */}
          <div className="text-center mb-6">
            <h3 className="text-xl font-bold text-gray-800 wrap-break-word">
              {fileDetails?.fileName?.split("/").pop()}
            </h3>
            <p className="text-gray-500 text-sm mt-1">{fileDetails?.isFolder ? "Folder" : "File"}</p>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="bg-gray-50 p-3 rounded-lg text-center">
              <Eye size={20} className="mx-auto text-gray-600 mb-1" />
              <p className="text-xs text-gray-500">Views</p>
              <p className="font-semibold text-gray-800">{0}</p>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg text-center">
              <Download size={20} className="mx-auto text-gray-600 mb-1" />
              <p className="text-xs text-gray-500">Downloads</p>
              <p className="font-semibold text-gray-800">{1}</p>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg text-center">
              <HardDrive size={20} className="mx-auto text-gray-600 mb-1" />
              <p className="text-xs text-gray-500">Size</p>
              <p className="font-semibold text-gray-800">{formatBytes(fileDetails?.fileSize ?? 0)}</p>
            </div>
          </div>

          {/* Details */}
          <div className="space-y-4">
            <div className="border-l-4 border-blue-600 pl-4 py-2">
              <label className="text-xs font-semibold text-gray-500 uppercase">Uploaded By</label>
              <p className="text-gray-800 font-medium">{"NA"}</p>
            </div>

            <div className="border-l-4 border-green-600 pl-4 py-2">
              <label className="text-xs font-semibold text-gray-500 uppercase">Upload Date</label>
              <p className="text-gray-800 font-medium">{formatDate(fileDetails?.createdAt as unknown as string)}</p>
            </div>

            <div className="border-l-4 border-orange-600 pl-4 py-2">
              <label className="text-xs font-semibold text-gray-500 uppercase flex items-center gap-2">
                <Clock size={14} />
                Last Modified
              </label>
              <p className="text-gray-800 font-medium">{formatDate(fileDetails?.lastActivity as unknown as string)}</p>
            </div>

            <div className="border-l-4 border-purple-600 pl-4 py-2">
              <label className="text-xs font-semibold text-gray-500 uppercase">Last Accessed</label>
              <p className="text-gray-800 font-medium">{formatDate(fileDetails?.lastActivity as unknown as string)}</p>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <label className="text-xs font-semibold text-gray-500 uppercase">Location</label>
              <p className="text-gray-800 font-mono text-sm mt-1 break-all">{"NA"}</p>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <label className="text-xs font-semibold text-gray-500 uppercase">Permissions</label>
              <p className="text-gray-800 font-medium mt-1">{"NA"}</p>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase">Description</label>
              <p className="text-gray-700 mt-2 text-sm leading-relaxed">
                {"NA"}
              </p>
            </div>
          </div>
          <div className='mb-[200px]'/>
        </div> 

        {/* Action Buttons Footer */}
        <div className="absolute bottom-0 left-0 right-0 bg-white border-t p-4 grid grid-cols-4 gap-2">
          <button className="flex flex-col items-center justify-center p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <Download size={20} className="text-blue-600 mb-1" />
            <span className="text-xs text-gray-600">Download</span>
          </button>
          <button className="flex flex-col items-center justify-center p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <Share2 size={20} className="text-green-600 mb-1" />
            <span className="text-xs text-gray-600">Share</span>
          </button>
          <button className="flex flex-col items-center justify-center p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <Edit size={20} className="text-orange-600 mb-1" />
            <span className="text-xs text-gray-600">Edit</span>
          </button>
          <button className="flex flex-col items-center justify-center p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <Trash2 size={20} className="text-red-600 mb-1" />
            <span className="text-xs text-gray-600">Delete</span>
          </button>
        </div>
      </div> 
  );
}