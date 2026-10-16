import "server-only";

/**
 * Per-request context via AsyncLocalStorage.
 *
 * `handle()` wraps every API call in `runWithContext()`, giving the whole call
 * chain (services, repositories, logger) access to a shared request id and
 * start time — without threading them through every function signature.
 *
 * The request id is echoed back as the `X-Request-Id` response header and
 * attached to every log line, so one request is traceable end-to-end.
 */

import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

export interface RequestContext {
  requestId: string;
  startedAt: number; // performance.now()
  method?: string;
  path?: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

/** Run `fn` within a fresh request context. */
export function runWithContext<T>(
  init: Partial<RequestContext> & { requestId?: string },
  fn: () => Promise<T>,
): Promise<T> {
  const ctx: RequestContext = {
    requestId: init.requestId || randomUUID(),
    startedAt: performance.now(),
    method: init.method,
    path: init.path,
  };
  return storage.run(ctx, fn);
}

/** The current request context, if we're inside one. */
export function getContext(): RequestContext | undefined {
  return storage.getStore();
}

/** The current request id, if any. */
export function getRequestId(): string | undefined {
  return storage.getStore()?.requestId;
}
