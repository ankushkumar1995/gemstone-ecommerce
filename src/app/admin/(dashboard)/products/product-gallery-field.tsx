"use client";

/**
 * ProductGalleryField — manages a product's image gallery:
 *  - "Select from library" (MediaPickerModal) + upload
 *  - reorder via drag & drop
 *  - first image = Cover (badge)
 *  - remove, set-as-cover
 * The first url in the array is treated as the product's main image.
 */

import { useRef, useState } from "react";
import { motion, AnimatePresence, Reorder } from "framer-motion";
import { ImagePlus, UploadCloud, Star, X } from "lucide-react";
import { useMedia } from "@/lib/media-store";
import { AdminButton, MediaPickerModal } from "../../_components";

export function ProductGalleryField({
  images,
  onChange,
}: {
  images: string[];
  onChange: (urls: string[]) => void;
}) {
  const { addFiles } = useMedia();
  const [pickerOpen, setPickerOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const remove = (url: string) => onChange(images.filter((u) => u !== url));
  const setCover = (url: string) => onChange([url, ...images.filter((u) => u !== url)]);

  return (
    <div>
      {/* actions */}
      <div className="mb-3 flex flex-wrap gap-2">
        <AdminButton type="button" onClick={() => setPickerOpen(true)}>
          <ImagePlus size={15} /> Select from library
        </AdminButton>
        <AdminButton type="button" variant="outline" onClick={() => inputRef.current?.click()}>
          <UploadCloud size={15} /> Upload new
        </AdminButton>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files?.length) {
              const added = addFiles(e.target.files);
              onChange([...images, ...added.map((m) => m.url)]);
            }
          }}
        />
      </div>

      {/* gallery */}
      {images.length === 0 ? (
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors hover:border-[var(--a-gold)]"
          style={{ borderColor: "var(--a-border-strong)" }}
        >
          <ImagePlus size={26} style={{ color: "var(--a-muted)" }} />
          <p className="mt-2 text-sm font-medium" style={{ color: "var(--a-fg)" }}>
            Add product images
          </p>
          <p className="mt-0.5 text-xs" style={{ color: "var(--a-faint)" }}>
            Select from library or upload — first image is the cover
          </p>
        </button>
      ) : (
        <Reorder.Group
          axis="x"
          values={images}
          onReorder={onChange}
          className="flex flex-wrap gap-3"
        >
          <AnimatePresence>
            {images.map((url, i) => (
              <Reorder.Item
                key={url}
                value={url}
                className="relative"
                whileDrag={{ scale: 1.06, zIndex: 10 }}
              >
                <div
                  className="group relative h-24 w-24 cursor-grab overflow-hidden rounded-lg border-2 active:cursor-grabbing"
                  style={{ borderColor: i === 0 ? "var(--a-gold)" : "var(--a-border)" }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="h-full w-full object-cover" draggable={false} />

                  {i === 0 && (
                    <span className="absolute left-1 top-1 rounded bg-[var(--a-gold)] px-1.5 py-0.5 text-[9px] font-bold text-white">
                      Cover
                    </span>
                  )}

                  {/* hover actions */}
                  <div className="absolute inset-0 flex items-center justify-center gap-1.5 bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                    {i !== 0 && (
                      <button
                        type="button"
                        onClick={() => setCover(url)}
                        title="Set as cover"
                        className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-white hover:bg-[var(--a-gold)]"
                      >
                        <Star size={13} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => remove(url)}
                      title="Remove"
                      className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-white hover:bg-rose-500"
                    >
                      <X size={13} />
                    </button>
                  </div>
                </div>
              </Reorder.Item>
            ))}
          </AnimatePresence>
        </Reorder.Group>
      )}

      {images.length > 0 && (
        <p className="mt-2 text-xs" style={{ color: "var(--a-faint)" }}>
          Drag to reorder · first image is the cover
        </p>
      )}

      {/* library picker */}
      <MediaPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        initialSelected={images}
        onConfirm={(urls) => onChange(urls)}
      />
    </div>
  );
}
