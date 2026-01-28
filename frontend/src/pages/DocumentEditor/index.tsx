import { useParams, useNavigate } from 'react-router-dom';
import { OnlyOfficeEditor } from '../../components/OnlyOfficeEditor';

export default function DocumentEditor() {
  const { fileId, version } = useParams<{ fileId: string; version?: string }>();
  const navigate = useNavigate();
  const fileName = 'Document'; // fileName will come from the editor config

  // If version is specified, we're viewing a revision in read-only mode
  const revisionVersion = version ? parseInt(version) : undefined;

  const handleClose = () => {
    // If viewing a revision, go back to the main document
    if (revisionVersion) {
      navigate(`/document/${fileId}`);
    } else {
      navigate("/"); // Go back to previous page
    }
  };

  if (!fileId) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-red-800 mb-2">Error</h2>
          <p className="text-red-600">File ID is required</p>
          <button
            onClick={() => navigate(-1)}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <OnlyOfficeEditor 
      fileId={fileId} 
      fileName={fileName} 
      onClose={handleClose}
      revisionVersion={revisionVersion}
    />
  );
}

