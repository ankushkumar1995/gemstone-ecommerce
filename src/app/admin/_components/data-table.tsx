"use client";

/**
 * DataTable — the production-grade, feature-rich table used by every admin
 * list page (products, orders, customers, reviews…).
 *
 * Features:
 *  - global search across searchable columns
 *  - per-column filters (dropdowns) + active filter chips + clear-all
 *  - sortable columns with clear asc/desc indicators
 *  - pagination + page-size selector + "Showing X–Y of Z"
 *  - row selection (checkbox) + animated bulk-action bar
 *  - per-row action menu (`rowActions`)
 *  - column visibility toggle
 *  - density toggle (comfortable / compact)
 *  - export to CSV
 *  - refresh button
 *  - sticky header, loading skeleton, empty state
 *  - framer-motion row entrance + hover
 *
 * Generic over the row type `T`; pages just pass data + columns.
 */

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  Inbox,
  SlidersHorizontal,
  Columns3,
  Download,
  RefreshCw,
  Rows3,
  Rows4,
  X,
  Check,
  LayoutGrid,
  List,
} from "lucide-react";
import { TableSkeleton } from "./skeleton";
import { AdminDropdown } from "./dropdown";
import { cn } from "@/lib/utils";

export interface Column<T> {
  key: string;
  header: string;
  cell?: (row: T) => React.ReactNode;
  accessor?: (row: T) => string | number;
  sortable?: boolean;
  searchable?: boolean;
  /** show a dropdown filter for this column */
  filterable?: boolean;
  /** fixed filter options; if omitted, derived from data */
  filterOptions?: string[];
  className?: string;
  align?: "left" | "right" | "center";
  /** allow hiding via column-visibility menu (default true) */
  hideable?: boolean;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  getRowId: (row: T) => string;
  loading?: boolean;
  pageSize?: number;
  searchPlaceholder?: string;
  onRowClick?: (row: T) => void;
  rowActions?: (row: T) => React.ReactNode;
  bulkActions?: (selectedIds: string[], clear: () => void) => React.ReactNode;
  emptyTitle?: string;
  emptyMessage?: string;
  onRefresh?: () => void;
  /** csv export filename (without extension); enables export when set */
  exportName?: string;
  /** when provided, a Table/Grid view toggle appears; this renders a card */
  renderGridItem?: (row: T) => React.ReactNode;
}

export function DataTable<T>({
  data,
  columns,
  getRowId,
  loading = false,
  pageSize: initialPageSize = 8,
  searchPlaceholder = "Search…",
  onRowClick,
  rowActions,
  bulkActions,
  emptyTitle = "Nothing here yet",
  emptyMessage = "Data will appear here once available.",
  onRefresh,
  exportName,
  renderGridItem,
}: DataTableProps<T>) {
  const [view, setView] = useState<"table" | "grid">("table");
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [dense, setDense] = useState(false);
  const [colMenu, setColMenu] = useState(false);

  const accessorFor = (col: Column<T>, row: T): string | number => {
    if (col.accessor) return col.accessor(row);
    const v = (row as Record<string, unknown>)[col.key];
    return typeof v === "number" ? v : String(v ?? "");
  };

  const visibleColumns = columns.filter((c) => !hidden.has(c.key));

  // derive filter options per filterable column
  const filterDefs = useMemo(
    () =>
      columns
        .filter((c) => c.filterable)
        .map((c) => ({
          col: c,
          options:
            c.filterOptions ??
            Array.from(new Set(data.map((r) => String(accessorFor(c, r))))).sort(),
        })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [columns, data]
  );

  // search → filters → sort
  const processed = useMemo(() => {
    let rows = [...data];

    const term = query.trim().toLowerCase();
    if (term) {
      const cols = columns.filter((c) => c.searchable);
      rows = rows.filter((row) =>
        cols.some((c) => String(accessorFor(c, row)).toLowerCase().includes(term))
      );
    }

    for (const [key, val] of Object.entries(filters)) {
      if (!val) continue;
      const col = columns.find((c) => c.key === key);
      if (!col) continue;
      rows = rows.filter((r) => String(accessorFor(col, r)) === val);
    }

    if (sortKey) {
      const col = columns.find((c) => c.key === sortKey);
      if (col) {
        rows.sort((a, b) => {
          const av = accessorFor(col, a);
          const bv = accessorFor(col, b);
          if (av < bv) return sortDir === "asc" ? -1 : 1;
          if (av > bv) return sortDir === "asc" ? 1 : -1;
          return 0;
        });
      }
    }
    return rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, query, filters, sortKey, sortDir, columns]);

  const total = processed.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const paged = processed.slice(start, start + pageSize);

  const toggleSort = (col: Column<T>) => {
    if (!col.sortable) return;
    if (sortKey === col.key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(col.key);
      setSortDir("asc");
    }
  };

  const allOnPageSelected = paged.length > 0 && paged.every((r) => selected.has(getRowId(r)));
  const toggleAll = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) paged.forEach((r) => next.delete(getRowId(r)));
      else paged.forEach((r) => next.add(getRowId(r)));
      return next;
    });
  const toggleRow = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const clearSelection = () => setSelected(new Set());
  const selectedIds = [...selected];

  const activeFilterCount = Object.values(filters).filter(Boolean).length;
  const clearFilters = () => {
    setFilters({});
    setQuery("");
    setPage(1);
  };

  const toggleColumn = (key: string) =>
    setHidden((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const exportCsv = () => {
    const cols = visibleColumns;
    const header = cols.map((c) => `"${c.header}"`).join(",");
    const lines = processed.map((row) =>
      cols.map((c) => `"${String(accessorFor(c, row)).replace(/"/g, '""')}"`).join(",")
    );
    const csv = [header, ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${exportName ?? "export"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const cellPad = dense ? "px-4 py-2" : "px-4 py-3.5";

  return (
    <div
      className="overflow-hidden rounded-lg border"
      style={{ background: "var(--a-surface)", borderColor: "var(--a-border)" }}
    >
      {/* ---- toolbar ---- */}
      <div className="flex flex-wrap items-center gap-2 border-b p-4" style={{ borderColor: "var(--a-border)" }}>
        <div className="relative min-w-[12rem] flex-1 sm:max-w-xs">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--a-muted)" }} />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder={searchPlaceholder}
            className="w-full rounded-lg border bg-transparent py-2.5 pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-[var(--a-faint)] focus:border-[var(--a-gold)]"
            style={{ borderColor: "var(--a-border)", color: "var(--a-fg)" }}
          />
        </div>

        {/* per-column filters */}
        {filterDefs.map(({ col, options }) => (
          <AdminDropdown
            key={col.key}
            label={col.header}
            value={filters[col.key] ?? ""}
            options={[{ value: "", label: "All" }, ...options.map((o) => ({ value: o, label: o }))]}
            onChange={(v) => {
              setFilters((f) => ({ ...f, [col.key]: v }));
              setPage(1);
            }}
          />
        ))}

        <div className="ml-auto flex items-center gap-1.5">
          {/* view toggle (only when grid renderer provided) */}
          {renderGridItem && (
            <div
              className="flex items-center gap-0.5 rounded-lg border p-0.5"
              style={{ borderColor: "var(--a-border)" }}
            >
              {([
                { v: "table", icon: List, label: "Table view" },
                { v: "grid", icon: LayoutGrid, label: "Grid view" },
              ] as const).map((o) => (
                <button
                  key={o.v}
                  onClick={() => setView(o.v)}
                  aria-label={o.label}
                  title={o.label}
                  className="relative flex h-8 w-8 items-center justify-center rounded-md"
                  style={{ color: view === o.v ? "#fff" : "var(--a-muted)" }}
                >
                  {view === o.v && (
                    <motion.span
                      layoutId="dt-view-toggle"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                      className="absolute inset-0 rounded-md bg-gradient-to-r from-[#e6b43a] to-[#c9942a]"
                    />
                  )}
                  <o.icon size={15} className="relative z-10" />
                </button>
              ))}
            </div>
          )}
          {onRefresh && (
            <IconBtn label="Refresh" onClick={onRefresh}>
              <RefreshCw size={16} />
            </IconBtn>
          )}
          {view === "table" && (
            <IconBtn label="Density" onClick={() => setDense((d) => !d)}>
              {dense ? <Rows4 size={16} /> : <Rows3 size={16} />}
            </IconBtn>
          )}
          {/* column visibility (table only) */}
          <div className={cn("relative", view === "grid" && "hidden")}>
            <IconBtn label="Columns" onClick={() => setColMenu((v) => !v)}>
              <Columns3 size={16} />
            </IconBtn>
            <AnimatePresence>
              {colMenu && (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => setColMenu(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: 6, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.97 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 z-30 mt-1 w-48 rounded-xl border p-1.5 shadow-xl"
                    style={{ background: "var(--a-surface)", borderColor: "var(--a-border)" }}
                  >
                    <p className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--a-faint)" }}>
                      Toggle columns
                    </p>
                    {columns
                      .filter((c) => c.hideable !== false)
                      .map((c) => (
                        <button
                          key={c.key}
                          onClick={() => toggleColumn(c.key)}
                          className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-sm transition-colors hover:bg-black/[0.04]"
                          style={{ color: "var(--a-fg)" }}
                        >
                          {c.header}
                          <span
                            className={cn(
                              "flex h-4 w-4 items-center justify-center rounded border",
                              !hidden.has(c.key) ? "border-transparent bg-[var(--a-gold)]" : "border-[var(--a-border-strong)]"
                            )}
                          >
                            {!hidden.has(c.key) && <Check size={11} className="text-white" />}
                          </span>
                        </button>
                      ))}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
          {exportName && (
            <IconBtn label="Export CSV" onClick={exportCsv}>
              <Download size={16} />
            </IconBtn>
          )}
          <span className="ml-1 hidden text-sm sm:block" style={{ color: "var(--a-faint)" }}>
            {total} {total === 1 ? "item" : "items"}
          </span>
        </div>
      </div>

      {/* ---- active filter chips ---- */}
      <AnimatePresence>
        {(activeFilterCount > 0 || query) && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="flex flex-wrap items-center gap-2 overflow-hidden border-b px-4 py-2.5"
            style={{ borderColor: "var(--a-border)" }}
          >
            <SlidersHorizontal size={14} style={{ color: "var(--a-faint)" }} />
            {query && (
              <Chip label={`Search: ${query}`} onRemove={() => setQuery("")} />
            )}
            {Object.entries(filters).map(([k, v]) =>
              v ? (
                <Chip
                  key={k}
                  label={`${columns.find((c) => c.key === k)?.header}: ${v}`}
                  onRemove={() => setFilters((f) => ({ ...f, [k]: "" }))}
                />
              ) : null
            )}
            <button onClick={clearFilters} className="text-xs font-medium text-rose-600 hover:underline">
              Clear all
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---- bulk bar ---- */}
      <AnimatePresence>
        {selectedIds.length > 0 && bulkActions && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="flex items-center gap-3 overflow-hidden border-b px-4"
            style={{ borderColor: "var(--a-border)", background: "var(--a-gold-soft)" }}
          >
            <div className="flex items-center gap-3 py-2.5">
              <span className="text-sm font-medium" style={{ color: "var(--a-fg)" }}>
                {selectedIds.length} selected
              </span>
              {bulkActions(selectedIds, clearSelection)}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---- body ---- */}
      {loading ? (
        <div className="p-4">
          <TableSkeleton rows={pageSize} cols={visibleColumns.length + (rowActions ? 1 : 0)} />
        </div>
      ) : total === 0 ? (
        <EmptyState title={emptyTitle} message={emptyMessage} />
      ) : view === "grid" && renderGridItem ? (
        <motion.div
          layout
          className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        >
          <AnimatePresence mode="popLayout">
            {paged.map((row, i) => (
              <motion.div
                key={getRowId(row)}
                layout
                initial={{ opacity: 0, y: 12, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3, delay: i * 0.03 }}
              >
                {renderGridItem(row)}
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 z-10" style={{ background: "var(--a-surface)" }}>
              <tr className="border-b text-xs uppercase tracking-wider" style={{ borderColor: "var(--a-border)", color: "var(--a-faint)" }}>
                {bulkActions && (
                  <th className="w-10 px-4 py-3">
                    <Checkbox checked={allOnPageSelected} onChange={toggleAll} />
                  </th>
                )}
                {visibleColumns.map((col) => (
                  <th
                    key={col.key}
                    className={cn(
                      "px-4 py-3 font-semibold",
                      col.sortable && "cursor-pointer select-none",
                      col.align === "right" && "text-right",
                      col.align === "center" && "text-center"
                    )}
                    onClick={() => toggleSort(col)}
                  >
                    <span className={cn("inline-flex items-center gap-1", col.align === "right" && "flex-row-reverse")}>
                      {col.header}
                      {col.sortable &&
                        (sortKey === col.key ? (
                          sortDir === "asc" ? <ArrowUp size={12} className="text-[var(--a-gold)]" /> : <ArrowDown size={12} className="text-[var(--a-gold)]" />
                        ) : (
                          <ArrowUp size={12} className="opacity-20" />
                        ))}
                    </span>
                  </th>
                ))}
                {rowActions && <th className="w-12 px-4 py-3" />}
              </tr>
            </thead>
            <tbody>
              <AnimatePresence mode="popLayout">
                {paged.map((row, i) => {
                  const id = getRowId(row);
                  const isSel = selected.has(id);
                  return (
                    <motion.tr
                      key={id}
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.22, delay: i * 0.015 }}
                      onClick={() => onRowClick?.(row)}
                      className={cn(
                        "border-b transition-colors last:border-0",
                        onRowClick && "cursor-pointer",
                        isSel ? "bg-[var(--a-gold-soft)]" : "hover:bg-black/[0.025]"
                      )}
                      style={{ borderColor: "var(--a-border)" }}
                    >
                      {bulkActions && (
                        <td className={cellPad} onClick={(e) => e.stopPropagation()}>
                          <Checkbox checked={isSel} onChange={() => toggleRow(id)} />
                        </td>
                      )}
                      {visibleColumns.map((col) => (
                        <td
                          key={col.key}
                          className={cn(cellPad, col.align === "right" && "text-right", col.align === "center" && "text-center", col.className)}
                          style={{ color: "var(--a-fg)" }}
                        >
                          {col.cell ? col.cell(row) : String(accessorFor(col, row))}
                        </td>
                      ))}
                      {rowActions && (
                        <td className={cn(cellPad, "text-right")} onClick={(e) => e.stopPropagation()}>
                          {rowActions(row)}
                        </td>
                      )}
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      )}

      {/* ---- footer: page size + range + pager ---- */}
      {!loading && total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-sm" style={{ borderColor: "var(--a-border)", color: "var(--a-muted)" }}>
          <div className="flex items-center gap-3">
            <span>
              Showing <span style={{ color: "var(--a-fg)" }}>{start + 1}–{Math.min(start + pageSize, total)}</span> of {total}
            </span>
            <AdminDropdown
              size="sm"
              direction="up"
              value={String(pageSize)}
              options={[8, 10, 25, 50].map((n) => ({ value: String(n), label: `${n} / page` }))}
              onChange={(n) => {
                setPageSize(Number(n));
                setPage(1);
              }}
            />
          </div>
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <PagerBtn disabled={safePage === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                <ChevronLeft size={16} />
              </PagerBtn>
              <span className="px-2" style={{ color: "var(--a-fg)" }}>
                {safePage} / {totalPages}
              </span>
              <PagerBtn disabled={safePage === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                <ChevronRight size={16} />
              </PagerBtn>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------------- sub-parts ---------------- */

function IconBtn({
  children,
  label,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex h-9 w-9 items-center justify-center rounded-lg border transition-colors hover:bg-black/[0.04]"
      style={{ borderColor: "var(--a-border)", color: "var(--a-muted)" }}
    >
      {children}
    </button>
  );
}

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium"
      style={{ background: "var(--a-gold-soft)", color: "var(--a-gold)" }}
    >
      {label}
      <button onClick={onRemove} className="hover:opacity-70">
        <X size={12} />
      </button>
    </span>
  );
}

function Checkbox({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      onClick={onChange}
      role="checkbox"
      aria-checked={checked}
      className={cn(
        "flex h-4 w-4 items-center justify-center rounded border transition-colors",
        checked ? "border-transparent bg-[var(--a-gold)]" : "border-[var(--a-border-strong)]"
      )}
    >
      {checked && (
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M1 5l2.5 2.5L9 2" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}

function PagerBtn({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className="flex h-8 w-8 items-center justify-center rounded-lg border transition-colors hover:bg-black/[0.04] disabled:opacity-40"
      style={{ borderColor: "var(--a-border)", color: "var(--a-fg)" }}
      {...props}
    >
      {children}
    </button>
  );
}

export function EmptyState({
  title,
  message,
  icon: Icon = Inbox,
}: {
  title: string;
  message: string;
  icon?: React.ElementType;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <motion.span
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 18 }}
        className="flex h-14 w-14 items-center justify-center rounded-xl"
        style={{ background: "var(--a-surface-2)", color: "var(--a-muted)" }}
      >
        <Icon size={26} />
      </motion.span>
      <p className="mt-4 font-semibold" style={{ color: "var(--a-fg)" }}>
        {title}
      </p>
      <p className="mt-1 max-w-sm text-sm" style={{ color: "var(--a-muted)" }}>
        {message}
      </p>
    </div>
  );
}
