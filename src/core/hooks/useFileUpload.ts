// src/core/hooks/useFileUpload.ts
// State management hook for file uploads.

import { useState, useCallback } from "react";
import { uploadFile, deleteFile, type UploadResult } from "@/core/utils/upload";

interface UseFileUploadReturn {
  upload: (file: File, organizationId: string) => Promise<UploadResult>;
  deleteUpload: (path: string) => Promise<void>;
  isUploading: boolean;
  progress: number;
  error: string | null;
  reset: () => void;
}

export function useFileUpload(bucket: string): UseFileUploadReturn {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const upload = useCallback(
    async (file: File, organizationId: string): Promise<UploadResult> => {
      setIsUploading(true);
      setProgress(0);
      setError(null);

      try {
        // Simulate progress since Supabase JS doesn't expose upload progress
        setProgress(10);
        const progressInterval = setInterval(() => {
          setProgress((prev) => Math.min(prev + 15, 85));
        }, 200);

        const result = await uploadFile(bucket, organizationId, file);

        clearInterval(progressInterval);
        setProgress(100);

        // Brief delay so user sees 100%
        await new Promise((r) => setTimeout(r, 300));
        setIsUploading(false);

        return result;
      } catch (err) {
        setIsUploading(false);
        setProgress(0);
        const message = err instanceof Error ? err.message : "Upload failed";
        setError(message);
        throw err;
      }
    },
    [bucket],
  );

  const deleteUpload = useCallback(
    async (path: string): Promise<void> => {
      try {
        await deleteFile(bucket, path);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Delete failed";
        setError(message);
        throw err;
      }
    },
    [bucket],
  );

  const reset = useCallback(() => {
    setIsUploading(false);
    setProgress(0);
    setError(null);
  }, []);

  return {
    upload,
    deleteUpload,
    isUploading,
    progress,
    error,
    reset,
  };
}
