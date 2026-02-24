import { Modal, Button, Text, Group, Stack, Progress, Badge } from "@mantine/core";
import { IconUpload, IconX, IconFile, IconAlertCircle } from "@tabler/icons-react";
import Dropzone from "@/components/FileUpload";
import { FileTreeItem } from "@/components/FileUpload/types";
import { useState, useCallback } from "react";
import {
  PersistedUpload,
  getUploadProgress,
  removePersistedUpload,
  clearAllPersistedUploads,
} from "../../utils/upload-persistence";

interface ResumeUploadsModalProps {
  opened: boolean;
  onClose: () => void;
  persistedUploads: PersistedUpload[];
  onResumeUploads: (matchedFiles: { file: File; persistedUpload: PersistedUpload }[]) => void;
  onCancelAll: () => void;
}

const ResumeUploadsModal = ({
  opened,
  onClose,
  persistedUploads,
  onResumeUploads,
  onCancelAll,
}: ResumeUploadsModalProps) => {
  const [matchedFiles, setMatchedFiles] = useState<{ file: File; persistedUpload: PersistedUpload }[]>([]);
  const [unmatchedPersisted, setUnmatchedPersisted] = useState<PersistedUpload[]>(persistedUploads);

  const handleDrop = useCallback((files: File[], _tree: FileTreeItem[]) => {
    const newMatches: { file: File; persistedUpload: PersistedUpload }[] = [];
    const stillUnmatched: PersistedUpload[] = [];

    unmatchedPersisted.forEach((pu) => {
      const matchingFile = files.find(f => f.name === pu.fileName && f.size === pu.fileSize);
      if (matchingFile) {
        newMatches.push({ file: matchingFile, persistedUpload: pu });
      } else {
        stillUnmatched.push(pu);
      }
    });

    setMatchedFiles((prev) => [...prev, ...newMatches]);
    setUnmatchedPersisted(stillUnmatched);
  }, [unmatchedPersisted]);

  const handleRemoveMatch = (uploadId: string) => {
    const match = matchedFiles.find(m => m.persistedUpload.uploadId === uploadId);
    if (match) {
      setMatchedFiles(prev => prev.filter(m => m.persistedUpload.uploadId !== uploadId));
      setUnmatchedPersisted(prev => [...prev, match.persistedUpload]);
    }
  };

  const handleRemovePersisted = (uploadId: string) => {
    removePersistedUpload(uploadId);
    setUnmatchedPersisted(prev => prev.filter(p => p.uploadId !== uploadId));
  };

  const handleResumeAll = () => {
    if (matchedFiles.length > 0) {
      onResumeUploads(matchedFiles);
      onClose();
    }
  };

  const handleCancelAll = () => {
    clearAllPersistedUploads();
    onCancelAll();
    onClose();
  };

  const handleSkip = () => {
    onClose();
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  return (
    <Modal
      opened={opened}
      onClose={handleSkip}
      title={
        <Group gap="xs">
          <IconAlertCircle size={20} className="text-amber-500" />
          <Text fw={600}>Resume Incomplete Uploads</Text>
        </Group>
      }
      size="lg"
      centered
    >
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          The following uploads were interrupted. Please re-select the same files to resume uploading from where you left off.
        </Text>

        {/* Unmatched uploads - waiting for file selection */}
        {unmatchedPersisted.length > 0 && (
          <div>
            <Text size="sm" fw={500} mb="xs">
              Waiting for files ({unmatchedPersisted.length}):
            </Text>
            <Stack gap="xs">
              {unmatchedPersisted.map((pu) => (
                <div
                  key={pu.uploadId}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                >
                  <div className="flex items-center gap-2">
                    <IconFile size={18} className="text-gray-400" />
                    <div>
                      <Text size="sm" fw={500}>{pu.fileName}</Text>
                      <Text size="xs" c="dimmed">
                        {formatFileSize(pu.fileSize)} • {getUploadProgress(pu)}% uploaded
                      </Text>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Progress 
                      value={getUploadProgress(pu)} 
                      size="sm" 
                      w={80}
                      color="yellow"
                    />
                    <button
                      onClick={() => handleRemovePersisted(pu.uploadId)}
                      className="p-1 text-gray-400 hover:text-red-500 transition-colors border-none bg-transparent cursor-pointer"
                      title="Remove"
                    >
                      <IconX size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </Stack>
          </div>
        )}

        {/* Matched files - ready to resume */}
        {matchedFiles.length > 0 && (
          <div>
            <Text size="sm" fw={500} mb="xs" c="green">
              Ready to resume ({matchedFiles.length}):
            </Text>
            <Stack gap="xs">
              {matchedFiles.map(({ file, persistedUpload }) => (
                <div
                  key={persistedUpload.uploadId}
                  className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200"
                >
                  <div className="flex items-center gap-2">
                    <IconFile size={18} className="text-green-500" />
                    <div>
                      <Text size="sm" fw={500}>{file.name}</Text>
                      <Text size="xs" c="dimmed">
                        {formatFileSize(file.size)} • Will resume from {getUploadProgress(persistedUpload)}%
                      </Text>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge color="green" size="sm">Matched</Badge>
                    <button
                      onClick={() => handleRemoveMatch(persistedUpload.uploadId)}
                      className="p-1 text-gray-400 hover:text-red-500 transition-colors border-none bg-transparent cursor-pointer"
                      title="Remove"
                    >
                      <IconX size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </Stack>
          </div>
        )}

        {/* File dropzone */}
        {unmatchedPersisted.length > 0 && (
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-blue-400 transition-colors">
            <Dropzone
              maxFiles={50}
              maxSize={1000 * 1024 * 1024}
              onDrop={handleDrop}
              onUpload={() => {}}
              isLoading={false}
            />
          </div>
        )}

        {/* Actions */}
        <Group justify="space-between" mt="md">
          <Button 
            variant="subtle" 
            color="red" 
            onClick={handleCancelAll}
            leftSection={<IconX size={16} />}
          >
            Cancel All
          </Button>
          <Group gap="sm">
            <Button variant="default" onClick={handleSkip}>
              Skip for Now
            </Button>
            <Button
              onClick={handleResumeAll}
              disabled={matchedFiles.length === 0}
              leftSection={<IconUpload size={16} />}
            >
              Resume {matchedFiles.length > 0 ? `(${matchedFiles.length})` : ""}
            </Button>
          </Group>
        </Group>
      </Stack>
    </Modal>
  );
};

export default ResumeUploadsModal;
