import "server-only";

/**
 * Expo Push Service client (https://docs.expo.dev/push-notifications/sending-notifications/).
 *   send      POST /--/api/v2/push/send         up to 100 messages per request
 *   receipts  POST /--/api/v2/push/getReceipts  up to 1000 ids per request
 * EXPO_ACCESS_TOKEN (optional) is sent as a Bearer token; turn on "enhanced
 * push security" in the Expo dashboard once it is set, so a leaked device
 * token alone cannot be used to message our users.
 */

export interface ExpoMessage {
  to: string;
  title: string;
  body: string;
  data: Record<string, string>;
  sound?: "default";
  priority?: "default" | "normal" | "high";
  channelId?: string;
  ttl?: number;
  tag?: string;
  collapseId?: string;
  threadId?: string;
  richContent?: { image: string };
}
export interface ExpoTicket { status: "ok" | "error"; id?: string; message?: string; details?: { error?: string } }
export interface ExpoReceipt { status: "ok" | "error"; message?: string; details?: { error?: string } }

export class ExpoHttpError extends Error {
  constructor(public status: number, message: string, public retryable: boolean) { super(message); }
}

const BASE = "https://exp.host/--/api/v2/push";
export const EXPO_TOKEN_RE = /^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]{10,}\]$/;

function headers(): Record<string, string> {
  const h: Record<string, string> = { accept: "application/json", "accept-encoding": "gzip, deflate", "content-type": "application/json" };
  const t = process.env.EXPO_ACCESS_TOKEN?.trim();
  if (t) h.authorization = `Bearer ${t}`;
  return h;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { method: "POST", headers: headers(), body: JSON.stringify(body), signal: AbortSignal.timeout(15_000) });
  } catch (e) {
    throw new ExpoHttpError(0, e instanceof Error ? e.message : "network error", true);
  }
  const json = (await res.json().catch(() => null)) as { data?: unknown; errors?: { code?: string; message?: string }[] } | null;
  if (!res.ok || !json || json.errors?.length) {
    const msg = json?.errors?.map((e) => e.code || e.message).join(", ") || `HTTP ${res.status}`;
    // 429 / TOO_MANY_REQUESTS and server errors: try again later. 4xx otherwise: our request is wrong.
    const retryable = res.status === 429 || res.status >= 500 || /TOO_MANY_REQUESTS/.test(msg);
    throw new ExpoHttpError(res.status, msg, retryable);
  }
  return json.data as T;
}

export interface PushTransport {
  send(messages: ExpoMessage[]): Promise<ExpoTicket[]>;
  receipts(ids: string[]): Promise<Record<string, ExpoReceipt>>;
}

export const expoTransport: PushTransport = {
  async send(messages) {
    const out: ExpoTicket[] = [];
    for (let i = 0; i < messages.length; i += 100) {
      const tickets = await post<ExpoTicket[]>("/send", messages.slice(i, i + 100));
      out.push(...tickets);
    }
    return out;
  },
  async receipts(ids) {
    const out: Record<string, ExpoReceipt> = {};
    for (let i = 0; i < ids.length; i += 1000) Object.assign(out, await post<Record<string, ExpoReceipt>>("/getReceipts", { ids: ids.slice(i, i + 1000) }));
    return out;
  },
};
