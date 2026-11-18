import "server-only";

/**
 * Live console texts for one astrologer.
 *
 *   quickReplies  one tap posts it as their comment. "{name}" becomes the
 *                 viewer they are replying to (or is dropped).
 *   askTemplates  prompts to get viewers talking; one tap posts and pins it.
 *
 * Until the astrologer saves their own list they get the admin defaults
 * (program settings → Live). Saved lists are checked like comments: no bad
 * words, and phone numbers / links are masked.
 */

import { Schema, deleteModel, model, models, type Model } from "mongoose";
import { ok, fail, type Result } from "@/core/result";
import { AppErrors } from "@/core/errors";
import { astroSettingsService } from "@/modules/astro-settings";
import { maskContacts } from "@/modules/consultations/consult.mask";
import { check } from "./live.filter";

type AnyDoc = Record<string, unknown>;

const PrefSchema = new Schema(
  {
    astrologerId: { type: String, required: true, unique: true },
    quickReplies: { type: [String], default: null },
    askTemplates: { type: [String], default: null },
    updatedAt: { type: String, default: null },
  },
  { collection: "live_astro_prefs", versionKey: false },
);
if (process.env.NODE_ENV !== "production" && models.LiveAstroPref) deleteModel("LiveAstroPref");
const PrefModel: Model<AnyDoc> = (models.LiveAstroPref as Model<AnyDoc>) ?? model<AnyDoc>("LiveAstroPref", PrefSchema);

async function db() {
  const { connectMongoose } = await import("@/core/db/mongoose");
  await connectMongoose();
  return PrefModel;
}

export const MAX_TEMPLATES = 12;
export const MAX_TEMPLATE_LEN = 200;

export interface LiveTemplates {
  quickReplies: string[];
  askTemplates: string[];
  /** true when this astrologer saved their own list (else the defaults are shown). */
  custom: { quickReplies: boolean; askTemplates: boolean };
  defaults: { quickReplies: string[]; askTemplates: string[] };
}

function clean(list: string[], blocked: string[], mask: boolean): Result<string[]> {
  const out: string[] = [];
  for (const raw of list) {
    const t = raw.replace(/\s+/g, " ").trim().slice(0, MAX_TEMPLATE_LEN);
    if (t.length < 2) continue;
    if (check(t, blocked).action === "hide") return fail(AppErrors.validation(`Please change "${t.slice(0, 40)}": it has words that are not allowed.`));
    const m = mask ? maskContacts(t).text : t;
    if (!out.some((x) => x.toLowerCase() === m.toLowerCase())) out.push(m);
  }
  return ok(out.slice(0, MAX_TEMPLATES));
}

export const liveTemplates = {
  async get(astrologerId: string): Promise<LiveTemplates> {
    const st = await astroSettingsService.get();
    const P = await db();
    const p = await P.findOne({ astrologerId }).lean<AnyDoc>();
    const qr = Array.isArray(p?.quickReplies) ? (p!.quickReplies as string[]) : null;
    const at = Array.isArray(p?.askTemplates) ? (p!.askTemplates as string[]) : null;
    return {
      quickReplies: qr ?? st.live.quickReplies,
      askTemplates: at ?? st.live.askTemplates,
      custom: { quickReplies: qr !== null, askTemplates: at !== null },
      defaults: { quickReplies: st.live.quickReplies, askTemplates: st.live.askTemplates },
    };
  },

  /** Save one or both lists. `null` = go back to the defaults. */
  async save(astrologerId: string, input: { quickReplies?: string[] | null; askTemplates?: string[] | null }): Promise<Result<LiveTemplates>> {
    const st = await astroSettingsService.get();
    const set: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    for (const k of ["quickReplies", "askTemplates"] as const) {
      const v = input[k];
      if (v === undefined) continue;
      if (v === null) { set[k] = null; continue; }
      const c = clean(v, st.live.blockedWords, st.maskContactInfo);
      if (!c.ok) return fail(c.error);
      set[k] = c.value;
    }
    const P = await db();
    await P.updateOne({ astrologerId }, { $set: set }, { upsert: true });
    return ok(await this.get(astrologerId));
  },
};
