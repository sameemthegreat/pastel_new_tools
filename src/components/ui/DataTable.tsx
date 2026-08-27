"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ChevronDown, ChevronUp, ChevronsUpDown, Inbox } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

export type Column<T> = {
  key: string;
  header: string;
  render?: (row: T) => ReactNode; // default: String((row as any)[key])
  sortValue?: (row: T) => string | number; // presence makes column sortable
  align?: "left" | "right";
  width?: string; // e.g. "w-40"
};

type SortState = { key: string; dir: "asc" | "desc" };

type DataTableProps<T> = {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  selectable?: boolean;
  selected?: Set<string>;
  onSelectedChange?: (s: Set<string>) => void;
  pageSize?: number;
  emptyTitle?: string;
  emptyDescription?: string;
  footer?: ReactNode;
};

const EMPTY_SELECTION: Set<string> = new Set();

function defaultCell<T>(row: T, key: string): ReactNode {
  const value = (row as Record<string, unknown>)[key];
  return value == null ? "" : String(value);
}

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  onRowClick,
  selectable,
  selected,
  onSelectedChange,
  pageSize = 10,
  emptyTitle,
  emptyDescription,
  footer,
}: DataTableProps<T>) {
  const [sort, setSort] = useState<SortState | null>(null);
  const [page, setPage] = useState(0);
  const headerCheckboxRef = useRef<HTMLInputElement>(null);

  const selectedSet = selected ?? EMPTY_SELECTION;

  // Reset pagination whenever the underlying row set changes size (filtering, mutations).
  // Adjust-state-during-render pattern (react.dev: "you might not need an effect").
  const [prevRowCount, setPrevRowCount] = useState(rows.length);
  if (prevRowCount !== rows.length) {
    setPrevRowCount(rows.length);
    setPage(0);
  }

  const sortedRows = useMemo(() => {
    if (!sort) return rows;
    const column = columns.find((c) => c.key === sort.key);
    const getValue = column?.sortValue;
    if (!getValue) return rows;
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = getValue(a);
      const vb = getValue(b);
      if (typeof va === "number" && typeof vb === "number") {
        return (va - vb) * dir;
      }
      return (
        String(va).localeCompare(String(vb), undefined, {
          numeric: true,
          sensitivity: "base",
        }) * dir
      );
    });
  }, [rows, columns, sort]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const pageStart = safePage * pageSize;
  const pageRows = sortedRows.slice(pageStart, pageStart + pageSize);

  const pageKeys = useMemo(() => pageRows.map(rowKey), [pageRows, rowKey]);
  const selectedOnPage = pageKeys.filter((k) => selectedSet.has(k)).length;
  const allPageSelected =
    pageKeys.length > 0 && selectedOnPage === pageKeys.length;
  const somePageSelected = selectedOnPage > 0 && !allPageSelected;

  useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = somePageSelected;
    }
  }, [somePageSelected]);

  function toggleSort(key: string) {
    setPage(0);
    setSort((prev) =>
      prev && prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" },
    );
  }

  function toggleAll() {
    if (!onSelectedChange) return;
    const next = new Set(selectedSet);
    if (allPageSelected) {
      pageKeys.forEach((k) => next.delete(k));
    } else {
      pageKeys.forEach((k) => next.add(k));
    }
    onSelectedChange(next);
  }

  function toggleRow(key: string) {
    if (!onSelectedChange) return;
    const next = new Set(selectedSet);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    onSelectedChange(next);
  }

  const colCount = columns.length + (selectable ? 1 : 0);
  const showingFrom = sortedRows.length === 0 ? 0 : pageStart + 1;
  const showingTo = Math.min(sortedRows.length, pageStart + pageSize);

  const headerCellBase =
    "sticky top-0 z-10 bg-tile/60 px-4 py-3 text-xs font-medium uppercase tracking-wide text-ink-secondary whitespace-nowrap";

  return (
    <div className="overflow-hidden rounded-2xl border border-hairline bg-surface shadow-xs">
      <div className="overflow-x-auto">
        <table className="w-full min-w-full border-collapse text-left">
          <thead>
            <tr>
              {selectable && (
                <th scope="col" className={cn(headerCellBase, "w-12")}>
                  <input
                    ref={headerCheckboxRef}
                    type="checkbox"
                    aria-label="Select all rows on this page"
                    className="size-4 cursor-pointer rounded accent-brand-500"
                    checked={allPageSelected}
                    onChange={toggleAll}
                  />
                </th>
              )}
              {columns.map((col) => {
                const sortable = Boolean(col.sortValue);
                const isSorted = sort?.key === col.key;
                return (
                  <th
                    key={col.key}
                    scope="col"
                    aria-sort={
                      isSorted
                        ? sort?.dir === "asc"
                          ? "ascending"
                          : "descending"
                        : undefined
                    }
                    className={cn(
                      headerCellBase,
                      col.width,
                      col.align === "right" && "text-right",
                    )}
                  >
                    {sortable ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(col.key)}
                        className={cn(
                          "inline-flex items-center gap-1 uppercase tracking-wide transition-colors hover:text-ink",
                          col.align === "right" && "flex-row-reverse",
                          isSorted && "text-ink",
                        )}
                      >
                        {col.header}
                        {isSorted ? (
                          sort?.dir === "asc" ? (
                            <ChevronUp className="size-3.5" />
                          ) : (
                            <ChevronDown className="size-3.5" />
                          )
                        ) : (
                          <ChevronsUpDown className="size-3.5 text-ink-muted" />
                        )}
                      </button>
                    ) : (
                      col.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr>
                <td colSpan={colCount} className="border-t border-hairline">
                  <div className="py-10">
                    <EmptyState
                      icon={Inbox}
                      title={emptyTitle ?? "Nothing here yet"}
                      description={
                        emptyDescription ??
                        "There are no records matching the current view."
                      }
                    />
                  </div>
                </td>
              </tr>
            ) : (
              pageRows.map((row) => {
                const key = rowKey(row);
                const isSelected = selectedSet.has(key);
                return (
                  <tr
                    key={key}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={cn(
                      "border-t border-hairline text-sm text-ink transition-colors hover:bg-cream/50",
                      onRowClick && "cursor-pointer",
                      isSelected && "bg-brand-50/40",
                    )}
                  >
                    {selectable && (
                      <td
                        className="w-12 px-4 py-3"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          aria-label="Select row"
                          className="size-4 cursor-pointer rounded accent-brand-500"
                          checked={isSelected}
                          onChange={() => toggleRow(key)}
                        />
                      </td>
                    )}
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={cn(
                          "px-4 py-3 align-middle",
                          col.width,
                          col.align === "right" &&
                            "text-right tabular-nums",
                        )}
                      >
                        {col.render
                          ? col.render(row)
                          : defaultCell(row, col.key)}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {(sortedRows.length > 0 || footer) && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline px-4 py-3">
          <p className="text-xs text-ink-secondary">
            {sortedRows.length > 0 ? (
              <>
                Showing{" "}
                <span className="font-medium text-ink">
                  {showingFrom}&ndash;{showingTo}
                </span>{" "}
                of <span className="font-medium text-ink">{sortedRows.length}</span>
              </>
            ) : null}
          </p>
          <div className="flex items-center gap-2">
            {footer}
            {sortedRows.length > 0 && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={safePage === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                >
                  Prev
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={safePage >= totalPages - 1}
                  onClick={() =>
                    setPage((p) => Math.min(totalPages - 1, p + 1))
                  }
                >
                  Next
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
