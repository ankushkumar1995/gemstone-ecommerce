/**
 * POST /api/v1/webhooks/livekit  (server to server, LiveKit Cloud → us)
 *   Set this URL in LiveKit Cloud → Settings → Webhooks.
 *   Uses: a recorder (egress) that LiveKit ended on its own is cleared at once,
 *   and the astrologer leaving the room turns the stream off, so no recorder
 *   keeps billing. The sweep catches the same cases if a webhook is lost.
 *
 * SECURITY: LiveKit signs every call with our API key/secret (JWT in the
 * Authorization header, with a hash of the raw body). Unsigned or tampered
 * calls get 401. Handlers are idempotent, so retries are safe.
 */
import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/core/http";
import { AppErrors } from "@/core/errors";
import { liveVideoConfigured, receiveWebhook } from "@/core/livekit";
import { onLivekitEvent } from "@/modules/live";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!liveVideoConfigured()) return jsonError(AppErrors.notFound("Not found"));
  const raw = await request.text();
  let ev;
  try {
    ev = await receiveWebhook(raw, request.headers.get("authorization"));
  } catch {
    return jsonError(AppErrors.unauthorized("Invalid webhook signature"));
  }
  try {
    await onLivekitEvent(ev);
  } catch {
    // 500 so LiveKit retries; every handler is safe to run twice.
    return jsonError(AppErrors.internal("Could not handle the event"));
  }
  return jsonOk({ received: true });
}
