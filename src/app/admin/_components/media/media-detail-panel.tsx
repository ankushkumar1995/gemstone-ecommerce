"use client";

/**
 * MediaDetailPanel — right slide-over showing a media item's full preview and
 * editable metadata (alt / title / caption / description), file info, a copy-
 * URL button and delete. Mirrors WordPress's attachment detail panel.
 */

import { motion, AnimatePresence } from "framer-motion";
import { X, Copy, Check, Trash2, RefreshCw, Download, Tag } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useMedia, formatBytes, type MediaItem } from "@/lib/media-store";
import { AdminButton, AdminInput } from "../ui";
import { AdminTextarea } from "../form";

export function MediaDetailPanel({
  item,
  onClose,
  onDelete,
}: {
  item: MediaItem | null;
  onClose: () => void;
  onDelete: (id: string) => void;
}) {
  const { update, replace } = useMedia();
  const [copied, setCopied] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const replaceRef = useRef<HTMLInputElement>(null);

  // local editable fields, synced when a new item opens
  const [fields, setFields] = useState({ alt: "", title: "", caption: "", description: "" });
  const [tags, setTags] = useState<string[]>([]);
  useEffect(() => {
    if (item) {
      setFields({ alt: item.alt, title: item.title, caption: item.caption, description: item.description });
      setTags(item.tags);
    }
  }, [item]);

  const commitTags = (next: string[]) => {
    setTags(next);
    if (item) update(item.id, { tags: next });
  };
  const addTag = () => {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) commitTags([...tags, t]);
    setTagInput("");
  };

  const save = (patch: Partial<typeof fields>) => {
    const next = { ...fields, ...patch };
    setFields(next);
    if (item) update(item.id, patch);
  };

  const copyUrl = async () => {
    if (!item) return;
    try {
      await navigator.clipboard.writeText(item.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  };

  return (
    <AnimatePresence>
      {item && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
          />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 280 }}
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l shadow-2xl"
            style={{ background: "var(--a-surface)", borderColor: "var(--a-border)" }}
          >
            <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: "var(--a-border)" }}>
              <h3 className="text-lg font-semibold" style={{ color: "var(--a-fg)" }}>
                Attachment details
              </h3>
              <button onClick={onClose} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-black/[0.04]" style={{ color: "var(--a-muted)" }}>
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {/* preview */}
              <div className="overflow-hidden rounded-xl border" style={{ borderColor: "var(--a-border)" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.url} alt={item.alt} className="max-h-64 w-full object-contain" style={{ background: "var(--a-surface-2)" }} />
              </div>

              {/* replace + download */}
              <div className="mt-3 flex gap-2">
                <AdminButton variant="outline" className="flex-1" onClick={() => replaceRef.current?.click()}>
                  <RefreshCw size={14} /> Replace
                </AdminButton>
                <a href={item.url} download={item.name} target="_blank" rel="noreferrer" className="flex-1">
                  <AdminButton variant="outline" className="w-full">
                    <Download size={14} /> Download
                  </AdminButton>
                </a>
                <input
                  ref={replaceRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f && item) replace(item.id, f);
                  }}
                />
              </div>

              {/* file info */}
              <div className="mt-4 space-y-1.5 text-sm">
                <InfoRow label="File name" value={item.name} />
                <InfoRow label="Type" value={item.mime ?? "image"} />
                <InfoRow label="Dimensions" value={item.width && item.height ? `${item.width} × ${item.height}` : "—"} />
                <InfoRow label="Size" value={formatBytes(item.size)} />
                <InfoRow label="Uploaded" value={new Date(item.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} />
              </div>

              {/* copy url */}
              <div className="mt-4">
                <label className="mb-1.5 block text-sm font-medium" style={{ color: "var(--a-fg)" }}>
                  File URL
                </label>
                <div className="flex gap-2">
                  <AdminInput readOnly value={item.url} className="text-xs" />
                  <AdminButton variant="outline" onClick={copyUrl}>
                    {copied ? <Check size={15} className="text-emerald-600" /> : <Copy size={15} />}
                  </AdminButton>
                </div>
              </div>

              {/* editable metadata */}
              <div className="mt-5 space-y-4">
                <Labeled label="Alt text">
                  <AdminInput value={fields.alt} onChange={(e) => save({ alt: e.target.value })} placeholder="Describe the image" />
                </Labeled>
                <Labeled label="Title">
                  <AdminInput value={fields.title} onChange={(e) => save({ title: e.target.value })} />
                </Labeled>
                <Labeled label="Caption">
                  <AdminInput value={fields.caption} onChange={(e) => save({ caption: e.target.value })} />
                </Labeled>
                <Labeled label="Description">
                  <AdminTextarea rows={3} value={fields.description} onChange={(e) => save({ description: e.target.value })} />
                </Labeled>

                {/* tags */}
                <div>
                  <span className="mb-1.5 flex items-center gap-1.5 text-sm font-medium" style={{ color: "var(--a-fg)" }}>
                    <Tag size={14} /> Tags
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {tags.map((t) => (
                      <span
                        key={t}
                        className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium"
                        style={{ background: "var(--a-gold-soft)", color: "var(--a-gold)" }}
                      >
                        {t}
                        <button onClick={() => commitTags(tags.filter((x) => x !== t))} aria-label={`Remove ${t}`}>
                          <X size={11} />
                        </button>
                      </span>
                    ))}
                  </div>
                  <AdminInput
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addTag();
                      }
                    }}
                    placeholder="Add a tag and press Enter"
                    className="mt-2"
                  />
                </div>
              </div>
            </div>

            <div className="border-t p-4" style={{ borderColor: "var(--a-border)" }}>
              <AdminButton variant="danger" className="w-full" onClick={() => onDelete(item.id)}>
                <Trash2 size={15} /> Delete permanently
              </AdminButton>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span style={{ color: "var(--a-muted)" }}>{label}</span>
      <span className="max-w-[60%] truncate font-medium" style={{ color: "var(--a-fg)" }}>
        {value}
      </span>
    </div>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium" style={{ color: "var(--a-fg)" }}>
        {label}
      </span>
      {children}
    </label>
  );
}
