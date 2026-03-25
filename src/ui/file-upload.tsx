// src/ui/file-upload.tsx
// Drag & drop file upload component with progress and delete.

import { useCallback, useRef, useState } from "react";
import { Upload, File as FileIcon, X, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/ui/shadcn/button";
import { Progress } from "@/ui/shadcn/progress";
import { useFileUpload } from "@/core/hooks/useFileUpload";
import { validateFile, formatFileSize } from "@/core/utils/upload";
import type { UploadResult } from "@/core/utils/upload";
import { toast } from "sonner";

interface FileUploadProps {
  bucket: string;
  organizationId: string;
  onUploadComplete: (result: UploadResult) => void;
  onUploadError?: (error: string) => void;
  accept?: string;
  maxSizeMB?: number;
  label?: string;
  existingFile?: { name: string; url: string; path?: string } | null;
  onDelete?: () => void;
  disabled?: boolean;
}

export function FileUpload({
  bucket,
  organizationId,
  onUploadComplete,
  onUploadError,
  accept = ".pdf,.doc,.docx,.png,.jpg,.jpeg",
  maxSizeMB = 50,
  label = "Upload file",
  existingFile,
  onDelete,
  disabled = false,
}: FileUploadProps) {
  const { upload, isUploading, progress, error } = useFileUpload(bucket);
  const [isDragOver, setIsDragOver] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const displayError = localError || error;

  const handleFile = useCallback(
    async (file: File) => {
      setLocalError(null);

      const validation = validateFile(file, { maxSizeMB });
      if (!validation.valid) {
        setLocalError(validation.error || "Invalid file");
        onUploadError?.(validation.error || "Invalid file");
        return;
      }

      try {
        const result = await upload(file, organizationId);
        onUploadComplete(result);
        toast.success(`${file.name} uploaded successfully`);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Upload failed";
        setLocalError(message);
        onUploadError?.(message);
        toast.error(message);
      }
    },
    [upload, organizationId, maxSizeMB, onUploadComplete, onUploadError],
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    // Reset input so same file can be re-uploaded
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      if (disabled || isUploading) return;
      const file = e.dataTransfer.files?.[0];
      if (file) handleFile(file);
    },
    [disabled, isUploading, handleFile],
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled && !isUploading) setIsDragOver(true);
  };

  const handleDragLeave = () => setIsDragOver(false);

  // Show existing file with option to delete
  if (existingFile && !isUploading) {
    return (
      <div className="rounded-lg border border-border bg-muted/30 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
              <FileIcon className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="font-medium truncate text-sm">{existingFile.name}</p>
              <a
                href={existingFile.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline"
              >
                View file
              </a>
            </div>
          </div>
          {onDelete && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onDelete}
              className="text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {label && (
        <label className="text-sm font-medium text-foreground">{label}</label>
      )}

      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => !disabled && !isUploading && inputRef.current?.click()}
        className={`
          relative rounded-lg border-2 border-dashed p-6 text-center transition-all cursor-pointer
          ${isDragOver ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/50 hover:bg-muted/30"}
          ${displayError ? "border-destructive bg-destructive/5" : ""}
          ${disabled || isUploading ? "pointer-events-none opacity-50" : ""}
        `}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={handleInputChange}
          className="hidden"
          disabled={disabled || isUploading}
        />

        {isUploading ? (
          <div className="space-y-3">
            <Loader2 className="h-8 w-8 mx-auto text-primary animate-spin" />
            <p className="text-sm font-medium">Uploading...</p>
            <Progress value={progress} className="max-w-xs mx-auto" />
            <p className="text-xs text-muted-foreground">{progress}%</p>
          </div>
        ) : (
          <>
            <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm font-medium">
              Drop file here or <span className="text-primary">browse</span>
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              PDF, DOC, DOCX, PNG, JPG (max {maxSizeMB}MB)
            </p>
          </>
        )}
      </div>

      {displayError && (
        <div className="flex items-center gap-2 text-destructive text-xs">
          <X className="h-3 w-3 shrink-0" />
          <span>{displayError}</span>
        </div>
      )}
    </div>
  );
}
