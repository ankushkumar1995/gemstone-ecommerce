"use client";

/**
 * ImagePickerField — a single-image picker used by category/collection forms.
 * No more "paste a URL". The admin can either:
 *   • Upload from their computer (drag & drop or browse) — added to the Media
 *     Library and selected, or
 *   • Pick an existing image from the WordPress-style Media Library.
 *
 * Value is still a URL string (so the data layer is unchanged), but the admin
 * never has to type one.
 */

import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { UploadCloud, X, Images } from "lucide-react";
import { useMedia } from "@/lib/media-store";
import { AdminButton } from "./ui";
import { MediaPickerModal } from "./media-picker";

export function ImagePickerField({
  value,
  onChange,
  aspect = "aspect-[16/9]",
}: {
  value: string;
  onChange: (url: string) => void;
  /** tailwind aspect class for the preview box */
  aspect?: string;
}) {
  const { addFiles } = useMedia();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [dragging, setDragging] = useState(false);

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const [created] = addFiles(files); // uploads to library + returns items
    if (created) onChange(created.url);
  };

  return (
    <div>
      {value ? (
        /* ---- preview with change / remove ---- */
        <div
          className={`group relative ${aspect} w-full overflow-hidden rounded-lg border`}
          style={{ borderColor: "var(--a-border)" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/45 opacity-0 transition-opacity group-hover:opacity-100">
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="rounded-lg bg-white/90 px-3 py-1.5 text-xs font-semibold text-gray-900 hover:bg-white"
            >
              Change
            </button>
            <button
              type="button"
              onClick={() => onChange("")}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/90 text-rose-600 hover:bg-white"
              aria-label="Remove image"
            >
              <X size={15} />
            </button>
          </div>
        </div>
      ) : (
        /* ---- empty: dropzone + library button ---- */
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
            handleFiles(e.dataTransfer.files);
          }}
          className={`flex ${aspect} w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 text-center transition-colors`}
          style={{
            borderColor: dragging ? "var(--a-gold)" : "var(--a-border-strong)",
            background: dragging ? "var(--a-gold-soft)" : "transparent",
          }}
        >
          <motion.span
            animate={{ y: dragging ? -3 : 0 }}
            className="flex h-11 w-11 items-center justify-center rounded-full"
            style={{ background: "var(--a-surface-2)", color: "var(--a-gold)" }}
          >
            <UploadCloud size={22} />
          </motion.span>
          <p className="mt-3 text-sm font-medium" style={{ color: "var(--a-fg)" }}>
            Drag an image or <span className="text-[var(--a-gold)]">browse</span>
          </p>
          <p className="mt-0.5 text-xs" style={{ color: "var(--a-faint)" }}>
            PNG or JPG from your computer
          </p>
        </div>
      )}

      {/* actions row */}
      <div className="mt-2 flex gap-2">
        <AdminButton type="button" variant="outline" className="flex-1" onClick={() => inputRef.current?.click()}>
          <UploadCloud size={15} /> Upload
        </AdminButton>
        <AdminButton type="button" variant="outline" className="flex-1" onClick={() => setPickerOpen(true)}>
          <Images size={15} /> Media Library
        </AdminButton>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => handleFiles(e.target.files)}
      />

      <MediaPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        initialSelected={value ? [value] : []}
        onConfirm={(urls) => {
          if (urls.length) onChange(urls[urls.length - 1]);
        }}
      />
    </div>
  );
}
