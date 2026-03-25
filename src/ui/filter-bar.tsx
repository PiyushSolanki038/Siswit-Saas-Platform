// src/ui/filter-bar.tsx
// Filter dropdowns with clear-all button and active filter count badge.

import { Button } from "@/ui/shadcn/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/shadcn/select";
import { SlidersHorizontal, X } from "lucide-react";
import { Badge } from "@/ui/shadcn/badge";

interface FilterConfig {
  key: string;
  label: string;
  options: { label: string; value: string }[];
}

interface FilterBarProps {
  filters: FilterConfig[];
  activeFilters: Record<string, string>;
  onFilterChange: (key: string, value: string) => void;
  onClearAll: () => void;
}

export function FilterBar({
  filters,
  activeFilters,
  onFilterChange,
  onClearAll,
}: FilterBarProps) {
  const activeCount = Object.keys(activeFilters).length;

  if (filters.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground mr-1">
        <SlidersHorizontal className="h-3.5 w-3.5" />
        <span>Filters</span>
        {activeCount > 0 && (
          <Badge variant="secondary" className="h-5 w-5 p-0 justify-center text-[10px]">
            {activeCount}
          </Badge>
        )}
      </div>

      {filters.map((filter) => (
        <Select
          key={filter.key}
          value={activeFilters[filter.key] ?? "all"}
          onValueChange={(v) => onFilterChange(filter.key, v)}
        >
          <SelectTrigger className="h-8 w-auto min-w-[120px] text-xs">
            <SelectValue placeholder={filter.label} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All {filter.label}</SelectItem>
            {filter.options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ))}

      {activeCount > 0 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearAll}
          className="h-8 text-xs text-muted-foreground hover:text-foreground"
        >
          <X className="h-3 w-3 mr-1" />
          Clear All
        </Button>
      )}
    </div>
  );
}
