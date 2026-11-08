/**
 * Partner panel DEMO data.
 *
 * Every page that is not wired to the backend yet reads from here, so the full
 * panel can be reviewed end to end. When a page goes live, swap its import for
 * the real API call and delete the matching block below. Amounts are in rupees.
 */

export type Channel = "chat" | "call" | "video";

export interface MockRequest {
  id: string;
  customer: string;
  customerId: string;
  channel: Channel;
  rate: number;
  question: string;
  walletMinutes: number;
  repeat: boolean;
  birth: { dob: string; time: string; place: string };
}

export interface MockSession {
  id: string;
  customer: string;
  customerId: string;
  channel: Channel;
  startedAt: string;
  minutes: number;
  rate: number;
  gross: number;
  commission: number;
  net: number;
  status: "completed" | "missed" | "rejected" | "refunded" | "cancelled";
  rating?: number;
  topic: string;
  endedBy?: "customer" | "astrologer" | "system" | "admin";
}

export interface MockReview {
  id: string;
  customer: string;
  rating: number;
  text: string;
  at: string;
  channel: Channel;
  reply?: string;
  tags: string[];
}

export interface MockCustomer {
  id: string;
  name: string;
  city: string;
  sessions: number;
  minutes: number;
  spent: number;
  lastAt: string;
  rating?: number;
  sign: string;
  note?: string;
  tags: string[];
}

export interface MockPayout {
  id: string;
  period: string;
  amount: number;
  tds: number;
  status: "paid" | "processing" | "scheduled" | "failed";
  utr?: string;
  at: string;
  method: string;
}

export interface MockNotification {
  id: string;
  kind: "request" | "payout" | "review" | "admin" | "system" | "kyc";
  title: string;
  body: string;
  at: string;
  read: boolean;
}

const now = Date.now();
const ago = (mins: number) => new Date(now - mins * 60_000).toISOString();
const inDays = (d: number, h = 10, m = 0) => {
  const x = new Date(now);
  x.setDate(x.getDate() + d);
  x.setHours(h, m, 0, 0);
  return x.toISOString();
};

const NAMES = ["Riya Sharma", "Amit Verma", "Neha Gupta", "Karan Mehta", "Pooja Singh", "Rahul Yadav", "Sneha Iyer", "Vikas Jain", "Anjali Rao", "Rohit Kapoor", "Megha Das", "Sanjay Patel"];
const TOPICS = ["Career change", "Marriage timing", "Love life", "Health worries", "Business growth", "Foreign travel", "Education", "Property", "Manglik dosha", "Child birth", "Job transfer", "Money stuck"];
const CITIES = ["Delhi", "Mumbai", "Jaipur", "Pune", "Lucknow", "Indore", "Bengaluru", "Patna", "Chandigarh", "Ahmedabad", "Kolkata", "Bhopal"];
const SIGNS = ["Mesha", "Vrishabha", "Mithuna", "Karka", "Simha", "Kanya", "Tula", "Vrischika", "Dhanu", "Makara", "Kumbha", "Meena"];

/** Split a gross amount with the commission % (rounded to paise). */
const split = (gross: number, pct = 40) => {
  const commission = Math.round(gross * pct) / 100;
  return { commission, net: Math.round((gross - commission) * 100) / 100 };
};

export const MOCK_REQUEST_POOL: MockRequest[] = [
  { id: "rq1", customer: "Riya S.", customerId: "c1", channel: "chat", rate: 25, question: "Meri shaadi kab hogi? Ghar wale rishta dekh rahe hain.", walletMinutes: 18, repeat: true, birth: { dob: "1997-03-14", time: "06:42", place: "Jaipur, Rajasthan" } },
  { id: "rq2", customer: "Amit V.", customerId: "c2", channel: "chat", rate: 25, question: "Job change karu ya nahi, 2 offers hain.", walletMinutes: 9, repeat: false, birth: { dob: "1992-11-02", time: "21:10", place: "Lucknow, Uttar Pradesh" } },
  { id: "rq3", customer: "Neha G.", customerId: "c3", channel: "call", rate: 30, question: "Business partner ke saath problem chal rahi hai.", walletMinutes: 24, repeat: true, birth: { dob: "1989-07-28", time: "13:05", place: "Indore, Madhya Pradesh" } },
  { id: "rq4", customer: "Karan M.", customerId: "c4", channel: "chat", rate: 25, question: "Abroad settle hone ka yog hai kya?", walletMinutes: 6, repeat: false, birth: { dob: "1999-01-19", time: "04:30", place: "Chandigarh" } },
];

export const MOCK_SESSIONS: MockSession[] = Array.from({ length: 42 }, (_, i) => {
  const channel: Channel = i % 7 === 0 ? "call" : i % 11 === 0 ? "video" : "chat";
  const rate = channel === "chat" ? 25 : channel === "call" ? 30 : 40;
  const status: MockSession["status"] = i % 13 === 5 ? "missed" : i % 17 === 3 ? "rejected" : i % 19 === 7 ? "refunded" : i % 23 === 9 ? "cancelled" : "completed";
  const minutes = status === "completed" || status === "refunded" ? 4 + ((i * 7) % 26) : 0;
  const gross = minutes * rate;
  const { commission, net } = split(gross);
  return {
    id: `ses_${1040 - i}`,
    customer: NAMES[i % NAMES.length],
    customerId: `c${(i % NAMES.length) + 1}`,
    channel,
    startedAt: ago(i * 190 + 25),
    minutes,
    rate,
    gross,
    commission,
    net: status === "refunded" ? 0 : net,
    status,
    rating: status === "completed" && i % 3 !== 2 ? [5, 5, 4, 5, 3, 4][i % 6] : undefined,
    topic: TOPICS[i % TOPICS.length],
    endedBy: status === "completed" ? (i % 4 === 0 ? "astrologer" : i % 9 === 0 ? "system" : "customer") : status === "refunded" ? "admin" : undefined,
  };
});

export const MOCK_TRANSCRIPT = [
  { from: "customer" as const, text: "Namaste ji, meri shaadi ko lekar bahut tension hai.", at: "10:02" },
  { from: "astrologer" as const, text: "Namaste. Aapki kundli dekh raha hoon. Aapka 7th house Shukra se drishti mein hai.", at: "10:03" },
  { from: "customer" as const, text: "Matlab acha hai ya bura?", at: "10:03" },
  { from: "astrologer" as const, text: "Acha hai. 2026 ke end tak strong yog ban raha hai. Shukrawar ko safed vastu daan karein.", at: "10:05" },
  { from: "customer" as const, text: "Koi stone pehnna chahiye?", at: "10:06" },
  { from: "astrologer" as const, text: "Opal ya Diamond suit karega, par pehle 3 din trial karein.", at: "10:07" },
];

export const MOCK_REVIEWS: MockReview[] = [
  { id: "rv1", customer: "Riya S.", rating: 5, text: "Bahut acchi tarah samjhaya, remedies bhi simple thi. Dil se thank you.", at: ago(60 * 5), channel: "chat", tags: ["Accurate", "Polite"] },
  { id: "rv2", customer: "Amit V.", rating: 4, text: "Career ke baare mein clear guidance mili. Thoda aur time dete to better hota.", at: ago(60 * 26), channel: "chat", tags: ["Helpful"], reply: "Dhanyavaad Amit ji. Agli baar detail mein dekhenge." },
  { id: "rv3", customer: "Neha G.", rating: 5, text: "Call pe bahut patiently baat ki. Business ke liye jo bataya wo sahi nikla.", at: ago(60 * 50), channel: "call", tags: ["Accurate", "Patient"] },
  { id: "rv4", customer: "Karan M.", rating: 3, text: "Theek tha, par reply aane mein time lag raha tha.", at: ago(60 * 75), channel: "chat", tags: ["Slow replies"] },
  { id: "rv5", customer: "Pooja S.", rating: 5, text: "Best astrologer on the app. Har baar sahi prediction.", at: ago(60 * 100), channel: "video", tags: ["Accurate"] },
  { id: "rv6", customer: "Rahul Y.", rating: 2, text: "Generic baatein lagi, meri problem pe focus nahi hua.", at: ago(60 * 140), channel: "chat", tags: ["Generic"] },
  { id: "rv7", customer: "Sneha I.", rating: 5, text: "Very calm and positive. Felt much better after the chat.", at: ago(60 * 190), channel: "chat", tags: ["Positive", "Polite"] },
  { id: "rv8", customer: "Vikas J.", rating: 4, text: "Achha laga, remedies follow kar raha hoon.", at: ago(60 * 260), channel: "chat", tags: ["Helpful"] },
];

export const MOCK_CUSTOMERS: MockCustomer[] = NAMES.map((name, i) => ({
  id: `c${i + 1}`,
  name,
  city: CITIES[i],
  sessions: 1 + ((i * 5) % 9),
  minutes: 12 + ((i * 37) % 160),
  spent: (12 + ((i * 37) % 160)) * 25,
  lastAt: ago(i * 600 + 90),
  rating: i % 3 === 0 ? undefined : [5, 4, 5, 3][i % 4],
  sign: SIGNS[i],
  note: i % 4 === 0 ? "Marriage ka sawal, Shukra remedy di thi. Follow up karna." : undefined,
  tags: i % 5 === 0 ? ["VIP", "Repeat"] : i % 2 === 0 ? ["Repeat"] : [],
}));

export const MOCK_PAYOUTS: MockPayout[] = [
  { id: "po_118", period: "27 Oct to 2 Nov", amount: 18420, tds: 0, status: "processing", at: ago(60 * 24), method: "HDFC ••4821" },
  { id: "po_117", period: "20 Oct to 26 Oct", amount: 21360.5, tds: 0, status: "paid", utr: "HDFCN52611093341", at: ago(60 * 24 * 8), method: "HDFC ••4821" },
  { id: "po_116", period: "13 Oct to 19 Oct", amount: 16980, tds: 0, status: "paid", utr: "HDFCN52530011762", at: ago(60 * 24 * 15), method: "HDFC ••4821" },
  { id: "po_115", period: "6 Oct to 12 Oct", amount: 14210, tds: 0, status: "failed", at: ago(60 * 24 * 22), method: "HDFC ••4821" },
  { id: "po_114", period: "29 Sep to 5 Oct", amount: 19044, tds: 0, status: "paid", utr: "HDFCN52401188420", at: ago(60 * 24 * 29), method: "HDFC ••4821" },
];

export const MOCK_NOTIFICATIONS: MockNotification[] = [
  { id: "n1", kind: "request", title: "Missed chat request", body: "Karan M. ne chat request bheji thi, 60 sec mein accept nahi hui.", at: ago(14), read: false },
  { id: "n2", kind: "review", title: "New 5 star review", body: "Riya S.: \"Bahut acchi tarah samjhaya...\"", at: ago(60 * 5), read: false },
  { id: "n3", kind: "payout", title: "Payout processing", body: "₹18,420 ka payout 27 Oct to 2 Nov ke liye process ho raha hai.", at: ago(60 * 24), read: false },
  { id: "n4", kind: "admin", title: "Diwali campaign", body: "Platform 20% bonus de raha hai customers ko. Is weekend zyada online rahein.", at: ago(60 * 30), read: true },
  { id: "n5", kind: "kyc", title: "PAN verified", body: "Aapka PAN card verify ho gaya.", at: ago(60 * 24 * 3), read: true },
  { id: "n6", kind: "system", title: "Auto offline", body: "3 requests miss hone par aapko offline kar diya gaya.", at: ago(60 * 24 * 4), read: true },
  { id: "n7", kind: "payout", title: "Payout paid", body: "₹21,360.50 aapke bank mein bhej diya. UTR HDFCN52611093341.", at: ago(60 * 24 * 8), read: true },
];

export const MOCK_QUICK_REPLIES = [
  "Namaste, main aapki kundli dekh raha hoon. Ek minute dijiye.",
  "Kripya apni janam tithi, samay aur sthan confirm karein.",
  "Aapka sawal thoda aur detail mein batayein.",
  "Ye upay 21 din tak lagatar karein.",
  "Dhanyavaad. Aapka din shubh ho.",
];

export const MOCK_PRODUCTS = [
  { id: "p1", name: "Yellow Sapphire (Pukhraj) 5.25 ct", price: 18500, commissionPct: 8, image: "/images/image1.png", planet: "Guru" },
  { id: "p2", name: "Blue Sapphire (Neelam) 4.1 ct", price: 24000, commissionPct: 8, image: "/images/image2.png", planet: "Shani" },
  { id: "p3", name: "Red Coral (Moonga) 6 ct", price: 6200, commissionPct: 10, image: "/images/image3.png", planet: "Mangal" },
  { id: "p4", name: "5 Mukhi Rudraksha (Nepal)", price: 1100, commissionPct: 12, image: "/images/vedic-gemstone-astrology.png", planet: "Guru" },
  { id: "p5", name: "Opal 3.5 ct", price: 7800, commissionPct: 10, image: "/images/gemstones-vedic-astrolabe.png", planet: "Shukra" },
  { id: "p6", name: "Shri Yantra (copper)", price: 1450, commissionPct: 15, image: "/images/sunlit-odiac-muse.png", planet: "All" },
];

export const MOCK_REMEDY_SALES = [
  { id: "rs1", product: "Yellow Sapphire (Pukhraj) 5.25 ct", customer: "Riya S.", price: 18500, commission: 1480, status: "delivered" as const, at: ago(60 * 24 * 2) },
  { id: "rs2", product: "5 Mukhi Rudraksha (Nepal)", customer: "Amit V.", price: 1100, commission: 132, status: "shipped" as const, at: ago(60 * 24 * 4) },
  { id: "rs3", product: "Opal 3.5 ct", customer: "Sneha I.", price: 7800, commission: 780, status: "returned" as const, at: ago(60 * 24 * 9) },
  { id: "rs4", product: "Shri Yantra (copper)", customer: "Pooja S.", price: 1450, commission: 217.5, status: "delivered" as const, at: ago(60 * 24 * 12) },
];

/** Weekly availability (24h "HH:MM" ranges). */
export const MOCK_WEEK: { day: string; on: boolean; slots: { from: string; to: string }[] }[] = [
  { day: "Monday", on: true, slots: [{ from: "09:00", to: "13:00" }, { from: "18:00", to: "22:00" }] },
  { day: "Tuesday", on: true, slots: [{ from: "09:00", to: "13:00" }, { from: "18:00", to: "22:00" }] },
  { day: "Wednesday", on: true, slots: [{ from: "10:00", to: "14:00" }] },
  { day: "Thursday", on: true, slots: [{ from: "09:00", to: "13:00" }, { from: "18:00", to: "22:00" }] },
  { day: "Friday", on: true, slots: [{ from: "18:00", to: "23:00" }] },
  { day: "Saturday", on: true, slots: [{ from: "08:00", to: "12:00" }, { from: "17:00", to: "23:00" }] },
  { day: "Sunday", on: false, slots: [] },
];

export const MOCK_APPOINTMENTS = [
  { id: "ap1", customer: "Neha G.", channel: "call" as Channel, at: inDays(0, 19, 30), minutes: 20, topic: "Business partnership" },
  { id: "ap2", customer: "Vikas J.", channel: "chat" as Channel, at: inDays(1, 10, 0), minutes: 15, topic: "Property purchase" },
  { id: "ap3", customer: "Anjali R.", channel: "video" as Channel, at: inDays(2, 18, 0), minutes: 30, topic: "Kundli matching" },
  { id: "ap4", customer: "Rohit K.", channel: "chat" as Channel, at: inDays(4, 21, 0), minutes: 10, topic: "Exam result" },
];

export const MOCK_LEAVES = [{ id: "lv1", from: inDays(9), to: inDays(11), reason: "Family function" }];

export const MOCK_EARNINGS_30D = Array.from({ length: 30 }, (_, i) => Math.round(900 + Math.sin(i / 3) * 450 + ((i * 131) % 700)));

export const MOCK_TICKETS = [
  { id: "TK-2291", subject: "Payout of 6 Oct week failed", status: "open" as const, at: ago(60 * 24 * 20), last: "Hum bank se check kar rahe hain. 48 ghante mein update denge." },
  { id: "TK-2210", subject: "Customer ne galat review diya", status: "resolved" as const, at: ago(60 * 24 * 35), last: "Review guidelines ke against tha, hata diya gaya." },
];

export const MOCK_ANNOUNCEMENTS = [
  { id: "an1", title: "Diwali weekend: zyada demand", body: "Customers ko 20% bonus mil raha hai. Shaam 6 se 11 online rahein.", at: ago(60 * 30) },
  { id: "an2", title: "Naya rule: contact share mana hai", body: "Chat mein phone number ya UPI ID share karna block hai. Baar baar karne par account suspend hoga.", at: ago(60 * 24 * 6) },
];

export const MOCK_OFFERS = [
  { id: "of1", title: "First chat ₹1/min (first 5 min)", desc: "Naye customers ke liye. Platform aapko poora rate deta hai, farq platform bharta hai.", joined: true, impact: "+38% naye customers" },
  { id: "of2", title: "Diwali flat 20% off", desc: "Aapke rate par 20% discount. Discount ka 50% platform bharta hai.", joined: false, impact: "+55% sessions (last year)" },
  { id: "of3", title: "Free 3 min trial", desc: "Pehle 3 minute free. Free minutes ka payment platform deta hai at 50% of rate.", joined: false, impact: "+22% conversion" },
];

/* ------------------------------------------------------------------ *
 * Tips, gifts, live, followers, insights
 * ------------------------------------------------------------------ */

/** Partner share of a tip (rest covers payment cost). Shown openly in the panel. */
export const TIP_SHARE_PCT = 90;
/** Partner share of live gifts. */
export const GIFT_SHARE_PCT = 50;

export const GIFTS = [
  { id: "rose", name: "Rose", emoji: "🌹", price: 10 },
  { id: "diya", name: "Diya", emoji: "🪔", price: 21 },
  { id: "lotus", name: "Lotus", emoji: "🪷", price: 51 },
  { id: "shankh", name: "Shankh", emoji: "🐚", price: 101 },
  { id: "crown", name: "Crown", emoji: "👑", price: 501 },
] as const;
export type GiftId = (typeof GIFTS)[number]["id"];

export const MOCK_TIPS = [
  { id: "tp1", customer: "Riya S.", amount: 51, sessionId: "ses_1039", note: "Thank you ji", at: ago(60 * 3) },
  { id: "tp2", customer: "Pooja S.", amount: 101, sessionId: "ses_1035", note: "", at: ago(60 * 20) },
  { id: "tp3", customer: "Sneha I.", amount: 21, sessionId: "ses_1030", note: "Bahut accha laga", at: ago(60 * 46) },
  { id: "tp4", customer: "Neha G.", amount: 51, sessionId: "ses_1028", note: "", at: ago(60 * 24 * 4) },
  { id: "tp5", customer: "Amit V.", amount: 11, sessionId: "ses_1021", note: "", at: ago(60 * 24 * 9) },
];

export const MOCK_LIVES = [
  { id: "lv_31", title: "Shani gochar 2026: kya badlega?", at: ago(60 * 24 * 2), minutes: 64, peak: 418, unique: 1260, newFollowers: 37, gifts: 2840, calls: 4, callEarning: 690 },
  { id: "lv_30", title: "Shaadi ke yog, live Q&A", at: ago(60 * 24 * 6), minutes: 48, peak: 256, unique: 790, newFollowers: 19, gifts: 1320, calls: 3, callEarning: 450 },
  { id: "lv_29", title: "Diwali upay for money", at: ago(60 * 24 * 11), minutes: 92, peak: 611, unique: 2104, newFollowers: 64, gifts: 5110, calls: 6, callEarning: 1080 },
];

export const MOCK_FOLLOWERS = NAMES.concat(["Isha Bansal", "Manoj Tiwari", "Kavya Nair", "Deepak Joshi", "Ritu Arora", "Nikhil Sen"]).map((name, i) => ({
  id: `f${i + 1}`,
  name: `${name.split(" ")[0]} ${name.split(" ")[1][0]}.`,
  city: CITIES[i % CITIES.length],
  since: ago(60 * 24 * (2 + i * 6)),
  sessions: i % 3 === 0 ? 0 : 1 + (i % 5),
  alerts: i % 4 !== 1,
  via: (["Profile", "Live", "Session", "Profile", "Live"] as const)[i % 5],
}));

/** Daily follower totals for the last 30 days. */
export const MOCK_FOLLOWER_GROWTH = Array.from({ length: 30 }, (_, i) => 1180 + i * 9 + Math.round(Math.sin(i / 2) * 6) + (i === 27 ? 37 : 0));

/** Funnel per day for the last 30 days. */
export const MOCK_FUNNEL_30D = Array.from({ length: 30 }, (_, i) => {
  const impressions = 2200 + Math.round(Math.sin(i / 4) * 400) + ((i * 97) % 300);
  const views = Math.round(impressions * (0.18 + ((i * 13) % 5) / 100));
  const clicks = Math.round(views * 0.22);
  const started = Math.round(clicks * 0.71);
  const paid = Math.round(started * 0.86);
  return { impressions, views, clicks, started, paid };
});

export const MOCK_VIEW_SOURCES = [
  { label: "Search", value: 34, color: "#c9942a" },
  { label: "Online now list", value: 27, color: "#7a45f5" },
  { label: "Category pages", value: 16, color: "#0ea5e9" },
  { label: "Live", value: 11, color: "#ef4444" },
  { label: "Follower alerts", value: 8, color: "#10b981" },
  { label: "Shared link", value: 4, color: "#a1a1aa" },
];

export const MOCK_RANK_FACTORS = [
  { factor: "Acceptance rate", from: "91%", to: "84%", impact: -6, tip: "You missed 7 requests on Saturday evening. Use Break mode instead of leaving the tab." },
  { factor: "Online hours (peak time)", from: "14 h", to: "9 h", impact: -8, tip: "6 pm to 11 pm has 3x more requests than mornings." },
  { factor: "Average rating", from: "4.6", to: "4.7", impact: 3, tip: "Keep sending session summaries. They lift ratings." },
  { factor: "First reply time", from: "38 s", to: "29 s", impact: 2, tip: "Quick replies are working. Keep using them." },
  { factor: "Repeat customers", from: "34%", to: "36%", impact: 1, tip: "Follow-up replies bring customers back." },
  { factor: "Complaints", from: "0", to: "1", impact: -2, tip: "One complaint is under review. If dismissed, this goes away." },
];

/** Demand (requests in category) vs your online share, by day part. 0–100. */
export const MOCK_DEMAND = [
  { part: "6–10 am", demand: 35, you: 70 },
  { part: "10 am–2 pm", demand: 48, you: 55 },
  { part: "2–6 pm", demand: 52, you: 20 },
  { part: "6–9 pm", demand: 92, you: 45 },
  { part: "9 pm–12 am", demand: 100, you: 60 },
  { part: "12–6 am", demand: 22, you: 0 },
];
