// src/core/hooks/useSearch.ts
// Generic client-side search + filter hook for module list pages.

import { useState, useMemo, useCallback, useRef, useEffect } from "react";

export interface FilterOption {
  label: string;
  value: string;
}

export interface FilterDefinition {
  key: string;
  label: string;
  options: FilterOption[];
}

/**
 * Custom filter function type for complex filters (e.g. amount ranges).
 * Return true to include the item.
 */
export type CustomFilterFn<T> = (item: T, filterValue: string) => boolean;

interface UseSearchOptions<T> {
  /** Fields to search across (case-insensitive, OR logic between fields) */
  searchFields: (keyof T)[];
  /** Filter definitions for the FilterBar component */
  filterDefs?: FilterDefinition[];
  /** Custom filter functions keyed by filter key */
  customFilters?: Record<string, CustomFilterFn<T>>;
  /** Debounce delay in ms (default 300) */
  debounceMs?: number;
}

interface UseSearchReturn<T> {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  debouncedQuery: string;
  activeFilters: Record<string, string>;
  setFilter: (key: string, value: string) => void;
  clearFilters: () => void;
  filteredData: T[];
  resultCount: number;
  totalCount: number;
  filterDefs: FilterDefinition[];
}

export function useSearch<T>(
  data: T[],
  options: UseSearchOptions<T>,
): UseSearchReturn<T> {
  const {
    searchFields,
    filterDefs = [],
    customFilters = {},
    debounceMs = 300,
  } = options;

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});

  // Debounce search query
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    timerRef.current = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, debounceMs);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [searchQuery, debounceMs]);

  const setFilter = useCallback((key: string, value: string) => {
    setActiveFilters((prev) => {
      if (!value || value === "all") {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return { ...prev, [key]: value };
    });
  }, []);

  const clearFilters = useCallback(() => {
    setActiveFilters({});
    setSearchQuery("");
  }, []);

  const filteredData = useMemo(() => {
    let result = data;

    // Apply search
    if (debouncedQuery.trim()) {
      const q = debouncedQuery.toLowerCase().trim();
      result = result.filter((item) =>
        searchFields.some((field) => {
          const val = item[field];
          if (val === null || val === undefined) return false;
          return String(val).toLowerCase().includes(q);
        }),
      );
    }

    // Apply filters (AND logic between different filters)
    for (const [key, value] of Object.entries(activeFilters)) {
      if (!value || value === "all") continue;

      // Check for custom filter function first
      if (customFilters[key]) {
        result = result.filter((item) => customFilters[key](item, value));
        continue;
      }

      // Default: exact match on the field
      result = result.filter((item) => {
        const fieldVal = (item as Record<string, unknown>)[key];
        if (fieldVal === null || fieldVal === undefined) return false;
        return String(fieldVal).toLowerCase() === value.toLowerCase();
      });
    }

    return result;
  }, [data, debouncedQuery, searchFields, activeFilters, customFilters]);

  return {
    searchQuery,
    setSearchQuery,
    debouncedQuery,
    activeFilters,
    setFilter,
    clearFilters,
    filteredData,
    resultCount: filteredData.length,
    totalCount: data.length,
    filterDefs,
  };
}
