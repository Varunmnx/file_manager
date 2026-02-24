// Utility functions for persisting incomplete uploads to localStorage
// This allows resuming uploads after browser refresh/close

export interface PersistedUpload {
    uploadId: string;
    fileName: string;
    fileSize: number;
    totalChunks: number;
    uploadedChunks: number[];
    parentId?: string;
    chunkSize: number;
    timestamp: number;
    originalPath: string;
}

const STORAGE_KEY = "incomplete_uploads";
const EXPIRY_HOURS = 24;

/**
 * Get all persisted incomplete uploads
 */
export function getPersistedUploads(): PersistedUpload[] {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        if (!data) return [];

        const uploads: PersistedUpload[] = JSON.parse(data);
        const now = Date.now();
        const expiryMs = EXPIRY_HOURS * 60 * 60 * 1000;

        // Filter out expired uploads (older than 24 hours)
        const validUploads = uploads.filter(u => (now - u.timestamp) < expiryMs);

        // If some were filtered, save the updated list
        if (validUploads.length !== uploads.length) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(validUploads));
        }

        return validUploads;
    } catch (error) {
        console.error("Error reading persisted uploads:", error);
        return [];
    }
}

/**
 * Save an upload to persistence
 */
export function persistUpload(upload: PersistedUpload): void {
    try {
        const uploads = getPersistedUploads();
        const existingIndex = uploads.findIndex(u => u.uploadId === upload.uploadId);

        if (existingIndex >= 0) {
            uploads[existingIndex] = { ...upload, timestamp: Date.now() };
        } else {
            uploads.push({ ...upload, timestamp: Date.now() });
        }

        localStorage.setItem(STORAGE_KEY, JSON.stringify(uploads));
    } catch (error) {
        console.error("Error persisting upload:", error);
    }
}

/**
 * Update the progress of a persisted upload
 */
export function updatePersistedUpload(uploadId: string, uploadedChunks: number[]): void {
    try {
        const uploads = getPersistedUploads();
        const upload = uploads.find(u => u.uploadId === uploadId);

        if (upload) {
            upload.uploadedChunks = uploadedChunks;
            upload.timestamp = Date.now();
            localStorage.setItem(STORAGE_KEY, JSON.stringify(uploads));
        }
    } catch (error) {
        console.error("Error updating persisted upload:", error);
    }
}

/**
 * Remove a completed or cancelled upload from persistence
 */
export function removePersistedUpload(uploadId: string): void {
    try {
        const uploads = getPersistedUploads();
        const filtered = uploads.filter(u => u.uploadId !== uploadId);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    } catch (error) {
        console.error("Error removing persisted upload:", error);
    }
}

/**
 * Clear all persisted uploads
 */
export function clearAllPersistedUploads(): void {
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
        console.error("Error clearing persisted uploads:", error);
    }
}

/**
 * Check if a file matches a persisted upload by name and size
 */
export function matchFileToPersistedUpload(
    file: File,
    persistedUploads: PersistedUpload[]
): PersistedUpload | undefined {
    const fileName = file.name;
    const fileSize = file.size;

    return persistedUploads.find(
        u => u.fileName === fileName && u.fileSize === fileSize
    );
}

/**
 * Format persisted upload for display
 */
export function getUploadProgress(upload: PersistedUpload): number {
    if (upload.totalChunks === 0) return 0;
    return Math.round((upload.uploadedChunks.length / upload.totalChunks) * 100);
}
