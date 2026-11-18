/**
 * Hide contact details in chat so customers and astrologers stay on the
 * platform (and nobody is pushed into an off-app payment). Phone numbers
 * (also with spaces / dashes), emails, UPI IDs, links and app handles.
 */
const RULES: [RegExp, string][] = [
  [/\b[\w.+-]+@[\w-]+(\.[\w-]+)+\b/g, "[email hidden]"],
  [/\b[\w.-]{2,}@(ok\w+|ybl|ibl|axl|upi|paytm|apl|icici|sbi|hdfcbank|okaxis|oksbi|okicici|okhdfcbank|[a-z]{2,})\b/gi, "[UPI ID hidden]"],
  [/(https?:\/\/|www\.)\S+/gi, "[link hidden]"],
  [/\b[\w-]+\.(com|in|net|org|me|io|co|link|xyz|app)(\/\S*)?\b/gi, "[link hidden]"],
  [/\b(wa\.me|t\.me|telegram|whats\s?app|insta(gram)?|snapchat)\b[^\s]*/gi, "[contact hidden]"],
];

/** 10+ digits in one run (with spaces / dashes): a phone number. Dates (1990-05-12) and times stay. */
const PHONE = /\+?\d[\d\s().-]{8,}\d/g;

export function maskContacts(text: string): { text: string; masked: boolean } {
  let out = text;
  for (const [re, rep] of RULES) out = out.replace(re, rep);
  out = out.replace(PHONE, (m) => (m.replace(/\D/g, "").length >= 10 ? "[number hidden]" : m));
  return { text: out, masked: out !== text };
}
