import { useState, useEffect } from 'react';
import { StorageKeys, loadString } from '@/utils/storage';

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
      setData(result);
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
    <div className="revision-history-overlay">
      <div className="revision-history-modal">
        <div className="revision-history-header">
          <h2>📜 Version History</h2>
          <button onClick={onClose} className="close-btn">×</button>
        </div>

        {loading && (
          <div className="revision-history-loading">
            <div className="spinner"></div>
            <p>Loading versions...</p>
          </div>
        )}

        {error && (
          <div className="revision-history-error">
            <p>❌ {error}</p>
            <button onClick={fetchRevisions}>Retry</button>
          </div>
        )}

        {data && !loading && !error && (
          <div className="revision-history-content">
            <div className="file-info">
              <strong>{data.fileName}</strong>
              <span className="current-version">Current: v{data.currentVersion}</span>
            </div>

            {data.revisions.length === 0 ? (
              <div className="no-revisions">
                <p>📝 No previous versions available yet.</p>
                <p className="hint">Versions are created when you save changes in the editor.</p>
              </div>
            ) : (
              <div className="revisions-list">
                <table>
                  <thead>
                    <tr>
                      <th>Version</th>
                      <th>Saved By</th>
                      <th>Date</th>
                      <th>Size</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.revisions.map((revision) => (
                      <tr key={revision.id}>
                        <td>
                          <span className="version-badge">v{revision.version}</span>
                        </td>
                        <td>
                            <div className="user-info">
                              <div className="user-details">
                                  {revision.user?.picture ? (
                                      <img src={revision.user.picture} alt="" className="user-avatar" />
                                  ) : (
                                      <div className="user-avatar-placeholder">
                                          {(revision.user?.name || revision.savedBy).charAt(0).toUpperCase()}
                                      </div>
                                  )}
                                  <span className="user-name">{revision.user?.name || revision.savedBy}</span>
                              </div>

                              {revision.aiChangeSummary && (
                                <div className="ai-insight" title="AI-generated change summary">
                                  <span className="ai-icon">✨</span>
                                  {revision.aiChangeSummary}
                                </div>
                              )}
                              
                              <button 
                                className="view-summary-btn"
                                onClick={() => handleToggleSummary(revision)}
                                disabled={loadingSummary === revision.id}
                              >
                                {loadingSummary === revision.id ? 'Generating Summary...' : 
                                 (expandedSummary === revision.id ? 'Hide File Summary' : 'Show File Summary')}
                              </button>
                              
                              {expandedSummary === revision.id && revision.aiFileSummary && (
                                <div className="file-summary-box">
                                  <strong>📄 File Content Summary:</strong>
                                  <p>{revision.aiFileSummary}</p>
                                </div>
                              )}
                           </div>
                         </td>
                         <td>{formatDate(revision.createdAt)}</td>
                         <td>{formatFileSize(revision.fileSize)}</td>
                         <td className="actions">
                           <button
                             onClick={() => handleView(revision.version, revision.downloadUrl)}
                             disabled={viewing === revision.version}
                             className="action-btn view-btn"
                             title="View this version"
                           >
                             {viewing === revision.version ? '...' : '👁️'}
                           </button>
                           <button
                             onClick={() => handleDownload(revision.downloadUrl)}
                             className="action-btn download-btn"
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
             )}
           </div>
         )}
         
         {mediaPreview && (
          <div className="media-preview-overlay" onClick={() => setMediaPreview(null)}>
            <div className="media-preview-content" onClick={(e) => e.stopPropagation()}>
               <button className="close-preview-btn" onClick={() => setMediaPreview(null)}>×</button>
               {mediaPreview.type === 'image' && <img src={mediaPreview.url} alt="Preview" />}
               {mediaPreview.type === 'video' && <video src={mediaPreview.url} controls autoPlay />}
               {mediaPreview.type === 'audio' && <audio src={mediaPreview.url} controls autoPlay />}
            </div>
          </div>
        )}
       </div>

      <style>{`
        .revision-history-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          backdrop-filter: blur(4px);
        }

        .revision-history-modal {
          background: white;
          border-radius: 12px;
          width: 90%;
          max-width: 700px;
          max-height: 80vh;
          overflow: hidden;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          animation: slideUp 0.3s ease;
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .revision-history-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 24px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }

        .revision-history-header h2 {
          margin: 0;
          font-size: 1.4rem;
          font-weight: 600;
        }

        .close-btn {
          background: rgba(255, 255, 255, 0.2);
          border: none;
          color: white;
          font-size: 1.5rem;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          cursor: pointer;
          transition: background 0.2s;
        }

        .close-btn:hover {
          background: rgba(255, 255, 255, 0.3);
        }

        .revision-history-loading,
        .revision-history-error,
        .no-revisions {
          padding: 40px;
          text-align: center;
          color: #666;
        }

        .spinner {
          width: 40px;
          height: 40px;
          border: 3px solid #f3f3f3;
          border-top: 3px solid #667eea;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto 16px;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .revision-history-error button {
          margin-top: 12px;
          padding: 8px 20px;
          background: #667eea;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
        }

        .revision-history-content {
          padding: 24px;
          max-height: calc(80vh - 80px);
          overflow-y: auto;
        }

        .file-info {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          background: #f8f9fa;
          border-radius: 8px;
          margin-bottom: 20px;
        }

        .current-version {
          background: #667eea;
          color: white;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 0.85rem;
        }

        .no-revisions {
          background: #f8f9fa;
          border-radius: 8px;
          padding: 40px;
        }

        .no-revisions .hint {
          font-size: 0.9rem;
          color: #999;
          margin-top: 8px;
        }

        .revisions-list table {
          width: 100%;
          border-collapse: collapse;
        }

        .revisions-list th,
        .revisions-list td {
          padding: 12px 16px;
          text-align: left;
          border-bottom: 1px solid #eee;
        }

        .revisions-list th {
          background: #f8f9fa;
          font-weight: 600;
          color: #333;
          font-size: 0.85rem;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .revisions-list tr:hover {
          background: #fafafa;
        }

        .version-badge {
          background: #e8eeff;
          color: #667eea;
          padding: 4px 10px;
          border-radius: 4px;
          font-weight: 600;
          font-size: 0.9rem;
        }

        .actions {
          display: flex;
          gap: 8px;
        }

        .action-btn {
          width: 32px;
          height: 32px;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-size: 1rem;
          transition: all 0.2s;
        }

        .download-btn {
          background: #e8f5e9;
        }

        .download-btn:hover {
          background: #c8e6c9;
        }

        .view-btn {
          background: #e3f2fd;
        }

        .view-btn:hover {
          background: #bbdefb;
        }

        .view-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .user-info {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .ai-insight {
          display: flex;
          align-items: start;
          gap: 6px;
          font-size: 0.8rem;
          color: #667eea;
          background: #eef2ff;
          padding: 6px 10px;
          border-radius: 6px;
          border: 1px solid #c7d2fe;
          max-width: 300px;
        }

        .user-name {
          font-weight: 500;
          color: #333;
        }

        .user-details {
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .user-avatar {
            width: 24px;
            height: 24px;
            border-radius: 50%;
            object-fit: cover;
        }

        .user-avatar-placeholder {
            width: 24px;
            height: 24px;
            border-radius: 50%;
            background: #cbd5e1;
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 0.7rem;
            font-weight: bold;
        }

        .view-summary-btn {
          background: none;
          border: none;
          color: #667eea;
          font-size: 0.8rem;
          cursor: pointer;
          text-align: left;
          padding: 0;
          text-decoration: underline;
          margin-top: 4px;
        }

        .file-summary-box {
          margin-top: 6px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          padding: 10px;
          font-size: 0.85rem;
          color: #475569;
          animation: fadeIn 0.3s ease;
        }

        .file-summary-box strong {
          display: block;
          margin-bottom: 4px;
          color: #334155;
        }

        .file-summary-box p {
          margin: 0;
          line-height: 1.4;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-5px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .ai-icon {
          font-size: 0.9rem;
        }

        .media-preview-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.85);
          z-index: 2000;
          display: flex;
          align-items: center;
          justify-content: center;
          backdrop-filter: blur(5px);
        }

        .media-preview-content {
          position: relative;
          max-width: 90vw;
          max-height: 90vh;
        }

        .media-preview-content img,
        .media-preview-content video {
          max-width: 100%;
          max-height: 90vh;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.5);
        }

        .media-preview-content audio {
          width: 300px;
        }

        .close-preview-btn {
          position: absolute;
          top: -40px;
          right: -40px;
          background: none;
          border: none;
          color: white;
          font-size: 2rem;
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}
