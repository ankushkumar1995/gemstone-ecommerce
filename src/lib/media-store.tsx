"use client";

/**
 * Media library store (mock) — a central, WordPress-style image library.
 *
 * Images are kept in a React context and persisted to localStorage, so they
 * survive reloads and can be reused across products. In the mock phase images
 * are stored as URLs (pasted) or object URLs (uploaded previews). Swap the
 * `add` implementation for a real upload (Cloudinary/S3) later — the UI and
 * the rest of the app don't change.
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

const STORAGE_KEY = "nakshatra-media-library";

interface MediaContextValue {
  items: MediaItem[];
  recentIds: string[];
  addFromUrl: (url: string, name?: string) => MediaItem;
  addFiles: (files: FileList | File[]) => MediaItem[];
  remove: (id: string) => void;
  removeMany: (ids: string[]) => void;
  update: (id: string, patch: MediaPatch) => void;
  /** replace an item's image (keeps the same id/metadata) */
  replace: (id: string, file: File) => void;
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

  const addFiles = useCallback((files: FileList | File[]) => {
    const arr = Array.from(files).filter((f) => f.type.startsWith("image/"));
    const created = arr.map<MediaItem>((f) => ({
      id: newId(),
      url: URL.createObjectURL(f),
      name: f.name,
      alt: "",
      title: f.name.replace(/\.[^.]+$/, ""),
      caption: "",
      description: "",
      size: f.size,
      mime: f.type,
      tags: [],
      createdAt: new Date().toISOString(),
    }));
    setItems((prev) => [...created, ...prev]);
    // detect dimensions for each
    created.forEach((item) => {
      detectDimensions(item.url).then((dim) => {
        if (dim) setItems((prev) => prev.map((m) => (m.id === item.id ? { ...m, ...dim } : m)));
      });
    });
    return created;
  }, []);

  const remove = useCallback((id: string) => {
    setItems((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const removeMany = useCallback((ids: string[]) => {
    const set = new Set(ids);
    setItems((prev) => prev.filter((m) => !set.has(m.id)));
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

  const replace = useCallback((id: string, file: File) => {
    const url = URL.createObjectURL(file);
    setItems((prev) =>
      prev.map((m) =>
        m.id === id ? { ...m, url, name: file.name, size: file.size, mime: file.type } : m
      )
    );
    detectDimensions(url).then((dim) => {
      if (dim) setItems((prev) => prev.map((m) => (m.id === id ? { ...m, ...dim } : m)));
    });
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
      remove,
      removeMany,
      update,
      replace,
      replaceFromUrl,
      touch,
      getByUrl: (url) => items.find((m) => m.url === url),
      allTags: Array.from(new Set(items.flatMap((m) => m.tags))).sort(),
    }),
    [items, recentIds, addFromUrl, addFiles, remove, removeMany, update, replace, replaceFromUrl, touch]
  );

  return <MediaContext.Provider value={value}>{children}</MediaContext.Provider>;
}

export function useMedia(): MediaContextValue {
  const ctx = useContext(MediaContext);
  if (!ctx) throw new Error("useMedia must be used within a MediaProvider");
  return ctx;
}
