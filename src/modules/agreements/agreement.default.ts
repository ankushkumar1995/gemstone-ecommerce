/**
 * First published version of the partner agreement (v3.2). Used by the seed
 * script and by the mock repository so the flow works out of the box.
 *
 * DRAFT LEGAL TEXT: the company's lawyer must review it. To change the text,
 * publish a new version from Admin → Partner Agreements; never edit a
 * published version (its hash is what partners signed).
 */

import type { AgreementClause, AgreementKeyPoint } from "./agreement.types";

export const DEFAULT_AGREEMENT: {
  version: string;
  title: string;
  changes: string[];
  clauses: AgreementClause[];
  keyPoints: AgreementKeyPoint[];
  effectiveFrom: string;
  signDeadline: string;
} = {
  version: "3.2",
  title: "Partner Services Agreement",
  effectiveFrom: "2026-11-01T00:00:00+05:30",
  signDeadline: "2026-11-30T23:59:59+05:30",
  changes: [
    "Live sessions: gifts share, recording kept 30 days for safety review",
    "Free follow-up questions after paid sessions",
    "Strike policy now includes a 7-day appeal window",
    "TDS under section 194-O shown on monthly statements",
  ],
  keyPoints: [
    { id: "kp1", text: "I am an independent professional and set my own hours." },
    { id: "kp2", text: "I will not share contact details or take payments outside Astrounkle." },
    { id: "kp3", text: "I understand fees, the hold window, TDS and the strike policy." },
  ],
  clauses: [
    { id: "c1", heading: "1. Who we are to each other", body: "You are an independent professional, not an employee of Astrounkle. You decide when you are online and how you answer, within these terms. Astrounkle provides the marketplace, payments, support and technology." },
    { id: "c2", heading: "2. Fees and commission", body: "Customers pay per minute at the rate you set within the allowed range. Astrounkle keeps a platform fee shown on your dashboard (currently set by tier or by the admin for your account). Tips are shared 90/10 and live gifts 50/50 in your favour as shown in the panel. Any change to fees is announced at least 15 days in advance." },
    { id: "c3", heading: "3. Payouts and taxes", body: "Earnings are held for a dispute window and then paid weekly to your verified account. Astrounkle deducts TDS where the law requires and issues monthly invoices and quarterly certificates. You are responsible for your own income tax and GST, if applicable." },
    { id: "c4", heading: "4. Conduct and safety", body: "You will be honest and respectful, will not share or ask for contact details, will not take payments outside Astrounkle, will not scare customers or promise guaranteed results, and will not give medical, legal or financial advice. You will end and report sessions with minors or abusive customers, and follow the self-harm guidance." },
    { id: "c5", heading: "5. Customer data and privacy", body: "You get only the data needed for a consultation (first name, birth details, notes you write). You will not copy, store or use it outside the panel. Astrounkle processes personal data under the Digital Personal Data Protection Act, 2023, and you may ask for your own data or its deletion at any time. Records of this agreement and your acceptance are kept as long as the law requires, even after your account is closed." },
    { id: "c6", heading: "6. Content and lives", body: "You own your knowledge. You allow Astrounkle to show your profile, reviews and live sessions inside its apps. Lives are recorded only for safety review and deleted after 30 days unless needed for an open complaint." },
    { id: "c7", heading: "7. Strikes, suspension and appeals", body: "Breaking these terms can lead to warnings, strikes, deductions, suspension or removal, as described in the strike policy. Every action shows a reason, and you can appeal within 7 days to a different reviewer." },
    { id: "c8", heading: "8. Ending the agreement", body: "You may leave at any time from Privacy & data. Astrounkle may end the agreement for serious or repeated breaches. Earned money is paid out after the hold window, minus valid refunds." },
    { id: "c9", heading: "9. Liability", body: "Neither side is liable for indirect losses. Astrounkle's total liability is limited to the platform fees you paid in the last 3 months, except where the law does not allow a limit." },
    { id: "c10", heading: "10. Law and disputes", body: "Indian law applies. Disputes are first raised through support, then mediation, then the courts at Jaipur, Rajasthan." },
    { id: "c11", heading: "11. Grievance officer", body: "Grievance Officer, Astrounkle Technologies Pvt. Ltd., grievance@astrounkle.com. We reply within 72 hours and resolve within 15 days." },
    { id: "c12", heading: "12. How this agreement is accepted", body: "You accept this agreement electronically by typing your full legal name and entering a one-time password sent to your registered mobile number. This creates a valid electronic contract under section 10A of the Information Technology Act, 2000 and the Indian Contract Act, 1872. We keep a record of the version, the time, your typed name, the device, your IP address and a fingerprint of this exact text." },
  ],
};
