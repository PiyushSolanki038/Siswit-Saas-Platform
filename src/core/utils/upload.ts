// src/core/utils/upload.ts
// Supabase Storage upload/delete/validate utilities.

import { supabase } from "@/core/api/client";

/** Result of a successful upload. */
export interface UploadResult {
  url: string;
  path: string;
  size: number;
  name: string;
}

/** Allowed MIME types for upload validation. */
const DEFAULT_ALLOWED_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/png",
  "image/jpeg",
  "image/jpg",
];

const DEFAULT_MAX_SIZE_MB = 50;

/**
 * Validate a file before upload.
 */
export function validateFile(
  file: File,
  options?: { maxSizeMB?: number; allowedTypes?: string[] },
): { valid: boolean; error?: string } {
  const maxSizeMB = options?.maxSizeMB ?? DEFAULT_MAX_SIZE_MB;
  const allowedTypes = options?.allowedTypes ?? DEFAULT_ALLOWED_TYPES;

  if (file.size > maxSizeMB * 1024 * 1024) {
    return { valid: false, error: `File size exceeds ${maxSizeMB}MB limit` };
  }

  if (!allowedTypes.includes(file.type)) {
    const extensions = allowedTypes
      .map((t) => {
        if (t === "application/pdf") return "PDF";
        if (t.includes("msword")) return "DOC";
        if (t.includes("wordprocessingml")) return "DOCX";
        if (t === "image/png") return "PNG";
        if (t.includes("jpeg") || t.includes("jpg")) return "JPG";
        return t;
      })
      .join(", ");
    return { valid: false, error: `File type not allowed. Accepted: ${extensions}` };
  }

  return { valid: true };
}

/**
 * Build the storage path following the pattern:
 * {organization_id}/{timestamp}_{filename}
 */
function buildPath(organizationId: string, fileName: string): string {
  const timestamp = Date.now();
  // Sanitize filename: replace spaces, keep extension
  const sanitized = fileName.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9._-]/g, "");
  return `${organizationId}/${timestamp}_${sanitized}`;
}

/**
 * Upload a file to a Supabase Storage bucket.
 */
export async function uploadFile(
  bucket: string,
  organizationId: string,
  file: File,
): Promise<UploadResult> {
  const validation = validateFile(file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const path = buildPath(organizationId, file.name);

  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type,
    });

  if (error) {
    throw new Error(`Upload failed: ${error.message}`);
  }

  const url = getFileUrl(bucket, path);

  return {
    url,
    path,
    size: file.size,
    name: file.name,
  };
}

/**
 * Delete a file from a Supabase Storage bucket.
 */
export async function deleteFile(bucket: string, path: string): Promise<void> {
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) {
    throw new Error(`Delete failed: ${error.message}`);
  }
}

/**
 * Get the public/signed URL for a file.
 * For private buckets, creates a 1-hour signed URL.
 */
export function getFileUrl(bucket: string, path: string): string {
  const { data } = supabase.storage
    .from(bucket)
    .getPublicUrl(path);

  return data.publicUrl;
}

/**
 * Get a signed (temporary) URL for a private file.
 * Valid for 1 hour (3600 seconds).
 */
export async function getSignedUrl(
  bucket: string,
  path: string,
  expiresInSeconds = 3600,
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresInSeconds);

  if (error || !data?.signedUrl) {
    throw new Error(`Failed to create signed URL: ${error?.message}`);
  }

  return data.signedUrl;
}

/**
 * Format file size for display (e.g. "2.4 MB").
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
