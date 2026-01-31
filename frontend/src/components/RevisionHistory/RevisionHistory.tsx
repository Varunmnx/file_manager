import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { StorageKeys, loadString } from '@/utils/storage';
import { IconFolder } from '@tabler/icons-react';
import Icon from '@/components/Icon';
import { checkAndRetrieveExtension } from '../../pages/FileUploadV4/utils/getFileIcon';
import { FileTypeIconMapKeys } from '@/utils/fileTypeIcons';

interface Revision {
  id: string;
  version: number;
  savedBy: string;
  createdAt: string;
  fileSize: number;
  downloadUrl: string;
  aiChangeSummary?: string;
  aiFileSummary?: string;
  user?: {
    name: string;
    picture?: string;
  };
}

interface RevisionHistoryData {
  fileId: string;
  fileName: string;
  currentVersion: number;
  revisions: Revision[];
  activities?: Array<{
    action: string;
    details: string;
    itemId?: string;
    itemName?: string;
    isFolder?: boolean;
    fromId?: string;
    fromName?: string;
    toId?: string;
    toName?: string;
    timestamp: string;
    userId?: {
        firstName: string;
        lastName: string;
        picture?: string;
    };
  }>;
  isFolder?: boolean;
}

interface RevisionHistoryProps {
  fileId: string;
  isOpen: boolean;
  onClose: () => void;
  onViewRevision?: (version: number, config: any) => void;
}

// Helper function to get auth headers
const getAuthHeaders = (): HeadersInit => {
  const token = loadString(StorageKeys.TOKEN);
  return {
    'Authorization': token ? `Bearer ${token}` : '',
    'Content-Type': 'application/json',
  };
  };

const SUPPORTED_DOCS = ['docx', 'xlsx', 'pptx', 'doc', 'xls', 'ppt', 'pdf', 'txt', 'csv', 'ods', 'odp'];

// Helper to check file type
const getFileType = (fileName: string) => {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  if (SUPPORTED_DOCS.includes(ext)) return 'document';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return 'image';
  if (['mp4', 'webm', 'ogg'].includes(ext)) return 'video';
  if (['mp3', 'wav', 'ogg'].includes(ext)) return 'audio';
  return 'unknown';
};

export default function RevisionHistory({ fileId, isOpen, onClose, onViewRevision }: RevisionHistoryProps) {
  const [data, setData] = useState<RevisionHistoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewing, setViewing] = useState<number | null>(null);
  const [expandedSummary, setExpandedSummary] = useState<string | null>(null);
  const [loadingSummary, setLoadingSummary] = useState<string | null>(null);
  const [mediaPreview, setMediaPreview] = useState<{ url: string; type: 'image' | 'video' | 'audio' } | null>(null);
  const [activeTab, setActiveTab] = useState<'versions' | 'activities'>('versions');
  const navigate = useNavigate();

  useEffect(() => {
    if (isOpen && fileId) {
      fetchRevisions();
    }
  }, [isOpen, fileId]);

  const fetchRevisions = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`http://localhost:3000/onlyoffice/revisions/${fileId}`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Please log in to view version history');
        }
        throw new Error('Failed to fetch versions');
      }
      const result = await response.json();
      
      // Also fetch activities from the new history endpoint
      const historyResponse = await fetch(`http://localhost:3000/upload/${fileId}/history`, {
        headers: getAuthHeaders(),
      });
      if (historyResponse.ok) {
        result.activities = await historyResponse.json();
      }

      setData(result);
      if (result.isFolder || (result.revisions && result.revisions.length === 0)) {
        setActiveTab('activities');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleView = async (version: number, downloadUrl: string) => {
    if (!data) return;
    
    const fileType = getFileType(data.fileName);

    if (fileType === 'document') {
      setViewing(version);
      try {
        const response = await fetch(`http://localhost:3000/onlyoffice/revisions/${fileId}/view/${version}`, {
          headers: getAuthHeaders(),
        });
        
        if (!response.ok) {
          if (response.status === 401) {
            throw new Error('Please log in to view this version');
          }
          throw new Error('Failed to get version view config');
        }

        const result = await response.json();
        
        if (onViewRevision) {
          onViewRevision(version, result);
          onClose();
        } else {
           window.open(`http://localhost:3000/onlyoffice/download/${fileId}/revision/${version}`, '_blank');
        }
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Failed to view version');
      } finally {
        setViewing(null);
      }
    } else if (['image', 'video', 'audio'].includes(fileType)) {
      // For media files, show format preview
       setMediaPreview({
         url: `http://localhost:3000${downloadUrl}`,
         type: fileType as 'image' | 'video' | 'audio',
       });
    } else {
       alert('Preview not available for this file type. Please download to view.');
    }
  };

  const handleDownload = (downloadUrl: string) => {
    window.open(`http://localhost:3000${downloadUrl}`, '_blank');
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const handleToggleSummary = async (revision: Revision) => {
    if (expandedSummary === revision.id) {
        setExpandedSummary(null);
        return;
    }

    if (revision.aiFileSummary) {
        setExpandedSummary(revision.id);
        return;
    }

    // Load summary on demand
    setLoadingSummary(revision.id);
    try {
        const response = await fetch(`http://localhost:3000/onlyoffice/revisions/${revision.id}/summarize`, {
            method: 'POST',
            headers: getAuthHeaders(),
        });
        
        if (response.ok) {
            const result = await response.json();
            if (result.summary) {
                // Update local data
                setData(prev => prev ? ({
                    ...prev,
                    revisions: prev.revisions.map(r => 
                        r.id === revision.id ? { ...r, aiFileSummary: result.summary } : r
                    )
                }) : null);
                setExpandedSummary(revision.id);
            }
        }
    } catch (err) {
        console.error('Failed to load summary', err);
    } finally {
        setLoadingSummary(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[1000] backdrop-blur sm:p-4">
      <div className="bg-white rounded-xl w-[90%] max-w-[700px] max-h-[80vh] overflow-hidden shadow-2xl animate-slideUp flex flex-col">
        <div className="flex justify-between items-center px-6 py-5 bg-gradient-to-br from-[#667eea] to-[#764ba2] text-white shrink-0">
          <h2 className="m-0 text-xl font-semibold">{data?.isFolder ? '📜 Folder History' : '📜 File History'}</h2>
          <button onClick={onClose} className="bg-white/20 border-none text-white text-2xl w-9 h-9 rounded-full cursor-pointer transition-colors hover:bg-white/30 flex items-center justify-center">×</button>
        </div>

        {loading && (
          <div className="p-10 text-center text-[#666] flex flex-col items-center justify-center h-full">
            <div className="w-10 h-10 border-[3px] border-[#f3f3f3] border-t-[#667eea] rounded-full animate-spin mb-4"></div>
            <p>Loading versions...</p>
          </div>
        )}

        {error && (
          <div className="p-10 text-center text-[#666]">
            <p>❌ {error}</p>
            <button onClick={fetchRevisions} className="mt-3 py-2 px-5 bg-[#667eea] text-white border-none rounded-md cursor-pointer hover:bg-[#5667c7] transition-colors">Retry</button>
          </div>
        )}

        {data && !loading && !error && (
          <div className="p-6 overflow-y-auto flex-1">
            <div className="flex justify-between items-center px-4 py-3 bg-[#f8f9fa] rounded-lg mb-5">
              <strong>{data.fileName}</strong>
              <span className="bg-[#667eea] text-white py-1 px-3 rounded-full text-sm">Current: v{data.currentVersion}</span>
            </div>

            <div className="flex border-b border-[#eee] mb-5 gap-2">
               <button 
                 className={`px-4 py-2 bg-transparent border-b-2 font-medium cursor-pointer transition-colors ${activeTab === 'versions' ? 'text-[#667eea] border-[#667eea]' : 'text-[#666] border-transparent hover:text-[#667eea]'}`}
                 onClick={() => setActiveTab('versions')}
               >
                 📂 Version History
               </button>
               <button 
                 className={`px-4 py-2 bg-transparent border-b-2 font-medium cursor-pointer transition-colors ${activeTab === 'activities' ? 'text-[#667eea] border-[#667eea]' : 'text-[#666] border-transparent hover:text-[#667eea]'}`}
                 onClick={() => setActiveTab('activities')}
               >
                 🕒 Activity Log
               </button>
            </div>

            {activeTab === 'versions' ? (
               data.revisions.length === 0 ? (
                 <div className="bg-[#f8f9fa] rounded-lg p-10 text-center">
                   <p>📝 No previous versions available yet.</p>
                   <p className="text-sm text-[#999] mt-2">Versions are created when you save changes in the editor.</p>
                 </div>
               ) : (
                 <div className="overflow-x-auto">
                   <table className="w-full border-collapse">
                     <thead>
                       <tr>
                         <th className="bg-[#f8f9fa] font-semibold text-[#333] text-sm uppercase tracking-wide px-4 py-3 text-left border-b border-[#eee]">Version</th>
                         <th className="bg-[#f8f9fa] font-semibold text-[#333] text-sm uppercase tracking-wide px-4 py-3 text-left border-b border-[#eee]">Saved By</th>
                         <th className="bg-[#f8f9fa] font-semibold text-[#333] text-sm uppercase tracking-wide px-4 py-3 text-left border-b border-[#eee]">Date</th>
                         <th className="bg-[#f8f9fa] font-semibold text-[#333] text-sm uppercase tracking-wide px-4 py-3 text-left border-b border-[#eee]">Size</th>
                         <th className="bg-[#f8f9fa] font-semibold text-[#333] text-sm uppercase tracking-wide px-4 py-3 text-left border-b border-[#eee]">Actions</th>
                       </tr>
                     </thead>
                     <tbody>
                       {data.revisions.map((revision) => (
                         <tr key={revision.id} className="hover:bg-[#fafafa] transition-colors">
                           <td className="px-4 py-3 border-b border-[#eee]">
                             <span className="bg-[#e8eeff] text-[#667eea] py-1 px-2.5 rounded font-semibold text-sm">v{revision.version}</span>
                           </td>
                           <td className="px-4 py-3 border-b border-[#eee]">
                               <div className="flex flex-col gap-1">
                                 <div className="flex items-center gap-2">
                                     {revision.user?.picture ? (
                                         <img src={revision.user.picture} alt="" className="w-6 h-6 rounded-full object-cover" />
                                     ) : (
                                         <div className="w-6 h-6 rounded-full bg-[#cbd5e1] text-white flex items-center justify-center text-[0.7rem] font-bold">
                                             {(revision.user?.name || revision.savedBy).charAt(0).toUpperCase()}
                                         </div>
                                     )}
                                     <span className="font-medium text-[#333]">{revision.user?.name || revision.savedBy}</span>
                                 </div>
   
                                 {revision.aiChangeSummary && (
                                   <div className="flex items-start gap-1.5 text-xs text-[#667eea] bg-[#eef2ff] px-2.5 py-1.5 rounded-md border border-[#c7d2fe] max-w-[300px] mt-1" title="AI-generated change summary">
                                     <span className="text-[0.9rem]">✨</span>
                                     {revision.aiChangeSummary}
                                   </div>
                                 )}
                                 
                                 <button 
                                   className="bg-transparent border-none text-[#667eea] text-xs cursor-pointer text-left p-0 underline mt-1"
                                   onClick={() => handleToggleSummary(revision)}
                                   disabled={loadingSummary === revision.id}
                                 >
                                   {loadingSummary === revision.id ? 'Generating Summary...' : 
                                    (expandedSummary === revision.id ? 'Hide File Summary' : 'Show File Summary')}
                                 </button>
                                 
                                 {expandedSummary === revision.id && revision.aiFileSummary && (
                                   <div className="mt-1.5 bg-[#f8fafc] border border-[#e2e8f0] rounded-md p-2.5 text-[0.85rem] text-[#475569] animate-fadeIn">
                                     <strong className="block mb-1 text-[#334155]">📄 File Content Summary:</strong>
                                     <p className="m-0 leading-snug">{revision.aiFileSummary}</p>
                                   </div>
                                 )}
                               </div>
                            </td>
                            <td className="px-4 py-3 border-b border-[#eee] text-sm text-[#333]">{formatDate(revision.createdAt)}</td>
                            <td className="px-4 py-3 border-b border-[#eee] text-sm text-[#333]">{formatFileSize(revision.fileSize)}</td>
                            <td className="px-4 py-3 border-b border-[#eee] flex gap-2">
                              <button
                                onClick={() => handleView(revision.version, revision.downloadUrl)}
                                disabled={viewing === revision.version}
                                className="w-8 h-8 rounded-md cursor-pointer text-base transition-all flex items-center justify-center bg-[#e3f2fd] hover:bg-[#bbdefb] disabled:opacity-50 disabled:cursor-not-allowed"
                                title="View this version"
                              >
                                {viewing === revision.version ? '...' : '👁️'}
                              </button>
                              <button
                                onClick={() => handleDownload(revision.downloadUrl)}
                                className="w-8 h-8 rounded-md cursor-pointer text-base transition-all flex items-center justify-center bg-[#e8f5e9] hover:bg-[#c8e6c9]"
                                title="Download this version"
                              >
                                ⬇️
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
               )
            ) : (
               <div className="flex flex-col gap-4 relative p-2 ml-2">
                 {data.activities && data.activities.length > 0 ? (
                   [...data.activities].reverse().map((activity, idx) => (
                     <div key={idx} className="relative pl-6 border-l-2 border-[#e0e0e0]">
                       <div className="absolute left-[-5px] top-1 w-2.5 h-2.5 rounded-full bg-[#667eea]"></div>
                       <div className="bg-[#f8f9fa] rounded-lg p-3 text-sm mb-2">
                         {/* User identity for the action */}
                         {activity.userId && (
                           <div className="flex items-center gap-2 mb-2">
                              {activity.userId.picture ? (
                                <img src={activity.userId.picture} alt="" className="w-5 h-5 rounded-full object-cover" />
                              ) : (
                                <div className="w-5 h-5 rounded-full bg-[#cbd5e1] text-white flex items-center justify-center text-[0.6rem] font-bold">
                                  {activity.userId.firstName?.charAt(0)}
                                </div>
                              )}
                              <span className="font-medium text-[#333] text-xs leading-none">{activity.userId.firstName} {activity.userId.lastName}</span>
                           </div>
                         )}

                         <div className="flex justify-between items-start mb-1 gap-2 flex-wrap">
                           <span className="font-semibold text-[#333]">
                             {activity.action} {activity.itemId?.toString() !== data.fileId?.toString() ? "INTO THIS FOLDER" : ""}
                           </span>
                           <span className="text-xs text-[#999] whitespace-nowrap">{formatDate(activity.timestamp)}</span>
                         </div>
                         {activity.action === 'MOVE' ? (
                            <div className="bg-white p-2 rounded border border-[#eee] mt-2">
                              {activity.itemId?.toString() !== data.fileId?.toString() && (
                                <div className="flex items-center gap-2 mb-2 pb-2 border-b border-[#eee]">
                                  {activity.isFolder ? (
                                    <IconFolder size={18} className="text-[#4f46e5]" />
                                  ) : (
                                    <Icon 
                                      iconSize={20} 
                                      scaleFactor="_1.5x"
                                      extension={checkAndRetrieveExtension(activity.itemName || '') as FileTypeIconMapKeys} 
                                    />
                                  )}
                                  <strong>{activity.itemName}</strong>
                                </div>
                              )}
                              <div className="flex items-center gap-1 text-xs text-[#666] mb-1">
                                <span className="font-medium">From:</span>
                                <button 
                                  className="bg-transparent border-none text-[#667eea] cursor-pointer hover:underline p-0 text-xs"
                                  onClick={() => {
                                    if (activity.fromId) {
                                      onClose();
                                      navigate(`/folder/${activity.fromId}`);
                                    } else if (activity.fromName === 'Home') {
                                      onClose();
                                      navigate(`/`);
                                    }
                                  }}
                                >
                                  {activity.fromName}
                                </button>
                              </div>
                              <div className="flex items-center gap-1 text-xs text-[#666] mb-1">
                                <span className="font-medium">To:</span>
                                <button 
                                  className="bg-transparent border-none text-[#667eea] cursor-pointer hover:underline p-0 text-xs font-semibold"
                                  onClick={() => {
                                    if (activity.toId) {
                                      onClose();
                                      navigate(`/folder/${activity.toId}`);
                                    } else if (activity.toName === 'Home') {
                                      onClose();
                                      navigate(`/`);
                                    }
                                  }}
                                >
                                  {activity.toName}
                                </button>
                              </div>
                            </div>
                         ) : (
                           <p className="m-0 text-[#555]">{activity.details}</p>
                         )}
                       </div>
                     </div>
                   ))
                 ) : (
                   <div className="bg-[#f8f9fa] rounded-lg p-10 text-center text-[#666]">
                     <p>No activity recorded for this file yet.</p>
                   </div>
                 )}
               </div>
            )}
           </div>
         )}
         
         {mediaPreview && (
          <div className="fixed inset-0 bg-black/85 z-[2000] flex items-center justify-center backdrop-blur-sm" onClick={() => setMediaPreview(null)}>
            <div className="relative max-w-[90vw] max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
               <button className="absolute -top-10 -right-10 bg-white/20 hover:bg-white/30 rounded-full w-10 h-10 border-none text-white text-2xl flex items-center justify-center cursor-pointer transition-colors backdrop-blur-md z-[2001]" onClick={() => setMediaPreview(null)}>×</button>
               {mediaPreview.type === 'image' && <img src={mediaPreview.url} alt="Preview" className="max-w-full max-h-[90vh] rounded-lg shadow-2xl" />}
               {mediaPreview.type === 'video' && <video src={mediaPreview.url} controls autoPlay className="max-w-full max-h-[90vh] rounded-lg shadow-2xl" />}
               {mediaPreview.type === 'audio' && <audio src={mediaPreview.url} controls autoPlay className="w-[300px]" />}
            </div>
          </div>
        )}
       </div>
    </div>
  );
}

