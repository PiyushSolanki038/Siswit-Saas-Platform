// src/core/utils/export.ts
// CSV and Excel export utilities for module data.

import * as XLSX from "xlsx";

/** Fields stripped from every exported row. */
const EXCLUDED_FIELDS = new Set([
  "id",
  "organization_id",
  "org_id",
  "tenant_id",
  "owner_id",
  "created_by",
  "deleted_at",
  "deleted_by",
  "updated_at",
]);

/**
 * Format a value for human-readable export.
 * - ISO dates → DD/MM/YYYY
 * - null / undefined → empty string
 * - objects → JSON string
 */
function formatValue(value: unknown): string | number | boolean {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value;

  if (typeof value === "string") {
    // ISO-8601 date detection
    const isoDateRegex = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})/;
    if (isoDateRegex.test(value)) {
      const d = new Date(value);
      if (!isNaN(d.getTime())) {
        const day = String(d.getDate()).padStart(2, "0");
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const year = d.getFullYear();
        return `${day}/${month}/${year}`;
      }
    }
    return value;
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}

/**
 * Flatten an object for export — removes excluded fields, formats dates,
 * and converts nested objects to JSON strings.
 */
export function flattenForExport(
  obj: Record<string, unknown>,
): Record<string, string | number | boolean> {
  const result: Record<string, string | number | boolean> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (EXCLUDED_FIELDS.has(key)) continue;
    result[key] = formatValue(value);
  }

  return result;
}

/**
 * Convert column key (snake_case) to a human-readable header.
 */
function toHeaderLabel(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Build clean rows with human-readable headers.
 */
function buildExportRows(
  data: Record<string, unknown>[],
): Record<string, string | number | boolean>[] {
  return data.map((row) => {
    const flat = flattenForExport(row);
    const labeled: Record<string, string | number | boolean> = {};
    for (const [key, value] of Object.entries(flat)) {
      labeled[toHeaderLabel(key)] = value;
    }
    return labeled;
  });
}

/**
 * Trigger a browser download of a Blob.
 */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Export an array of objects to a CSV file and trigger download.
 * Uses native browser APIs — no external library needed.
 */
export function exportToCSV(
  data: Record<string, unknown>[],
  filename: string,
): void {
  if (data.length === 0) return;

  const rows = buildExportRows(data);
  const headers = Object.keys(rows[0]);

  const csvLines: string[] = [headers.join(",")];

  for (const row of rows) {
    const values = headers.map((h) => {
      const val = row[h];
      if (val === undefined || val === null || val === "") return "";
      const str = String(val);
      // Escape values containing commas, quotes, or newlines
      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    });
    csvLines.push(values.join(","));
  }

  const csvString = csvLines.join("\n");
  const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
  downloadBlob(blob, `${filename}.csv`);
}

/**
 * Export an array of objects to an Excel (.xlsx) file and trigger download.
 * Uses SheetJS (xlsx) for proper Excel format.
 */
export function exportToExcel(
  data: Record<string, unknown>[],
  filename: string,
  sheetName = "Sheet1",
): void {
  if (data.length === 0) return;

  const rows = buildExportRows(data);
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  const excelBuffer = XLSX.write(workbook, {
    bookType: "xlsx",
    type: "array",
  });

  const blob = new Blob([excelBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  downloadBlob(blob, `${filename}.xlsx`);
}
