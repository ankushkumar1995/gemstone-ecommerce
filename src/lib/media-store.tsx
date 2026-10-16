"use client";

/**
 * Media library store — a central, WordPress-style image library.
 *
 * Uploaded files go to S3 via the admin storage endpoint and the library keeps
 * their REAL, persistent S3 urls (not blob previews). The library metadata is
 * persisted to localStorage so it survives reloads and can be reused across
 * products. (Pasted external urls via `addFromUrl` are also supported.)
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { adminApi } from "@/lib/admin-api";

export interface MediaItem {
  id: string;
  url: string;
  name: string;
  alt: string;
  title: string;
  caption: string;
  description: string;
  /** bytes if known (uploaded), else undefined */
  size?: number;
  width?: number;
  height?: number;
  mime?: string;
  tags: string[];
  createdAt: string;
}

export type MediaPatch = Partial<
  Pick<MediaItem, "alt" | "title" | "caption" | "description" | "tags">
>;

const STORAGE_KEY = "astrounkle-media-library";

interface MediaContextValue {
  items: MediaItem[];
  recentIds: string[];
  addFromUrl: (url: string, name?: string) => MediaItem;
  /**
   * Upload files to S3 and add them to the library. Returns the created items
   * with their FINAL S3 urls (not blob previews). `folder` controls the S3
   * prefix, e.g. "products".
   */
  addFiles: (files: FileList | File[], folder?: string) => Promise<MediaItem[]>;
  /** true while one or more uploads are in flight */
  uploading: boolean;
  /**
   * Pull the REAL objects currently in the S3 bucket into the library, merged
   * with any local metadata (by url). This is what makes "Select from library"
   * show everything that was actually uploaded — from any device/session.
   */
  syncFromS3: () => Promise<void>;
  /** true while an S3 sync is in flight */
  syncing: boolean;
  remove: (id: string) => void;
  removeMany: (ids: string[]) => void;
  update: (id: string, patch: MediaPatch) => void;
  /** replace an item's image (uploads to S3, keeps the same id/metadata) */
  replace: (id: string, file: File) => Promise<void>;
  replaceFromUrl: (id: string, url: string) => void;
  /** mark an item as recently used */
  touch: (id: string) => void;
  getByUrl: (url: string) => MediaItem | undefined;
  /** all unique tags across the library */
  allTags: string[];
}

const MediaContext = createContext<MediaContextValue | null>(null);

function seedItem(partial: Pick<MediaItem, "id" | "url" | "name" | "alt"> & Partial<MediaItem>): MediaItem {
  return {
    title: partial.name.replace(/\.[^.]+$/, ""),
    caption: "",
    description: "",
    width: 900,
    height: 900,
    mime: "image/jpeg",
    tags: [],
    createdAt: new Date().toISOString(),
    ...partial,
  };
}

const SEED: MediaItem[] = [
  seedItem({
    id: "m1",
    url: "https://images.unsplash.com/photo-1611425143678-08fc480cafde?auto=format&fit=crop&w=900&q=80",
    name: "ruby.jpg",
    alt: "Natural ruby gemstone",
  }),
  seedItem({
    id: "m2",
    url: "https://images.unsplash.com/photo-1615655406736-b37c4fabf923?auto=format&fit=crop&w=900&q=80",
    name: "blue-sapphire.jpg",
    alt: "Blue sapphire gemstone",
  }),
  seedItem({
    id: "m3",
    url: "https://images.unsplash.com/photo-1535556116002-6281ff3e9f36?auto=format&fit=crop&w=900&q=80",
    name: "pearl.jpg",
    alt: "Natural pearl",
  }),
];

function newId() {
  return `m_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Derive the S3 object key from a public URL, or null if it isn't one of our
 * bucket URLs (e.g. a pasted external image / Unsplash seed — we never delete
 * those from S3). Key = the path after the host, decoded, e.g. "products/x.jpg".
 */
function s3KeyFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    // our bucket URLs look like <bucket>.s3.<region>.amazonaws.com/<key>
    if (!/\.s3[.-][^/]*\.amazonaws\.com$/i.test(u.hostname)) return null;
    const key = decodeURIComponent(u.pathname.replace(/^\/+/, ""));
    return key || null;
  } catch {
    return null;
  }
}

/** Load an image just to read its natural dimensions (best-effort). */
function detectDimensions(url: string): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(null);
    const img = new window.Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/** Human-readable file size. */
export function formatBytes(bytes?: number): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function MediaProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<MediaItem[]>(SEED);
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* ignore (object URLs won't persist meaningfully, that's expected) */
    }
  }, [items, hydrated]);

  const addFromUrl = useCallback((url: string, name?: string) => {
    const fileName = name ?? url.split("/").pop()?.split("?")[0] ?? "image";
    const item: MediaItem = {
      id: newId(),
      url: url.trim(),
      name: fileName,
      alt: "",
      title: fileName.replace(/\.[^.]+$/, ""),
      caption: "",
      description: "",
      mime: "image/*",
      tags: [],
      createdAt: new Date().toISOString(),
    };
    setItems((prev) => [item, ...prev]);
    // detect dimensions async
    detectDimensions(item.url).then((dim) => {
      if (dim) setItems((prev) => prev.map((m) => (m.id === item.id ? { ...m, ...dim } : m)));
    });
    return item;
  }, []);

  const addFiles = useCallback(async (files: FileList | File[], folder = "media") => {
    // Accept images AND videos (gallery = images, product media = both).
    const arr = Array.from(files).filter(
      (f) => f.type.startsWith("image/") || f.type.startsWith("video/"),
    );
    if (arr.length === 0) return [];

    setUploading(true);
    try {
      // Upload each file to S3 and build a library item with its REAL url.
      // Videos can be large → upload DIRECTLY to S3 (presigned PUT, bytes skip
      // our server). Images are small → the simple server-proxied upload.
      const results = await Promise.all(
        arr.map(async (f) => {
          const isVideo = f.type.startsWith("video/");
          const res = isVideo
            ? await adminApi.storage.uploadDirect(f, folder)
            : await adminApi.storage.upload(f, folder);
          if (!res.ok) return null;
          const item: MediaItem = {
            id: newId(),
            url: res.data.url, // persistent S3 url — survives reload + is shareable
            name: f.name,
            alt: "",
            title: f.name.replace(/\.[^.]+$/, ""),
            caption: "",
            description: "",
            size: res.data.size || f.size,
            mime: res.data.contentType || f.type,
            tags: [],
            createdAt: new Date().toISOString(),
          };
          return item;
        }),
      );

      const created = results.filter((x): x is MediaItem => x !== null);
      if (created.length) {
        setItems((prev) => [...created, ...prev]);
        // detect dimensions for images (best-effort)
        created
          .filter((m) => (m.mime ?? "").startsWith("image/"))
          .forEach((item) => {
            detectDimensions(item.url).then((dim) => {
              if (dim) setItems((prev) => prev.map((m) => (m.id === item.id ? { ...m, ...dim } : m)));
            });
          });
      }
      return created;
    } finally {
      setUploading(false);
    }
  }, []);

  const syncFromS3 = useCallback(async () => {
    setSyncing(true);
    try {
      // List every known media folder in the bucket in parallel.
      const folders = [
        "products",
        "categories",
        "collections",
        "blog",
        "banners",
        "services",
        "pages",
        "media",
        "misc",
      ];
      const listings = await Promise.all(folders.map((f) => adminApi.storage.list(f)));

      // Flatten S3 objects into a url→object map.
      const s3Objects: Array<{ url: string; name: string; size: number }> = [];
      for (const res of listings) {
        if (res.ok) {
          for (const o of res.data.objects) s3Objects.push({ url: o.url, name: o.name, size: o.size });
        }
      }
      if (s3Objects.length === 0) return;

      setItems((prev) => {
        const byUrl = new Map(prev.map((m) => [m.url, m]));
        for (const o of s3Objects) {
          const existing = byUrl.get(o.url);
          if (existing) {
            // keep local metadata (alt/title/tags), just refresh size/name
            byUrl.set(o.url, { ...existing, name: existing.name || o.name, size: o.size });
          } else {
            const isVideo = /\.(mp4|webm|mov|m4v)$/i.test(o.name);
            byUrl.set(o.url, {
              id: newId(),
              url: o.url,
              name: o.name,
              alt: "",
              title: o.name.replace(/\.[^.]+$/, ""),
              caption: "",
              description: "",
              size: o.size,
              mime: isVideo ? "video/mp4" : "image/*",
              tags: [],
              createdAt: new Date().toISOString(),
            });
          }
        }
        // newest-ish ordering: keep insertion but put S3-known first is overkill;
        // return the merged list.
        return Array.from(byUrl.values());
      });
    } finally {
      setSyncing(false);
    }
  }, []);

  const remove = useCallback(
    (id: string) => {
      // Look up the item BEFORE removing from state so we can delete it on S3.
      setItems((prev) => {
        const target = prev.find((m) => m.id === id);
        const key = target ? s3KeyFromUrl(target.url) : null;
        if (key) void adminApi.storage.remove(key); // best-effort S3 delete
        return prev.filter((m) => m.id !== id);
      });
    },
    [],
  );

  const removeMany = useCallback((ids: string[]) => {
    const set = new Set(ids);
    setItems((prev) => {
      for (const m of prev) {
        if (set.has(m.id)) {
          const key = s3KeyFromUrl(m.url);
          if (key) void adminApi.storage.remove(key);
        }
      }
      return prev.filter((m) => !set.has(m.id));
    });
  }, []);

  const update = useCallback((id: string, patch: MediaPatch) => {
    setItems((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  }, []);

  const replaceFromUrl = useCallback((id: string, url: string) => {
    setItems((prev) => prev.map((m) => (m.id === id ? { ...m, url: url.trim() } : m)));
    detectDimensions(url).then((dim) => {
      if (dim) setItems((prev) => prev.map((m) => (m.id === id ? { ...m, ...dim } : m)));
    });
  }, []);

  const replace = useCallback(async (id: string, file: File) => {
    setUploading(true);
    try {
      const res = await adminApi.storage.upload(file, "media");
      if (!res.ok) return;
      const url = res.data.url; // real S3 url
      setItems((prev) =>
        prev.map((m) =>
          m.id === id
            ? { ...m, url, name: file.name, size: res.data.size || file.size, mime: res.data.contentType || file.type }
            : m,
        ),
      );
      detectDimensions(url).then((dim) => {
        if (dim) setItems((prev) => prev.map((m) => (m.id === id ? { ...m, ...dim } : m)));
      });
    } finally {
      setUploading(false);
    }
  }, []);

  const touch = useCallback((id: string) => {
    setRecentIds((prev) => [id, ...prev.filter((x) => x !== id)].slice(0, 8));
  }, []);

  const value = useMemo<MediaContextValue>(
    () => ({
      items,
      recentIds,
      addFromUrl,
      addFiles,
      uploading,
      syncFromS3,
      syncing,
      remove,
      removeMany,
      update,
      replace,
      replaceFromUrl,
      touch,
      getByUrl: (url) => items.find((m) => m.url === url),
      allTags: Array.from(new Set(items.flatMap((m) => m.tags))).sort(),
    }),
    [items, recentIds, addFromUrl, addFiles, uploading, syncFromS3, syncing, remove, removeMany, update, replace, replaceFromUrl, touch]
  );

  return <MediaContext.Provider value={value}>{children}</MediaContext.Provider>;
}

export function useMedia(): MediaContextValue {
  const ctx = useContext(MediaContext);
  if (!ctx) throw new Error("useMedia must be used within a MediaProvider");
  return ctx;
}
