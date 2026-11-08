/**
 * Partner agreement content (DEMO text, to be replaced by the legal team's
 * final version). Every version is immutable; a new version needs a fresh
 * e-sign. The fingerprint of the exact text is stored with each acceptance.
 */

export const AGREEMENT = {
  version: "3.2",
  effective: "1 November 2026",
  deadline: "30 November 2026",
  deadlineIso: "2026-11-30T23:59:59+05:30",
  changes: [
    "Live sessions: gifts share, recording kept 30 days for safety review",
    "Free follow-up questions after paid sessions",
    "Strike policy now includes a 7-day appeal window",
    "TDS under section 194-O shown on monthly statements",
  ],
  clauses: [
    { h: "1. Who we are to each other", p: "You are an independent professional, not an employee of Astrounkle. You decide when you are online and how you answer, within these terms. Astrounkle provides the marketplace, payments, support and technology." },
    { h: "2. Fees and commission", p: "Customers pay per minute at the rate you set within the allowed range. Astrounkle keeps a platform fee shown on your dashboard (currently set by tier or by the admin for your account). Tips are shared 90/10 and live gifts 50/50 in your favour as shown in the panel. Any change to fees is announced at least 15 days in advance." },
    { h: "3. Payouts and taxes", p: "Earnings are held for a dispute window and then paid weekly to your verified account. Astrounkle deducts TDS where the law requires and issues monthly invoices and quarterly certificates. You are responsible for your own income tax and GST, if applicable." },
    { h: "4. Conduct and safety", p: "You will be honest and respectful, will not share or ask for contact details, will not take payments outside Astrounkle, will not scare customers or promise guaranteed results, and will not give medical, legal or financial advice. You will end and report sessions with minors or abusive customers, and follow the self-harm guidance." },
    { h: "5. Customer data and privacy", p: "You get only the data needed for a consultation (first name, birth details, notes you write). You will not copy, store or use it outside the panel. Astrounkle processes personal data under the Digital Personal Data Protection Act, 2023, and you may ask for your own data or its deletion at any time." },
    { h: "6. Content and lives", p: "You own your knowledge. You allow Astrounkle to show your profile, reviews and live sessions inside its apps. Lives are recorded only for safety review and deleted after 30 days unless needed for an open complaint." },
    { h: "7. Strikes, suspension and appeals", p: "Breaking these terms can lead to warnings, strikes, deductions, suspension or removal, as described in the strike policy. Every action shows a reason, and you can appeal within 7 days to a different reviewer." },
    { h: "8. Ending the agreement", p: "You may leave at any time from Privacy & data. Astrounkle may end the agreement for serious or repeated breaches. Earned money is paid out after the hold window, minus valid refunds." },
    { h: "9. Liability", p: "Neither side is liable for indirect losses. Astrounkle's total liability is limited to the platform fees you paid in the last 3 months, except where the law does not allow a limit." },
    { h: "10. Law and disputes", p: "Indian law applies. Disputes are first raised through support, then mediation, then the courts at Jaipur, Rajasthan." },
    { h: "11. Grievance officer", p: "Grievance Officer, Astrounkle Technologies Pvt. Ltd., grievance@astrounkle.com. We reply within 72 hours and resolve within 15 days." },
  ],
};

export const agreementText = () => [AGREEMENT.version, ...AGREEMENT.clauses.map((c) => `${c.h}\n${c.p}`)].join("\n\n");

/** Short, readable device label from the user agent. */
export function deviceLabel(ua: string) {
  const os = /Android/i.test(ua) ? "Android" : /iPhone|iPad/i.test(ua) ? "iOS" : /Windows/i.test(ua) ? "Windows" : /Mac OS/i.test(ua) ? "macOS" : /Linux/i.test(ua) ? "Linux" : "Unknown OS";
  const br = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser";
  return `${br} on ${os}`;
}
