// src/ui/file-preview.tsx
// Simple file preview: iframe for PDF, img for images, download button for docs.

import { Download, FileText } from "lucide-react";
import { Button } from "@/ui/shadcn/button";

interface FilePreviewProps {
  url: string;
  name: string;
  type?: string;
  className?: string;
}

function inferType(name: string, type?: string): "pdf" | "image" | "doc" {
  const lower = (type || name).toLowerCase();
  if (lower.includes("pdf")) return "pdf";
  if (lower.includes("png") || lower.includes("jpg") || lower.includes("jpeg") || lower.includes("image"))
    return "image";
  return "doc";
}

export function FilePreview({ url, name, type, className = "" }: FilePreviewProps) {
  const fileType = inferType(name, type);

  if (fileType === "pdf") {
    return (
      <div className={`rounded-lg border border-border overflow-hidden ${className}`}>
        <iframe
          src={url}
          title={name}
          className="w-full h-[500px]"
        />
      </div>
    );
  }

  if (fileType === "image") {
    return (
      <div className={`rounded-lg border border-border overflow-hidden ${className}`}>
        <img
          src={url}
          alt={name}
          className="w-full max-h-[500px] object-contain bg-muted/30"
        />
      </div>
    );
  }

  // doc/docx — no inline preview, show download
  return (
    <div className={`rounded-lg border border-border p-6 text-center ${className}`}>
      <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
      <p className="font-medium text-sm mb-1">{name}</p>
      <p className="text-xs text-muted-foreground mb-4">
        This file type cannot be previewed in the browser
      </p>
      <Button variant="outline" size="sm" asChild>
        <a href={url} download={name} target="_blank" rel="noopener noreferrer">
          <Download className="h-4 w-4 mr-2" />
          Download to view
        </a>
      </Button>
    </div>
  );
}
