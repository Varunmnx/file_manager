import { useEffect, useRef, useState } from 'react';
import { RevisionHistory } from '../RevisionHistory';
import { StorageKeys, loadString } from '@/utils/storage';
import { useNavigate } from 'react-router-dom';
import { 
  Breadcrumbs,  
  Badge, 
  Button, 
  Group, 
  Avatar, 
  Text,
  Paper,
  Box,
  Loader,
  Alert
} from '@mantine/core';
import {  
  IconClock, 
  IconLock, 
  IconHistory,
  IconX,
  IconArrowLeft,
  IconAlertCircle
} from '@tabler/icons-react';

interface OnlyOfficeEditorProps {
  fileId: string;
  fileName: string;
  onClose?: () => void;
  revisionVersion?: number; // If set, view this specific revision in read-only mode
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
  user?: {
    id: string;
    name: string;
    email: string;
  };
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

export default function OnlyOfficeEditor({ fileId, fileName, onClose, revisionVersion }: OnlyOfficeEditorProps) {
  const navigate = useNavigate();
  const [editorConfig, setEditorConfig] = useState<EditorConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string; email: string } | null>(null);
  
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

  // Fetch configuration with authentication
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        console.log('Fetching editor config for fileId:', fileId, 'revision:', revisionVersion);
        
        // Get the auth token
        const token = loadString(StorageKeys.TOKEN);
        
        // Use different endpoint based on whether we're viewing a revision
        const endpoint = revisionVersion
          ? `http://localhost:3000/onlyoffice/revisions/${fileId}/view/${revisionVersion}`
          : `http://localhost:3000/onlyoffice/config/${fileId}`;
        
        const response = await fetch(endpoint, {
          headers: {
            'Authorization': token ? `Bearer ${token}` : '',
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          if (response.status === 401) {
            throw new Error('Please log in to view documents');
          }
          throw new Error('Failed to fetch editor configuration');
        }

        const data = await response.json();
        console.log('Editor config received:', data);
        
        if (isMountedRef.current) {
          setEditorConfig(data);
          if (data.user) {
            setCurrentUser(data.user);
          }
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
  }, [fileId, revisionVersion]);

  // Determine if we're in revision viewing mode
  const isRevisionMode = revisionVersion !== undefined;

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

      // Clear container content manually instead of letting React removal conflicts
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
      <Box className="flex items-center justify-center h-screen p-4">
        <Alert 
          icon={<IconAlertCircle size={20} />} 
          title="Error Loading Editor" 
          color="red"
          variant="filled"
          className="max-w-[500px]"
        >
          <Text size="sm" mb="md">{error}</Text>
          <Text size="xs" mb="xs" fw={600}>Troubleshooting:</Text>
          <Text size="xs" component="ul" className="pl-6">
            <li>Ensure OnlyOffice is running (port 3600)</li>
            <li>Check backend is accessible (port 3000)</li>
            <li>Verify network connectivity</li>
            <li>Check browser console for details</li>
          </Text>
          {onClose && (
            <Button onClick={onClose} color="red" variant="white" mt="md" fullWidth>
              Close
            </Button>
          )}
        </Alert>
      </Box>
    );
  }

  if (loading) {
    return (
      <Box className="flex items-center justify-center h-screen flex-col gap-4">
        <Loader size="lg" />
        <div>
          <Text size="md" fw={500} ta="center">Loading {fileName}...</Text>
          <Text size="sm" c="dimmed" ta="center">Initializing editor...</Text>
        </div>
      </Box>
    );
  }

  return (
    <Box className="h-screen flex flex-col bg-white">
      {/* Office-style Header with Breadcrumb */}
      <Paper shadow="xs" p="xs" className="border-b border-[#e9ecef] rounded-none">
        <Group justify="space-between" align='center' wrap="nowrap">
          {/* Left: Breadcrumb Navigation */}
          <Group gap="xs" className="flex-1 min-w-0">
            <Breadcrumbs 
              separator="›"
              separatorMargin="xs"
              className="flex-nowrap overflow-hidden"
            >

              
              <Text size="sm" fw={600} truncate className="max-w-[300px]">
                {fileName}
              </Text>
              
              {isRevisionMode && (
                <Badge 
                  variant="light" 
                  color="orange" 
                  size="sm"
                  leftSection={<IconClock size={12} />}
                  className="normal-case"
                >
                  Version {revisionVersion}
                </Badge>
              )}
            </Breadcrumbs>
            
            {/* Status Badges */}
            <Group gap="xs">
              {!isRevisionMode && currentUser && (
                <Badge 
                  variant="dot" 
                  color="green" 
                  size="sm"
                  className="normal-case"
                >
                  Editing
                </Badge>
              )}
              
              {isRevisionMode && (
                <Badge 
                  variant="light" 
                  color="gray" 
                  size="sm"
                  leftSection={<IconLock size={12} />}
                  className="normal-case"
                >
                  Read-only
                </Badge>
              )}
            </Group>
          </Group>
          
          {/* Right: Action Buttons */}
          <Group gap="xs" wrap="nowrap">
            {/* User Info */}
            {currentUser && !isRevisionMode && (
              <Group gap="xs" className="py-1 px-3 bg-[#f8f9fa] rounded-md border border-[#e9ecef]">
                <Avatar 
                  size="sm" 
                  color="blue" 
                  radius="xl"
                  className="font-semibold"
                >
                  {currentUser.name.charAt(0).toUpperCase()}
                </Avatar>
                <Text size="xs" fw={500} className="whitespace-nowrap">
                  {currentUser.name}
                </Text>
              </Group>
            )}
            
            {/* Version History Button */}
            {!isRevisionMode && (
              <Button
                variant="default"
                size="sm"
                leftSection={<IconHistory size={16} />}
                onClick={() => setShowHistory(true)}
              >
                Version History
              </Button>
            )}
            
            {/* Close/Back Button */}
            {onClose && (
              <Button
                variant="default"
                size="sm"
                leftSection={isRevisionMode ? <IconArrowLeft size={16} /> : <IconX size={16} />}
                onClick={onClose}
              >
                {isRevisionMode ? 'Back to Current' : 'Close'}
              </Button>
            )}
          </Group>
        </Group>
      </Paper>
      
      {/* Editor Container */}
      <Box 
        ref={containerRef}
        className="flex-1 w-full h-[calc(100vh-60px)]"
        suppressHydrationWarning
      />
      
      {/* Version History Modal */}
      <RevisionHistory
        fileId={fileId}
        isOpen={showHistory}
        onClose={() => setShowHistory(false)}
        onViewRevision={(version) => {
          // Navigate to the revision view page
          navigate(`/document/${fileId}/revision/${version}`);
        }}
      />
    </Box>
  );
}