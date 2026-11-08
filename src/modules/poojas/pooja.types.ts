/**
 * Poojas domain — types.
 *
 *   Pooja         a bookable ritual in the catalog (fully admin-configured:
 *                 content, packages, add-ons, schedule, sankalp form, policy)
 *   Pandit        who performs it (managed by the admin)
 *   PoojaBooking  one customer's booking: a frozen snapshot of what was
 *                 bought (price changes never touch old bookings), the slot,
 *                 sankalp details, payment, pandit, proof and prasad delivery
 *
 * Money is whole rupees (integers). Dates are IST: "YYYY-MM-DD" + "HH:MM".
 */

/** Categories seeded on first use. After that they are managed by the admin. */
export const DEFAULT_CATEGORY_KEYS = [
  "dosh_nivaran", "graha_shanti", "wealth", "health", "marriage", "career",
  "education", "protection", "festival", "ancestors", "other",
] as const;
/** A category key (stable id). Seeded ones keep their old keys so existing poojas still match. */
export type PoojaCategory = string;

export const CATEGORY_ICONS = ["Flame", "Sparkles", "Sun", "Moon", "Star", "Heart", "Coins", "Briefcase", "GraduationCap", "Shield", "Activity", "Users", "Leaf", "Gem", "Flower2", "Mountain"] as const;
export type CategoryIcon = (typeof CATEGORY_ICONS)[number];

export interface PoojaCategoryItem {
  /** Same as key. */
  id: string;
  /** Stable id stored on poojas. Never changes, even when renamed. */
  key: string;
  name: string;
  /** Public URL part: /pooja/category/<slug>. */
  slug: string;
  icon: CategoryIcon;
  image: string;
  description: string;
  seo: { title: string; description: string };
  visible: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

/** Admin list row. */
export interface PoojaCategoryRow extends PoojaCategoryItem {
  poojaCount: number;
}

/* ---------------- Ritual type (pooja vs havan / yagya) ---------------- */

/** Old poojas saved before this field existed are "pooja". */
export const RITUAL_TYPES = ["pooja", "havan"] as const;
export type RitualType = (typeof RITUAL_TYPES)[number];

/** Ekal: performed only for one yajman per date. Samuhik: many devotees share the havan. */
export const HAVAN_MODES = ["ekal", "samuhik"] as const;
export type HavanMode = (typeof HAVAN_MODES)[number];

/** Havan / yagya details. Ignored (and kept at defaults) for poojas. */
export interface HavanConfig {
  mode: HavanMode;
  /** 1 = a single-day havan; more = an anushthan over several days. */
  durationDays: number;
  /** Havan kund(s) used. */
  kundCount: number;
  /** YouTube / live link the team shares for this havan (optional). */
  liveUrl: string;
  /** Samagri offered in the havan (ghee, samidha, til, jau…). */
  samagri: string[];
  /** What the devotee receives (bhasma, raksha sutra, yantra…). */
  deliverables: string[];
}
export const blankHavan = (): HavanConfig => ({ mode: "samuhik", durationDays: 1, kundCount: 1, liveUrl: "", samagri: [], deliverables: [] });

export const POOJA_STATUSES = ["draft", "active", "paused", "archived"] as const;
export type PoojaStatus = (typeof POOJA_STATUSES)[number];

export const PACKAGE_KINDS = ["individual", "couple", "family", "group"] as const;
export type PackageKind = (typeof PACKAGE_KINDS)[number];

export const ADDON_KINDS = ["prasad", "live_video", "recording", "jaap", "daan", "product", "other"] as const;
export type AddOnKind = (typeof ADDON_KINDS)[number];

export const SCHEDULE_MODES = ["weekly", "fixed_dates", "on_request"] as const;
export type ScheduleMode = (typeof SCHEDULE_MODES)[number];

export const LOCATION_MODES = ["temple", "ashram", "our_pandits"] as const;
export type LocationMode = (typeof LOCATION_MODES)[number];

export interface PoojaPackage {
  id: string;
  name: string;
  kind: PackageKind;
  /** Max names in the sankalp. */
  members: number;
  price: number;
  /** Strike-through price, optional. */
  mrp: number | null;
  description: string;
  perks: string[];
  popular: boolean;
  active: boolean;
  /** Havan tiers: mantra jaap count in this package (null = not shown). */
  jaapCount?: number | null;
  /** Havan tiers: number of ahutis offered (null = not shown). */
  ahutiCount?: number | null;
  /** Havan tiers: pandits performing this package (null = the pooja's default). */
  panditCount?: number | null;
}

export interface PoojaAddOn {
  id: string;
  name: string;
  kind: AddOnKind;
  description: string;
  price: number;
  maxQty: number;
  /** Physical delivery (prasad, product) needs a shipping address. */
  requiresAddress: boolean;
  active: boolean;
}

export interface FixedDate {
  id: string;
  date: string; // YYYY-MM-DD (IST)
  time: string; // HH:MM
  label: string; // e.g. "Mahashivratri"
  /** null = use schedule.slotCapacity */
  capacity: number | null;
  /** Added to every package price for this date (festival pricing). */
  priceDelta: number;
}

export interface PoojaSchedule {
  mode: ScheduleMode;
  /** weekly: 0 = Sunday … 6 = Saturday */
  weekdays: number[];
  /** weekly: start times, HH:MM */
  times: string[];
  fixedDates: FixedDate[];
  /** Bookings per slot (per day for on_request). */
  slotCapacity: number;
  /** Booking closes this many hours before the slot. */
  cutoffHours: number;
  /** How many days ahead customers can book. */
  advanceDays: number;
  /** Dates with no pooja (YYYY-MM-DD). */
  blackoutDates: string[];
}

export interface SankalpConfig {
  requireGotra: boolean;
  requireDob: boolean;
  requireBirthPlace: boolean;
  requireWish: boolean;
  askRelation: boolean;
  wishMaxLength: number;
  /** Used when a customer does not know their gotra. */
  defaultGotra: string;
  instructions: string;
}

export interface RefundTier {
  /** Cancelled at least this many hours before the slot … */
  hoursBefore: number;
  /** … refunds this % of the amount paid. */
  refundPct: number;
}

export interface PoojaPolicy {
  /** Customer may reschedule for free up to this many hours before. */
  freeRescheduleHours: number;
  maxReschedules: number;
  /** Sorted by hoursBefore, highest first. Below the last tier: 0 %. */
  refundTiers: RefundTier[];
  /** Proof (video/photos) must be uploaded within this many hours of the slot. */
  proofSlaHours: number;
  /** Prasad must be dispatched within this many days after the pooja. */
  prasadDispatchDays: number;
}

export interface PoojaLocation {
  mode: LocationMode;
  place: string;
  city: string;
  state: string;
  mapUrl: string;
}

export interface PoojaFaq { q: string; a: string }

export interface Pooja {
  id: string;
  /** "pooja" (default for old records) or "havan" (havan / yagya / anushthan). */
  type: RitualType;
  /** Havan-only details; poojas keep the defaults. */
  havan: HavanConfig;
  slug: string;
  title: string;
  subtitle: string;
  deity: string;
  category: PoojaCategory;
  tags: string[];
  shortDescription: string;
  description: string;
  benefits: string[];
  /** Steps of the ritual (vidhi). */
  vidhi: string[];
  /** What the customer receives. */
  includes: string[];
  faqs: PoojaFaq[];
  coverImage: string;
  gallery: string[];
  videoUrl: string;
  location: PoojaLocation;
  durationMin: number;
  panditCount: number;
  mantraCount: number;
  packages: PoojaPackage[];
  addOns: PoojaAddOn[];
  schedule: PoojaSchedule;
  sankalp: SankalpConfig;
  policy: PoojaPolicy;
  seo: { title: string; description: string };
  status: PoojaStatus;
  featured: boolean;
  sortOrder: number;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

/** What the storefront may see: no admin names, only active packages/add-ons. */
export type PublicPooja = Omit<Pooja, "createdBy" | "updatedBy" | "policy"> & {
  policy: Pick<PoojaPolicy, "freeRescheduleHours" | "refundTiers">;
  /** Lowest active package price (festival pricing not included). */
  priceFrom: number;
  /** Strike-through price that goes with priceFrom, if any. */
  mrpFrom: number | null;
};

/** Storefront category chip. */
export interface PublicPoojaCategory { key: string; name: string; slug: string; icon: CategoryIcon; count: number }

/** Admin list row: the pooja plus live booking numbers. */
export interface PoojaListItem extends Pooja {
  bookings: number;
  revenue: number;
  upcoming: number;
}

/* ---------------- Pandits ---------------- */

export interface Pandit {
  id: string;
  name: string;
  phone: string;
  email: string;
  city: string;
  languages: string[];
  /** Pooja ids this pandit can perform (empty = any). */
  poojaIds: string[];
  experienceYears: number;
  photo: string;
  maxPerDay: number;
  active: boolean;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

/* ---------------- Bookings ---------------- */

export const BOOKING_STATUSES = ["pending_payment", "confirmed", "assigned", "in_progress", "performed", "completed", "cancelled"] as const;
export type PoojaBookingStatus = (typeof BOOKING_STATUSES)[number];

export const PAYMENT_STATUSES = ["unpaid", "paid", "partially_refunded", "refunded"] as const;
export type PoojaPaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PRASAD_STATUSES = ["not_required", "pending", "packed", "shipped", "delivered", "returned"] as const;
export type PrasadStatus = (typeof PRASAD_STATUSES)[number];

export type BookingSource = "web" | "app" | "admin" | "gemstone_order";

export interface SankalpMember {
  name: string;
  relation: string;
  gotra: string;
  dob: string;
  birthPlace: string;
}

export interface ShippingAddress {
  name: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
}

export interface BookingRefund {
  id: string;
  /** Client request id: a retried click is applied once. */
  requestId: string;
  amount: number;
  reason: string;
  method: "razorpay" | "manual";
  reference: string;
  status: "pending" | "processed" | "failed";
  error?: string;
  at: string;
  by: string;
}

export interface TimelineEntry {
  id: string;
  at: string;
  type: "created" | "payment" | "status" | "pandit" | "schedule" | "proof" | "prasad" | "refund" | "edit" | "note";
  message: string;
  actor: string;
}

/** One day's update on a multi-day havan / anushthan. */
export interface ProgressEntry {
  id: string;
  /** Day number, 1 … durationDays. */
  day: number;
  note: string;
  /** Total jaap completed so far (optional). */
  jaapDone: number | null;
  photos: string[];
  videoUrl: string;
  at: string;
  by: string;
}

export interface PoojaBooking {
  id: string;
  bookingNumber: string;
  poojaId: string;
  /** Snapshot at booking time. `type` / `durationDays` are missing on old bookings (= pooja, 1 day). */
  pooja: { title: string; slug: string; image: string; location: string; durationMin: number; type?: RitualType; durationDays?: number; mode?: HavanMode; liveUrl?: string };
  /** Havan anushthan: day-by-day updates for the devotee (empty for poojas). */
  progress?: ProgressEntry[];
  package: { id: string; name: string; kind: PackageKind; members: number; price: number };
  addOns: { id: string; name: string; kind: AddOnKind; price: number; qty: number; total: number; requiresAddress: boolean }[];
  slot: { date: string; time: string; key: string; label: string };
  customer: { customerId: string | null; name: string; email: string; phone: string };
  members: SankalpMember[];
  wish: string;
  address: ShippingAddress | null;
  pricing: { packagePrice: number; slotDelta: number; addOnsTotal: number; discount: number; total: number };
  payment: {
    method: "razorpay" | "manual" | "free";
    status: PoojaPaymentStatus;
    razorpayOrderId: string | null;
    razorpayPaymentId: string | null;
    reference: string;
    paidAt: string | null;
    refunded: number;
    refunds: BookingRefund[];
  };
  status: PoojaBookingStatus;
  panditId: string | null;
  panditName: string;
  proof: { videoUrl: string; liveUrl: string; photos: string[]; note: string; uploadedAt: string | null; uploadedBy: string };
  prasad: { status: PrasadStatus; courier: string; trackingNo: string; trackingUrl: string; shippedAt: string | null; deliveredAt: string | null; note: string };
  /** Policy at the time of booking: refunds and SLAs follow what the customer agreed to. */
  policy: PoojaPolicy;
  rescheduleCount: number;
  source: BookingSource;
  linkedOrderId: string | null;
  cancelReason: string;
  adminNotes: string;
  timeline: TimelineEntry[];
  /** Optimistic concurrency: every write bumps it. */
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface BookingFilter {
  poojaId?: string;
  panditId?: string;
  status?: PoojaBookingStatus[];
  from?: string; // slot date >= (YYYY-MM-DD)
  to?: string; // slot date <=
  q?: string;
  limit?: number;
}

/** A bookable slot as shown to admins (and later customers). */
export interface SlotView {
  key: string;
  date: string;
  time: string;
  label: string;
  capacity: number;
  booked: number;
  left: number;
  priceDelta: number;
  /** Past the booking cutoff. */
  closed: boolean;
}

/** Names and icons for the seeded categories (used only to seed). */
export const DEFAULT_CATEGORY_ICON: Record<(typeof DEFAULT_CATEGORY_KEYS)[number], CategoryIcon> = {
  dosh_nivaran: "Shield", graha_shanti: "Sun", wealth: "Coins", health: "Activity", marriage: "Heart", career: "Briefcase",
  education: "GraduationCap", protection: "Mountain", festival: "Sparkles", ancestors: "Flower2", other: "Flame",
};
export const CATEGORY_LABEL: Record<(typeof DEFAULT_CATEGORY_KEYS)[number], string> = {
  dosh_nivaran: "Dosh nivaran", graha_shanti: "Graha shanti", wealth: "Wealth & prosperity", health: "Health",
  marriage: "Marriage & love", career: "Career & business", education: "Education", protection: "Protection",
  festival: "Festival", ancestors: "Pitru & ancestors", other: "Other",
};
export const PACKAGE_LABEL: Record<PackageKind, string> = { individual: "Individual", couple: "Couple", family: "Family", group: "Group (samuhik)" };
export const ADDON_LABEL: Record<AddOnKind, string> = { prasad: "Prasad delivery", live_video: "Live video", recording: "HD recording", jaap: "Extra jaap", daan: "Daan / seva", product: "Product", other: "Other" };
export const LOCATION_LABEL: Record<LocationMode, string> = { temple: "Temple", ashram: "Ashram / peeth", our_pandits: "Our pandits" };
