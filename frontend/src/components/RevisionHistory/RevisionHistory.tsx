import { useState, useEffect } from 'react';

interface Revision {
  id: string;
  version: number;
  savedBy: string;
  createdAt: string;
  fileSize: number;
  downloadUrl: string;
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
  onRestore?: (version: number) => void;
}

export default function RevisionHistory({ fileId, isOpen, onClose, onRestore }: RevisionHistoryProps) {
  const [data, setData] = useState<RevisionHistoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [restoring, setRestoring] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen && fileId) {
      fetchRevisions();
    }
  }, [isOpen, fileId]);

  const fetchRevisions = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`http://localhost:3000/onlyoffice/revisions/${fileId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch revisions');
      }
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (version: number) => {
    if (!confirm(`Are you sure you want to restore to version ${version}? The current version will be saved as a new revision.`)) {
      return;
    }

    setRestoring(version);
    try {
      const response = await fetch(`http://localhost:3000/onlyoffice/revisions/${fileId}/restore/${version}`, {
        method: 'POST',
      });
      
      if (!response.ok) {
        throw new Error('Failed to restore revision');
      }

      const result = await response.json();
      alert(`Successfully restored to version ${version}. New version: ${result.newVersion}`);
      
      // Refresh the revision list
      fetchRevisions();
      
      if (onRestore) {
        onRestore(version);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to restore');
    } finally {
      setRestoring(null);
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

  if (!isOpen) return null;

  return (
    <div className="revision-history-overlay">
      <div className="revision-history-modal">
        <div className="revision-history-header">
          <h2>📜 Revision History</h2>
          <button onClick={onClose} className="close-btn">×</button>
        </div>

        {loading && (
          <div className="revision-history-loading">
            <div className="spinner"></div>
            <p>Loading revisions...</p>
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
              <span className="current-version">Current Version: v{data.currentVersion}</span>
            </div>

            {data.revisions.length === 0 ? (
              <div className="no-revisions">
                <p>📝 No previous versions available yet.</p>
                <p className="hint">Revisions are created when you save changes in the editor.</p>
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
                        <td>{revision.savedBy}</td>
                        <td>{formatDate(revision.createdAt)}</td>
                        <td>{formatFileSize(revision.fileSize)}</td>
                        <td className="actions">
                          <button
                            onClick={() => handleDownload(revision.downloadUrl)}
                            className="action-btn download-btn"
                            title="Download this version"
                          >
                            ⬇️
                          </button>
                          <button
                            onClick={() => handleRestore(revision.version)}
                            disabled={restoring === revision.version}
                            className="action-btn restore-btn"
                            title="Restore this version"
                          >
                            {restoring === revision.version ? '...' : '↩️'}
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

        .restore-btn {
          background: #fff3e0;
        }

        .restore-btn:hover {
          background: #ffe0b2;
        }

        .restore-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}
