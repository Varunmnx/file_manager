import { useEffect, useRef, useState } from 'react';

interface OnlyOfficeEditorProps {
  fileId: string;
  fileName: string;
  onClose?: () => void;
}

interface EditorConfig {
  config: {
    width: string;
    height: string;
    document: {
      fileType: string;
      key: string;
      title: string;
      url: string;
      permissions: {
        edit: boolean;
        download: boolean;
        print: boolean;
        review: boolean;
      };
    };
    documentType: string;
    editorConfig: {
      mode: string;
      callbackUrl: string;
      user: {
        id: string;
        name: string;
      };
      customization: {
        autosave: boolean;
        forcesave: boolean;
      };
    };
  };
  token: string;
  onlyOfficeUrl: string;
}

declare global {
  interface Window {
    DocsAPI?: {
      DocEditor: new (containerId: string, config: any) => {
        destroyEditor: () => void;
      };
    };
  }
}

export default function OnlyOfficeEditor({ fileId, fileName, onClose }: OnlyOfficeEditorProps) {
  const [editorConfig, setEditorConfig] = useState<EditorConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const editorRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isMountedRef = useRef(true);
  const cleanupDoneRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Fetch configuration
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        console.log('Fetching editor config for fileId:', fileId);
        const response = await fetch(`http://localhost:3000/onlyoffice/config/${fileId}`);

        if (!response.ok) {
          throw new Error('Failed to fetch editor configuration');
        }

        const config = await response.json();
        console.log('Editor config received:', config);
        
        if (isMountedRef.current) {
          setEditorConfig(config);
        }
      } catch (err) {
        console.error('Error fetching config:', err);
        if (isMountedRef.current) {
          setError(err instanceof Error ? err.message : 'Unknown error');
          setLoading(false);
        }
      }
    };

    fetchConfig();
  }, [fileId]);

  // Load script and initialize editor
  useEffect(() => {
    if (!editorConfig) return;

    const scriptUrl = `${editorConfig.onlyOfficeUrl}/web-apps/apps/api/documents/api.js`;
    let script: HTMLScriptElement | null = null;

    const initEditor = () => {
      if (!window.DocsAPI || !isMountedRef.current) return;

      console.log('Initializing OnlyOffice editor');

      // Create a completely isolated container
      const editorDiv = document.createElement('div');
      editorDiv.id = `onlyoffice-editor-${Date.now()}`;
      editorDiv.style.width = '100%';
      editorDiv.style.height = '100%';

      // Insert into our ref container
      if (containerRef.current) {
        // Clear any existing content
        containerRef.current.innerHTML = '';
        containerRef.current.appendChild(editorDiv);
      }

      const config = {
        ...editorConfig.config,
        events: {
          onDocumentReady: () => {
            console.log('✅ Document ready');
            if (isMountedRef.current) {
              setLoading(false);
            }
          },
          onError: (event: any) => {
            console.error('❌ Editor error:', event);
            
            let errorMessage = 'Editor error occurred';
            if (event?.data?.errorCode) {
              switch (event.data.errorCode) {
                case -3:
                  errorMessage = 'Cannot download document. Check OnlyOffice can reach backend.';
                  break;
                case -4:
                  errorMessage = 'Error downloading document for editing';
                  break;
                case -8:
                  errorMessage = 'Invalid token. Check JWT configuration.';
                  break;
                default:
                  errorMessage = `Error code: ${event.data.errorCode}`;
              }
            }
            
            if (isMountedRef.current) {
              setError(errorMessage);
              setLoading(false);
            }
          },
          onWarning: (event: any) => {
            console.warn('⚠️ Warning:', event);
          },
        },
      };

      try {
        editorRef.current = new window.DocsAPI.DocEditor(editorDiv.id, config);
        console.log('✅ Editor created');
      } catch (e) {
        console.error('Failed to create editor:', e);
        if (isMountedRef.current) {
          setError(`Failed to initialize: ${e}`);
          setLoading(false);
        }
      }
    };

    // Check if script already loaded
    const existingScript = document.querySelector(`script[src="${scriptUrl}"]`);
    
    if (existingScript && window.DocsAPI) {
      console.log('Script already loaded');
      setLoading(false);
      setTimeout(initEditor, 100);
    } else {
      // Load script
      script = document.createElement('script');
      script.src = scriptUrl;
      script.async = true;
      
      script.onload = () => {
        console.log('✅ Script loaded');
        if (isMountedRef.current) {
          setLoading(false);
          setTimeout(initEditor, 100);
        }
      };

      script.onerror = () => {
        console.error('❌ Failed to load script');
        if (isMountedRef.current) {
          setError('Failed to load OnlyOffice. Ensure it is running.');
          setLoading(false);
        }
      };

      document.head.appendChild(script);
    }

    // Cleanup function
    return () => {
      if (cleanupDoneRef.current) return;
      cleanupDoneRef.current = true;

      console.log('Cleanup starting...');
      
      // Destroy editor first
      if (editorRef.current) {
        try {
          editorRef.current.destroyEditor();
          console.log('✅ Editor destroyed');
        } catch (e) {
          console.log('Editor destruction skipped:', e);
        }
        editorRef.current = null;
      }

      // Clear container content manually instead of letting React handle it
      if (containerRef.current) {
        try {
          // Remove all child nodes manually to prevent React removal conflicts
          while (containerRef.current.firstChild) {
            containerRef.current.removeChild(containerRef.current.firstChild);
          }
          console.log('✅ Container cleared');
        } catch (e) {
          console.log('Container cleanup skipped:', e);
        }
      }

      // Don't remove the script - leave it for reuse
    };
  }, [editorConfig]);

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md shadow-lg">
          <h2 className="text-xl font-semibold text-red-800 mb-2">Error Loading Editor</h2>
          <p className="text-red-600 mb-4">{error}</p>
          <div className="text-sm text-red-500 mb-4">
            <p className="font-semibold mb-1">Troubleshooting:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Ensure OnlyOffice is running (port 3600)</li>
              <li>Check backend is accessible (port 3000)</li>
              <li>Verify network connectivity</li>
              <li>Check browser console for details</li>
            </ul>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Close
            </button>
          )}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading {fileName}...</p>
          <p className="text-sm text-gray-500 mt-2">Initializing editor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-white">
      <div className="bg-gray-800 text-white px-4 py-3 flex justify-between items-center shadow-md">
        <h1 className="text-lg font-semibold">{fileName}</h1>
        {onClose && (
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
          >
            Close
          </button>
        )}
      </div>
      {/* Use a ref to prevent React from managing this container's children */}
      <div 
        ref={containerRef}
        className="flex-1" 
        style={{ width: '100%', height: 'calc(100vh - 60px)' }}
        suppressHydrationWarning
      />
    </div>
  );
}