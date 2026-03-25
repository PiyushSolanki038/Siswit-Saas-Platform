// src/ui/search-bar.tsx
// Search input with icon, result count, and clear button.

import { Search, X } from "lucide-react";
import { Input } from "@/ui/shadcn/input";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  resultCount?: number;
  totalCount?: number;
}

export function SearchBar({
  value,
  onChange,
  placeholder = "Search...",
  className = "",
  resultCount,
  totalCount,
}: SearchBarProps) {
  return (
    <div className={`flex items-center gap-3 flex-1 min-w-0 ${className}`}>
      <div className="relative flex-1 min-w-0">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="pl-9 pr-9"
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      {resultCount !== undefined && totalCount !== undefined && (
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          Showing {resultCount} of {totalCount}
        </span>
      )}
    </div>
  );
}
