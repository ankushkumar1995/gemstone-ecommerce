import "server-only";

/**
 * Live comment safety filter (no outside service).
 *
 *   • Abuse: Hindi / Hinglish / English insults and slurs, also when written
 *     with tricks (f@ck, ch00t, maaaadar, m.c, spaces between letters). The
 *     admin can add more words in program settings.
 *   • Spam: very long runs of the same letter or emoji are shortened, and a
 *     comment made only of symbols is refused.
 *
 * `check` never throws. It returns what to do:
 *   ok      → post as is (text may be tidied)
 *   hide    → abuse: posted but only the sender sees it (shadow hide), and it
 *             counts as a strike for the viewer
 *   reject  → not posted (empty, symbols only)
 */

/** Built-in words (normalised form, see `norm`). Kept short and specific to avoid hiding normal words. */
const BASE_WORDS = [
  // Hindi / Hinglish
  "madarchod", "maderchod", "madarchot", "mc", "bc", "behenchod", "bhenchod", "bhenchot", "benchod", "bhosdi", "bhosdike", "bhosda", "bhosdiwale",
  "chutiya", "chutiye", "chutia", "chut", "chod", "chodu", "lund", "lauda", "lavda", "lawda", "loda", "gaand", "gand", "gandu", "randi", "raand",
  "harami", "haramkhor", "haramzada", "haramzadi", "kamina", "kamine", "kutta", "kutte", "kutti", "kuttiya", "suar", "saala", "saali", "jhaat", "jhatu",
  "tatti", "bakchod", "bakchodi", "chinal", "hijda", "hijra", "bhadwa", "bhadwe", "dalla", "ullu ka patha",
  // English
  "fuck", "fucker", "fucking", "motherfucker", "shit", "bitch", "bastard", "asshole", "dick", "pussy", "slut", "whore", "cunt", "retard", "nigger", "faggot",
];

const LEET: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "8": "b", "@": "a", "$": "s", "!": "i" };

/** Lower-case, undo leetspeak, drop symbols, squeeze repeated letters (maaaadar → madar). */
export function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[0134578@$!]/g, (c) => LEET[c] ?? c)
    .replace(/[^a-z\u0900-\u097f\s]/g, " ")
    .replace(/(.)\1+/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function words(extra: string[]): { single: Set<string>; phrases: string[] } {
  const all = [...BASE_WORDS, ...extra].map((w) => norm(w)).filter(Boolean);
  return { single: new Set(all.filter((w) => !w.includes(" "))), phrases: all.filter((w) => w.includes(" ")) };
}

/**
 * Words with letters hidden behind symbols: f@ck, f*ck, b!tch, ch*tiya. Each
 * symbol stands for at most one letter. Needs 2+ real letters so "b*" alone is not caught.
 */
function masked(text: string): boolean {
  for (const raw of text.toLowerCase().split(/\s+/)) {
    const w = raw.replace(/[^a-z*@#$%!0-9]/g, "");
    if (!/[*@#$%!0-9]/.test(w) || (w.match(/[a-z]/g)?.length ?? 0) < 2 || w.length > 20) continue;
    const re = new RegExp(`^${w.split("").map((ch) => (/[a-z]/.test(ch) ? ch : "[a-z]?")).join("")}$`);
    for (const word of cached.single) if (word.length >= 3 && re.test(word)) return true;
  }
  return false;
}

let cacheKey = "";
let cached = words([]);

export type FilterResult = { action: "ok" | "hide" | "reject"; text: string; reason?: string };

export function check(text: string, extraWords: string[] = []): FilterResult {
  try {
    const key = extraWords.join("|");
    if (key !== cacheKey) { cached = words(extraWords); cacheKey = key; }
    // Tidy: long runs of one character (letters or emoji) shortened to 3.
    const tidy = Array.from(text).reduce<{ out: string[]; last: string; run: number }>((acc, ch) => {
      if (ch === acc.last) acc.run += 1; else { acc.last = ch; acc.run = 1; }
      if (acc.run <= 3) acc.out.push(ch);
      return acc;
    }, { out: [], last: "", run: 0 }).out.join("").trim();
    if (!/[\p{L}\p{N}\p{Extended_Pictographic}]/u.test(tidy)) return { action: "reject", text: tidy, reason: "Write a comment" };

    const n = norm(tidy);
    const tokens = n.split(" ");
    // Words written with spaces between letters: "m a d a r c h o d".
    const joined = tokens.every((t) => t.length === 1) ? [tokens.join("")] : [];
    const hit = [...tokens, ...joined].some((t) => cached.single.has(t)) || cached.phrases.some((p) => ` ${n} `.includes(` ${p} `)) || masked(tidy);
    return hit ? { action: "hide", text: tidy, reason: "abuse" } : { action: "ok", text: tidy };
  } catch {
    return { action: "ok", text };
  }
}

/** Same comment again (after tidy + normalise) inside the window? */
export function isRepeat(text: string, recent: { t: string; at: string }[], windowMs = 120_000): boolean {
  const n = norm(text);
  if (!n) return false;
  const since = Date.now() - windowMs;
  return recent.some((r) => r.t === n && Date.parse(r.at) >= since);
}
