"use client";

/**
 * MediaLibrary — a WordPress-style media manager.
 *
 * Grid + List views, drag-drop upload (anywhere), add-from-URL, search +
 * type + sort filters, bulk select & delete, and a detail side-panel for
 * editing metadata (alt/title/caption/description), copying the URL and
 * deleting. Selection mode is optional (for pickers).
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  UploadCloud,
  Link2,
  Search,
  LayoutGrid,
  List,
  CheckSquare,
  Trash2,
  Check,
  X,
  Maximize2,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { useMedia, formatBytes, type MediaItem } from "@/lib/media-store";
import { AdminButton, AdminInput } from "../ui";
import { AdminDropdown } from "../dropdown";
import { MediaDetailPanel } from "./media-detail-panel";
import { MediaLightbox } from "./media-lightbox";
import { cn } from "@/lib/utils";

type View = "grid" | "list";
type SortKey = "newest" | "oldest" | "name";

const PAGE = 18; // items per "page" before load-more

function monthKey(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export function MediaLibrary({
  /** picker mode: controlled selection of urls */
  picker = false,
  selected = [],
  onToggleSelect,
}: {
  picker?: boolean;
  selected?: string[];
  onToggleSelect?: (item: MediaItem) => void;
}) {
  const { items, recentIds, addFiles, addFromUrl, remove, removeMany, touch, allTags, uploading, syncFromS3, syncing } = useMedia();

  // Pull the real bucket contents in on mount so the library/picker reflects
  // everything actually uploaded to S3 (not just this browser's local items).
  useEffect(() => {
    syncFromS3();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [view, setView] = useState<View>("grid");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("newest");
  const [dateFilter, setDateFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [showUrl, setShowUrl] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [dragging, setDragging] = useState(false);
  const [detail, setDetail] = useState<MediaItem | null>(null);
  const [lightboxId, setLightboxId] = useState<string | null>(null);
  const [visible, setVisible] = useState(PAGE);

  // bulk-select mode (library only, not picker)
  const [bulkMode, setBulkMode] = useState(false);
  const [bulk, setBulk] = useState<Set<string>>(new Set());

  const inputRef = useRef<HTMLInputElement>(null);

  const dateOptions = useMemo(
    () => Array.from(new Set(items.map((m) => monthKey(m.createdAt)))),
    [items]
  );

  const filtered = useMemo(() => {
    let list = items.filter((m) => {
      const q = query.toLowerCase();
      const matchQ =
        m.name.toLowerCase().includes(q) ||
        m.alt.toLowerCase().includes(q) ||
        m.title.toLowerCase().includes(q);
      const matchDate = !dateFilter || monthKey(m.createdAt) === dateFilter;
      const matchTag = !tagFilter || m.tags.includes(tagFilter);
      return matchQ && matchDate && matchTag;
    });
    if (sort === "newest") list = [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (sort === "oldest") list = [...list].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    if (sort === "name") list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }, [items, query, sort, dateFilter, tagFilter]);

  const paged = filtered.slice(0, visible);
  const recentItems = recentIds
    .map((id) => items.find((m) => m.id === id))
    .filter(Boolean) as MediaItem[];

  const toggleBulk = (id: string) =>
    setBulk((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const handleItemClick = (m: MediaItem) => {
    if (picker) onToggleSelect?.(m);
    else if (bulkMode) toggleBulk(m.id);
    else {
      touch(m.id);
      setDetail(m);
    }
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
      }}
      className="relative"
    >
      {/* drag overlay */}
      <AnimatePresence>
        {dragging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center rounded-xl border-2 border-dashed"
            style={{ borderColor: "var(--a-gold)", background: "var(--a-gold-soft)" }}
          >
            <div className="text-center">
              <UploadCloud size={32} className="mx-auto text-[var(--a-gold)]" />
              <p className="mt-2 font-semibold" style={{ color: "var(--a-gold)" }}>
                Drop images to upload
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[11rem] flex-1 sm:max-w-xs">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--a-muted)" }} />
          <AdminInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search media…" className="pl-9" />
        </div>
        <AdminDropdown
          size="md"
          value={sort}
          options={[
            { value: "newest", label: "Newest" },
            { value: "oldest", label: "Oldest" },
            { value: "name", label: "Name" },
          ]}
          onChange={(v) => setSort(v as SortKey)}
        />
        <AdminDropdown
          size="md"
          label="Date"
          value={dateFilter}
          options={[{ value: "", label: "All dates" }, ...dateOptions.map((d) => ({ value: d, label: d }))]}
          onChange={setDateFilter}
        />
        {allTags.length > 0 && (
          <AdminDropdown
            size="md"
            label="Tag"
            value={tagFilter}
            options={[{ value: "", label: "All tags" }, ...allTags.map((t) => ({ value: t, label: t }))]}
            onChange={setTagFilter}
          />
        )}

        <div className="ml-auto flex items-center gap-1.5">
          {!picker && (
            <AdminButton
              type="button"
              variant={bulkMode ? "primary" : "outline"}
              onClick={() => {
                setBulkMode((v) => !v);
                setBulk(new Set());
              }}
            >
              <CheckSquare size={15} /> Select
            </AdminButton>
          )}
          <AdminButton type="button" variant="outline" onClick={() => setShowUrl((v) => !v)}>
            <Link2 size={15} /> URL
          </AdminButton>
          <AdminButton type="button" variant="outline" disabled={syncing} onClick={() => syncFromS3()} title="Refresh from storage">
            <RefreshCw size={15} className={syncing ? "animate-spin" : ""} />
            {syncing ? "Syncing…" : "Refresh"}
          </AdminButton>
          <AdminButton type="button" disabled={uploading} onClick={() => inputRef.current?.click()}>
            {uploading ? <Loader2 size={15} className="animate-spin" /> : <UploadCloud size={15} />}
            {uploading ? "Uploading…" : "Upload"}
          </AdminButton>
          <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={(e) => e.target.files && addFiles(e.target.files)} />

          {/* view toggle */}
          <div className="flex items-center gap-0.5 rounded-lg border p-0.5" style={{ borderColor: "var(--a-border)" }}>
            {([
              { v: "grid" as View, icon: LayoutGrid },
              { v: "list" as View, icon: List },
            ]).map((o) => (
              <button
                key={o.v}
                type="button"
                onClick={() => setView(o.v)}
                className="relative flex h-8 w-8 items-center justify-center rounded-md"
                style={{ color: view === o.v ? "#fff" : "var(--a-muted)" }}
              >
                {view === o.v && (
                  <motion.span layoutId="media-view" transition={{ type: "spring", stiffness: 380, damping: 30 }} className="absolute inset-0 rounded-md bg-gradient-to-r from-[#e6b43a] to-[#c9942a]" />
                )}
                <o.icon size={15} className="relative z-10" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* url add row */}
      <AnimatePresence>
        {showUrl && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="mt-3 flex gap-2">
              <AdminInput value={urlInput} onChange={(e) => setUrlInput(e.target.value)} placeholder="https://…/image.jpg" />
              <AdminButton
                type="button"
                onClick={() => {
                  if (urlInput.trim()) {
                    addFromUrl(urlInput);
                    setUrlInput("");
                    setShowUrl(false);
                  }
                }}
              >
                Add
              </AdminButton>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* bulk bar */}
      <AnimatePresence>
        {bulkMode && bulk.size > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mt-3 flex items-center gap-3 overflow-hidden rounded-lg px-4 py-2.5"
            style={{ background: "var(--a-gold-soft)" }}
          >
            <span className="text-sm font-medium" style={{ color: "var(--a-fg)" }}>
              {bulk.size} selected
            </span>
            <AdminButton
              type="button"
              variant="danger"
              onClick={() => {
                removeMany([...bulk]);
                setBulk(new Set());
              }}
            >
              <Trash2 size={15} /> Delete
            </AdminButton>
            <button type="button" onClick={() => setBulk(new Set())} className="text-sm font-medium text-[var(--a-muted)] hover:text-[var(--a-fg)]">
              Clear
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* recently used (not in picker, no active filters) */}
      {!picker && recentItems.length > 0 && !query && !dateFilter && !tagFilter && (
        <div className="mt-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--a-faint)" }}>
            Recently used
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {recentItems.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => handleItemClick(m)}
                className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border transition-transform hover:scale-105"
                style={{ borderColor: "var(--a-border)" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={m.url} alt={m.alt} className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* body */}
      <div className="mt-4">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            {syncing ? (
              <>
                <Loader2 size={30} className="animate-spin" style={{ color: "var(--a-gold)" }} />
                <p className="mt-3 font-medium" style={{ color: "var(--a-fg)" }}>
                  Loading media from storage…
                </p>
              </>
            ) : (
              <>
                <UploadCloud size={30} style={{ color: "var(--a-muted)" }} />
                <p className="mt-3 font-medium" style={{ color: "var(--a-fg)" }}>
                  No media found
                </p>
                <p className="mt-1 text-sm" style={{ color: "var(--a-muted)" }}>
                  Drag &amp; drop, upload, or add from URL.
                </p>
              </>
            )}
          </div>
        ) : view === "grid" ? (
          <GridView
            items={paged}
            onClick={handleItemClick}
            onZoom={(m) => setLightboxId(m.id)}
            pickerSelected={selected}
            bulkMode={bulkMode}
            bulkSelected={bulk}
            picker={picker}
          />
        ) : (
          <ListView items={paged} onClick={handleItemClick} />
        )}

        {/* load more */}
        {visible < filtered.length && (
          <div className="mt-5 flex justify-center">
            <AdminButton type="button" variant="outline" onClick={() => setVisible((v) => v + PAGE)}>
              Load more ({filtered.length - visible} left)
            </AdminButton>
          </div>
        )}
      </div>

      {/* detail panel */}
      <MediaDetailPanel
        item={detail}
        onClose={() => setDetail(null)}
        onDelete={(id) => {
          remove(id);
          setDetail(null);
        }}
      />

      {/* lightbox */}
      <MediaLightbox
        items={filtered}
        activeId={lightboxId}
        onClose={() => setLightboxId(null)}
        onNavigate={setLightboxId}
      />
    </div>
  );
}

/* ---------------- Grid view ---------------- */
function GridView({
  items,
  onClick,
  onZoom,
  pickerSelected,
  bulkMode,
  bulkSelected,
  picker,
}: {
  items: MediaItem[];
  onClick: (m: MediaItem) => void;
  onZoom: (m: MediaItem) => void;
  pickerSelected: string[];
  bulkMode: boolean;
  bulkSelected: Set<string>;
  picker: boolean;
}) {
  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
      <AnimatePresence>
        {items.map((m) => {
          const pickSel = pickerSelected.includes(m.url);
          const pickOrder = pickerSelected.indexOf(m.url) + 1;
          const bulkSel = bulkSelected.has(m.id);
          const sel = pickSel || bulkSel;
          return (
            <motion.button
              key={m.id}
              type="button"
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              whileHover={{ y: -2 }}
              onClick={() => onClick(m)}
              className={cn(
                "group relative aspect-square overflow-hidden rounded-lg border-2 transition-colors",
                sel ? "border-[var(--a-gold)]" : "border-transparent hover:border-[var(--a-border-strong)]"
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={m.url} alt={m.alt} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
              {(pickSel || bulkMode) && (
                <span
                  className={cn(
                    "absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold",
                    sel ? "bg-[var(--a-gold)] text-white" : "bg-black/40 text-white"
                  )}
                >
                  {pickSel ? pickOrder : bulkSel ? <Check size={14} /> : ""}
                </span>
              )}
              {/* zoom (not in picker/bulk) */}
              {!picker && !bulkMode && (
                <span
                  role="button"
                  tabIndex={-1}
                  onClick={(e) => {
                    e.stopPropagation();
                    onZoom(m);
                  }}
                  className="absolute left-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/50 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-black/70"
                  aria-label="Preview"
                >
                  <Maximize2 size={12} />
                </span>
              )}
              <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/70 to-transparent px-2 py-1 text-left text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100">
                {m.name}
              </span>
            </motion.button>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

/* ---------------- List view ---------------- */
function ListView({ items, onClick }: { items: MediaItem[]; onClick: (m: MediaItem) => void }) {
  return (
    <div className="overflow-hidden rounded-lg border" style={{ borderColor: "var(--a-border)" }}>
      {items.map((m) => (
        <button
          key={m.id}
          type="button"
          onClick={() => onClick(m)}
          className="flex w-full items-center gap-3 border-b px-3 py-2.5 text-left transition-colors last:border-0 hover:bg-black/[0.025]"
          style={{ borderColor: "var(--a-border)" }}
        >
          <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-md border" style={{ borderColor: "var(--a-border)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={m.url} alt={m.alt} className="h-full w-full object-cover" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium" style={{ color: "var(--a-fg)" }}>
              {m.name}
            </p>
            <p className="text-xs" style={{ color: "var(--a-faint)" }}>
              {m.width && m.height ? `${m.width}×${m.height} · ` : ""}
              {formatBytes(m.size)}
            </p>
          </div>
          <span className="hidden text-xs sm:block" style={{ color: "var(--a-faint)" }}>
            {new Date(m.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
          </span>
        </button>
      ))}
    </div>
  );
}
