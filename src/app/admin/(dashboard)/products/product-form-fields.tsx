"use client";

/**
 * Small, form-specific field editors for the product form:
 *  - TagInput        — chips + add/Enter, with autocomplete suggestions
 *  - ContentSections — rich PDP tabs (Details / Benefits / Certification…)
 *  - VideosEditor    — video + 360° spin sources
 * Kept together because each is tiny and only used by the product form.
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Plus, Film, Rotate3d, Trash2, Video } from "lucide-react";
import type { ProductContentSection, ProductVideo } from "@/types";
import { AdminInput, AdminTextarea, AdminDropdown } from "@/app/admin/_components";

/* ---------------- TagInput (with autocomplete) ---------------- */
export function TagInput({
  tags,
  onChange,
  suggestions = [],
  placeholder = "Add tag + Enter",
}: {
  tags: string[];
  onChange: (next: string[]) => void;
  suggestions?: string[];
  placeholder?: string;
}) {
  const [input, setInput] = useState("");

  const add = (raw: string) => {
    const t = raw.trim();
    if (t && !tags.includes(t)) onChange([...tags, t]);
    setInput("");
  };

  const matches = input.trim()
    ? suggestions
        .filter((s) => s.toLowerCase().includes(input.toLowerCase()) && !tags.includes(s))
        .slice(0, 6)
    : [];

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        <AnimatePresence>
          {tags.map((t) => (
            <motion.span
              key={t}
              layout
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium"
              style={{ background: "var(--a-gold-soft)", color: "var(--a-gold)" }}
            >
              {t}
              <button type="button" onClick={() => onChange(tags.filter((x) => x !== t))}>
                <X size={11} />
              </button>
            </motion.span>
          ))}
        </AnimatePresence>
      </div>

      <div className="relative mt-2">
        <AdminInput
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add(input);
            }
          }}
          placeholder={placeholder}
        />
        {matches.length > 0 && (
          <div
            className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-lg border shadow-lg"
            style={{ background: "var(--a-surface)", borderColor: "var(--a-border)" }}
          >
            {matches.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => add(m)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-black/[0.04]"
                style={{ color: "var(--a-fg)" }}
              >
                <Plus size={13} style={{ color: "var(--a-gold)" }} />
                {m}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- ContentSections (PDP tabs editor) ---------------- */
const SECTION_PRESETS = ["Details", "Benefits", "Certification", "How to wear", "Care"];

export function ContentSections({
  sections,
  onChange,
}: {
  sections: ProductContentSection[];
  onChange: (next: ProductContentSection[]) => void;
}) {
  const update = (i: number, patch: Partial<ProductContentSection>) =>
    onChange(sections.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));

  const remove = (i: number) => onChange(sections.filter((_, idx) => idx !== i));

  const add = (heading = "Details") =>
    onChange([...sections, { id: `tmp_${Date.now()}`, heading, body: "" }]);

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= sections.length) return;
    const next = [...sections];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <AnimatePresence initial={false}>
        {sections.map((s, i) => (
          <motion.div
            key={s.id}
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97 }}
            className="rounded-lg border p-3"
            style={{ borderColor: "var(--a-border)", background: "var(--a-surface-2)" }}
          >
            <div className="flex items-center gap-2">
              <div className="flex flex-col">
                <button type="button" onClick={() => move(i, -1)} className="text-[10px]" style={{ color: "var(--a-faint)" }} aria-label="Move up">
                  ▲
                </button>
                <button type="button" onClick={() => move(i, 1)} className="text-[10px]" style={{ color: "var(--a-faint)" }} aria-label="Move down">
                  ▼
                </button>
              </div>
              <AdminInput
                value={s.heading}
                onChange={(e) => update(i, { heading: e.target.value })}
                placeholder="Section heading"
                className="flex-1"
              />
              <button
                type="button"
                onClick={() => remove(i)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-rose-600 transition-colors hover:bg-rose-500/10"
                aria-label="Remove section"
              >
                <Trash2 size={15} />
              </button>
            </div>
            <AdminTextarea
              value={s.body}
              onChange={(e) => update(i, { body: e.target.value })}
              rows={3}
              placeholder="Section content…"
              className="mt-2"
            />
          </motion.div>
        ))}
      </AnimatePresence>

      <div className="flex flex-wrap gap-1.5">
        {SECTION_PRESETS.filter((p) => !sections.some((s) => s.heading === p)).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => add(p)}
            className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-black/[0.04]"
            style={{ borderColor: "var(--a-border)", color: "var(--a-fg)" }}
          >
            <Plus size={12} /> {p}
          </button>
        ))}
        <button
          type="button"
          onClick={() => add("")}
          className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-black/[0.04]"
          style={{ borderColor: "var(--a-border)", color: "var(--a-gold)" }}
        >
          <Plus size={12} /> Custom
        </button>
      </div>
    </div>
  );
}

/* ---------------- VideosEditor (video + 360° spin) ---------------- */
export function VideosEditor({
  videos,
  onChange,
}: {
  videos: ProductVideo[];
  onChange: (next: ProductVideo[]) => void;
}) {
  const update = (i: number, patch: Partial<ProductVideo>) =>
    onChange(videos.map((v, idx) => (idx === i ? { ...v, ...patch } : v)));
  const remove = (i: number) => onChange(videos.filter((_, idx) => idx !== i));
  const add = (kind: ProductVideo["kind"]) =>
    onChange([...videos, { id: `tmp_${Date.now()}`, url: "", kind, label: "" }]);

  return (
    <div className="space-y-3">
      <AnimatePresence initial={false}>
        {videos.map((v, i) => (
          <motion.div
            key={v.id}
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97 }}
            className="rounded-lg border p-3"
            style={{ borderColor: "var(--a-border)", background: "var(--a-surface-2)" }}
          >
            <div className="flex items-center gap-2">
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                style={{ background: "var(--a-surface)", color: "var(--a-gold)" }}
              >
                {v.kind === "spin360" ? <Rotate3d size={16} /> : <Video size={16} />}
              </span>
              <div className="w-32 shrink-0">
                <AdminDropdown
                  size="sm"
                  value={v.kind}
                  options={[
                    { value: "video", label: "Video" },
                    { value: "spin360", label: "360° Spin" },
                  ]}
                  onChange={(k) => update(i, { kind: k as ProductVideo["kind"] })}
                  className="w-full"
                />
              </div>
              <button
                type="button"
                onClick={() => remove(i)}
                className="ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-rose-600 transition-colors hover:bg-rose-500/10"
                aria-label="Remove"
              >
                <Trash2 size={15} />
              </button>
            </div>
            <AdminInput
              value={v.url}
              onChange={(e) => update(i, { url: e.target.value })}
              placeholder="https://… (YouTube, MP4 or 360° viewer URL)"
              className="mt-2"
            />
            <AdminInput
              value={v.label ?? ""}
              onChange={(e) => update(i, { label: e.target.value })}
              placeholder="Label (optional)"
              className="mt-2"
            />
          </motion.div>
        ))}
      </AnimatePresence>

      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={() => add("video")}
          className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-black/[0.04]"
          style={{ borderColor: "var(--a-border)", color: "var(--a-fg)" }}
        >
          <Film size={12} /> Add video
        </button>
        <button
          type="button"
          onClick={() => add("spin360")}
          className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-black/[0.04]"
          style={{ borderColor: "var(--a-border)", color: "var(--a-fg)" }}
        >
          <Rotate3d size={12} /> Add 360° spin
        </button>
      </div>
    </div>
  );
}
