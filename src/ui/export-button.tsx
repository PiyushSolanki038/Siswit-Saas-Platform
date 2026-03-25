// src/ui/export-button.tsx
// Reusable dropdown export button for CSV and Excel export.

import { Download, Loader2 } from "lucide-react";
import { Button } from "@/ui/shadcn/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/ui/shadcn/dropdown-menu";
import { exportToCSV, exportToExcel } from "@/core/utils/export";
import { toast } from "sonner";

interface ExportButtonProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any[];
  filename: string;
  sheetName?: string;
  isLoading?: boolean;
  className?: string;
}

export function ExportButton({
  data,
  filename,
  sheetName,
  isLoading,
  className,
}: ExportButtonProps) {
  const rows = data as Record<string, unknown>[];

  const handleCSV = () => {
    if (rows.length === 0) {
      toast.info("No data to export");
      return;
    }
    exportToCSV(rows, filename);
    toast.success(`Exported ${rows.length} rows to CSV`);
  };

  const handleExcel = () => {
    if (rows.length === 0) {
      toast.info("No data to export");
      return;
    }
    exportToExcel(rows, filename, sheetName);
    toast.success(`Exported ${rows.length} rows to Excel`);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className={className} disabled={isLoading}>
          {isLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleCSV}>
          Export CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleExcel}>
          Export Excel (.xlsx)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

