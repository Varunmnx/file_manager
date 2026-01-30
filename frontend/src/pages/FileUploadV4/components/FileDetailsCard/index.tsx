import { X, Download, Share2, Trash2, Edit, Eye, Clock, HardDrive } from 'lucide-react'; 
import { useNavigate } from 'react-router-dom';
import { useChunkedUpload } from '../../context/chunked-upload.context';
import useGetHistory from '../../hooks/useGetHistory';
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
  const navigate = useNavigate();
  const { data: historyData } = useGetHistory(fileDetails?._id);
  
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
  }, [fileDetails, setFileDetails]);

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

            {historyData && historyData.length > 0 && (
              <div className="mt-6">
                 <label className="text-xs font-semibold text-gray-500 uppercase flex items-center gap-2 mb-3">
                  <Clock size={14} className="text-blue-600" />
                  Activity History
                </label>
                <div className="space-y-3">
                  {[...historyData].reverse().map((activity: any, idx: number) => (
                    <div key={idx} className="relative pl-6 pb-4 border-l-2 border-blue-100 last:border-0 last:pb-0">
                      <div className="absolute left-[-6px] top-0 w-2.5 h-2.5 rounded-full bg-blue-500 border-2 border-white shadow-sm" />
                      <div className="bg-white p-2.5 rounded-lg border border-gray-100 shadow-xs">
                        {/* User info */}
                        {activity.userId && (
                          <div className="flex items-center gap-2 mb-2 pb-2 border-bottom border-gray-50 border-b">
                            {activity.userId.picture ? (
                              <img src={activity.userId.picture} className="w-5 h-5 rounded-full" alt="" />
                            ) : (
                              <div className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] flex items-center justify-center font-bold">
                                {activity.userId.firstName?.charAt(0)}
                              </div>
                            )}
                            <span className="text-[10px] font-semibold text-gray-700">
                              {activity.userId.firstName} {activity.userId.lastName}
                            </span>
                          </div>
                        )}

                        <div className="flex items-center justify-between mb-1">
                          <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">
                            {activity.action} {activity.itemId?.toString() !== fileDetails?._id?.toString() ? "INTO THIS FOLDER" : ""}
                          </p>
                          <p className="text-[9px] text-gray-400 font-medium">
                            {activity.timestamp ? new Date(activity.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                          </p>
                        </div>

                        {activity.action === 'MOVE' && (
                          <div className="mb-2">
                            {activity.itemId?.toString() !== fileDetails?._id?.toString() && (
                               <div className="flex items-center gap-2 mb-2 p-1.5 bg-gray-50 rounded border border-gray-100">
                                 {activity.isFolder ? (
                                   <IconFolder size={16} className="text-blue-600" />
                                 ) : (
                                   <Icon 
                                     iconSize={16} 
                                     scaleFactor="_1.5x"
                                     extension={checkAndRetrieveExtension(activity.itemName || '') as FileTypeIconMapKeys} 
                                   />
                                 )}
                                 <span className="text-xs font-bold text-gray-800 truncate">
                                   {activity.itemName}
                                 </span>
                               </div>
                            )}
                            <div className="flex flex-col gap-1">
                               <div className="flex items-center gap-2">
                                 <span className="text-xs text-gray-400 w-10">From</span>
                                 <button 
                                   className="text-[10px] font-semibold text-gray-700 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100 hover:bg-gray-100 transition-colors truncate"
                                   onClick={() => {
                                     if (activity.fromId) {
                                       setFileDetails(undefined);
                                       navigate(`/folder/${activity.fromId}`);
                                     } else if (activity.fromName === 'Home') {
                                       setFileDetails(undefined);
                                       navigate(`/`);
                                     }
                                   }}
                                 >
                                   {activity.fromName}
                                 </button>
                               </div>
                               <div className="flex items-center gap-2">
                                 <span className="text-xs text-gray-400 w-10">To</span>
                                 <button 
                                   className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 hover:bg-blue-100 transition-colors truncate"
                                   onClick={() => {
                                     if (activity.toId) {
                                       setFileDetails(undefined);
                                       navigate(`/folder/${activity.toId}`);
                                     } else if (activity.toName === 'Home') {
                                       setFileDetails(undefined);
                                       navigate(`/`);
                                     }
                                   }}
                                 >
                                   {activity.toName}
                                 </button>
                               </div>
                            </div>
                          </div>
                        )}
                        
                        {activity.action !== 'MOVE' && (
                          <p className="text-sm text-gray-600 leading-snug">{activity.details}</p>
                        )}

                        <p className="text-[10px] text-gray-400 mt-2 font-medium border-t border-gray-50 pt-1">
                          {activity.timestamp ? new Date(activity.timestamp).toLocaleDateString() : 'Date unavailable'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

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