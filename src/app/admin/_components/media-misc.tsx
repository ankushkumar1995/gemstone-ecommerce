"use client";

/**
 * ImageUpload (dropzone), FileList, Timeline, InlineEdit — richer admin
 * building blocks for product forms, order detail and activity views.
 */

import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  UploadCloud,
  X,
  FileText,
  Download,
  Check,
  Pencil,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ---------------- ImageUpload (drag & drop + preview) ---------------- */
export function ImageUpload({
  value = [],
  onChange,
  max = 6,
}: {
  value?: string[];
  onChange?: (urls: string[]) => void;
  max?: number;
}) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const urls = Array.from(files)
      .slice(0, max - value.length)
      .map((f) => URL.createObjectURL(f));
    onChange?.([...value, ...urls]);
  };

  const remove = (url: string) => onChange?.(value.filter((u) => u !== url));

  return (
    <div>
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          addFiles(e.dataTransfer.files);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors",
          dragging ? "border-[var(--a-gold)] bg-[var(--a-gold-soft)]" : ""
        )}
        style={{ borderColor: dragging ? undefined : "var(--a-border-strong)" }}
      >
        <motion.span
          animate={{ y: dragging ? -4 : 0 }}
          className="flex h-11 w-11 items-center justify-center rounded-full"
          style={{ background: "var(--a-surface-2)", color: "var(--a-gold)" }}
        >
          <UploadCloud size={22} />
        </motion.span>
        <p className="mt-3 text-sm font-medium" style={{ color: "var(--a-fg)" }}>
          Drag images here or <span className="text-[var(--a-gold)]">browse</span>
        </p>
        <p className="mt-0.5 text-xs" style={{ color: "var(--a-faint)" }}>
          PNG, JPG up to {max} images
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => addFiles(e.target.files)}
        />
      </div>

      {value.length > 0 && (
        <div className="mt-3 grid grid-cols-4 gap-3 sm:grid-cols-6">
          <AnimatePresence>
            {value.map((url, i) => (
              <motion.div
                key={url}
                layout
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="group relative aspect-square overflow-hidden rounded-lg border"
                style={{ borderColor: "var(--a-border)" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="h-full w-full object-cover" />
                {i === 0 && (
                  <span className="absolute left-1 top-1 rounded bg-[var(--a-gold)] px-1.5 py-0.5 text-[9px] font-bold text-white">
                    Cover
                  </span>
                )}
                <button
                  onClick={() => remove(url)}
                  className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <X size={12} />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

/* ---------------- FileList (attachments) ---------------- */
export function FileList({
  files,
}: {
  files: { name: string; size?: string; href?: string }[];
}) {
  return (
    <div className="space-y-2">
      {files.map((f) => (
        <div
          key={f.name}
          className="flex items-center gap-3 rounded-lg border p-3"
          style={{ borderColor: "var(--a-border)" }}
        >
          <span
            className="flex h-9 w-9 items-center justify-center rounded-lg"
            style={{ background: "var(--a-surface-2)", color: "var(--a-gold)" }}
          >
            <FileText size={17} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium" style={{ color: "var(--a-fg)" }}>
              {f.name}
            </p>
            {f.size && (
              <p className="text-xs" style={{ color: "var(--a-faint)" }}>
                {f.size}
              </p>
            )}
          </div>
          {f.href && (
            <a
              href={f.href}
              className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-black/[0.04]"
              style={{ color: "var(--a-muted)" }}
            >
              <Download size={16} />
            </a>
          )}
        </div>
      ))}
    </div>
  );
}

/* ---------------- Timeline ---------------- */
export function Timeline({
  items,
}: {
  items: { title: string; time: string; done?: boolean }[];
}) {
  return (
    <ol className="relative space-y-5">
      {items.map((it, i) => {
        const last = i === items.length - 1;
        return (
          <li key={i} className="relative flex gap-4">
            {!last && (
              <span
                className="absolute left-[11px] top-6 h-[calc(100%+4px)] w-px"
                style={{ background: it.done ? "var(--a-gold)" : "var(--a-border)" }}
              />
            )}
            <span
              className={cn(
                "relative z-10 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                it.done ? "bg-[var(--a-gold)] text-white" : "border"
              )}
              style={it.done ? undefined : { borderColor: "var(--a-border-strong)", color: "var(--a-faint)" }}
            >
              {it.done ? <Check size={13} /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
            </span>
            <div>
              <p className="text-sm font-medium" style={{ color: "var(--a-fg)" }}>
                {it.title}
              </p>
              <p className="text-xs" style={{ color: "var(--a-faint)" }}>
                {it.time}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/* ---------------- InlineEdit ---------------- */
export function InlineEdit({
  value,
  onSave,
  prefix,
}: {
  value: string;
  onSave: (v: string) => void;
  prefix?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (!editing) {
    return (
      <button
        onClick={() => {
          setDraft(value);
          setEditing(true);
        }}
        className="group inline-flex items-center gap-1.5"
        style={{ color: "var(--a-fg)" }}
      >
        {prefix}
        {value}
        <Pencil
          size={12}
          className="opacity-0 transition-opacity group-hover:opacity-100"
          style={{ color: "var(--a-muted)" }}
        />
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-1">
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            onSave(draft);
            setEditing(false);
          }
          if (e.key === "Escape") setEditing(false);
        }}
        className="w-24 rounded border bg-transparent px-2 py-1 text-sm outline-none focus:border-[var(--a-gold)]"
        style={{ borderColor: "var(--a-border)", color: "var(--a-fg)" }}
      />
      <button
        onClick={() => {
          onSave(draft);
          setEditing(false);
        }}
        className="text-emerald-600"
      >
        <Check size={15} />
      </button>
    </span>
  );
}
