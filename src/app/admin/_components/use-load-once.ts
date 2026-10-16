"use client";

/**
 * useLoadOnce — run an async loader exactly once on mount, even under React
 * Strict Mode (which deliberately double-mounts components in development and
 * would otherwise fire the fetch twice).
 *
 * A ref guards against the duplicate mount; `reload()` is exposed for manual
 * refreshes (after create/delete, a Refresh button, etc). This keeps every
 * admin list page to a single initial request in both dev and production.
 *
 *   const { loading, reload } = useLoadOnce(async () => {
 *     const res = await adminApi.categories.list();
 *     if (res.ok) setItems(res.data);
 *   });
 */

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * useOnMount — run a callback exactly once on mount, Strict-Mode safe.
 *
 * Drop-in replacement for `useEffect(() => { load(); }, [])` in managers that
 * keep their own `loading`/`load` state. Prevents the duplicate request React
 * Strict Mode causes in development.
 *
 *   useOnMount(load);
 */
export function useOnMount(fn: () => void) {
  const didRun = useRef(false);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  useEffect(() => {
    if (didRun.current) return;
    didRun.current = true;
    fnRef.current();
  }, []);
}

export function useLoadOnce(loader: () => Promise<void>) {
  const [loading, setLoading] = useState(true);
  const didRun = useRef(false);
  // Keep the latest loader without retriggering the mount effect.
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  const run = useCallback(async () => {
    setLoading(true);
    try {
      await loaderRef.current();
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (didRun.current) return; // Strict Mode's second mount is ignored.
    didRun.current = true;
    void run();
  }, [run]);

  return { loading, reload: run };
}
