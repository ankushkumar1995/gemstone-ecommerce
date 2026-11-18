/**
 * /api/v1/astrologers/:id/follow  (customer; `:id` = astrologer id)
 *   GET                               → { following, alerts, followers }
 *   POST { via? }                     → { following: true, followers }  follow (idempotent)
 *   POST { alerts: boolean }          → live alerts on / off for this astrologer (stays following)
 *   DELETE                            → { following: false, followers }
 */
import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonError, jsonOk } from "@/core/http";
import { AppErrors } from "@/core/errors";
import { parse } from "@/core/validation";
import { rateLimit } from "@/core/rate-limit";
import { requireCustomer } from "@/modules/customer-auth";
import { followService } from "@/modules/live";

export const dynamic = "force-dynamic";
const isId = (s: string) => /^[a-f0-9]{24}$/i.test(s);
const schema = z.object({ via: z.string().max(20).optional(), alerts: z.boolean().optional() });

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug: id } = await params;
  if (!isId(id)) return jsonError(AppErrors.notFound("Not found"));
  const g = await requireCustomer().catch(() => null);
  const followers = await followService.count(id);
  if (!g?.ok) return jsonOk({ following: false, alerts: false, followers });
  const mine = (await followService.mine(g.value.customerId)).find((f) => f.astrologerId === id);
  return jsonOk({ following: Boolean(mine), alerts: mine?.alerts ?? false, followers });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const g = await requireCustomer();
  if (!g.ok) return jsonError(g.error);
  const { slug: id } = await params;
  if (!isId(id)) return jsonError(AppErrors.notFound("Not found"));
  if (!rateLimit(`follow:${g.value.customerId}`, { limit: 60, windowSeconds: 600 }).allowed) return jsonError(AppErrors.rateLimited("Please wait a moment."));
  const p = parse(schema, await request.json().catch(() => ({})));
  if (!p.ok) return jsonError(p.error);
  if (typeof p.value.alerts === "boolean") {
    await followService.setAlerts(g.value.customerId, id, p.value.alerts);
    return jsonOk({ following: true, alerts: p.value.alerts, followers: await followService.count(id) });
  }
  const r = await followService.follow(g.value.customerId, id, p.value.via ?? "profile");
  return r.ok ? jsonOk({ ...r.value, alerts: true }) : jsonError(r.error);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const g = await requireCustomer();
  if (!g.ok) return jsonError(g.error);
  const { slug: id } = await params;
  if (!isId(id)) return jsonError(AppErrors.notFound("Not found"));
  return jsonOk({ ...(await followService.unfollow(g.value.customerId, id)), alerts: false });
}
