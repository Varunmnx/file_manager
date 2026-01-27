import { useParams, useNavigate } from 'react-router-dom';
import { OnlyOfficeEditor } from '../../components/OnlyOfficeEditor';
import { useEffect, useState } from 'react';

export default function DocumentEditor() {
  const { fileId } = useParams<{ fileId: string }>();
  const navigate = useNavigate();
  const [fileName, setFileName] = useState('Document');

  // File name will be loaded by OnlyOfficeEditor component directly from config

  const handleClose = () => {
    navigate(-1); // Go back to previous page
  };

  if (!fileId) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-red-800 mb-2">Error</h2>
          <p className="text-red-600">File ID is required</p>
          <button
            onClick={handleClose}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return <OnlyOfficeEditor fileId={fileId} fileName={fileName} onClose={handleClose} />;
}
