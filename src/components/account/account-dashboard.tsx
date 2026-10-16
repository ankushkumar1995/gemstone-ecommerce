"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Package,
  MapPin,
  UserCog,
  Heart,
  LogOut,
  Plus,
  Trash2,
  Check,
  ShoppingBag,
  CalendarClock,
  Clock,
  Loader2,
} from "lucide-react";
import { useCommerce, type Address } from "@/lib/store";
import { customerApi } from "@/lib/customer-api";
import { shopApi } from "@/lib/shop-api";
import { AccountOrders } from "@/components/account/account-orders";
import type { Booking } from "@/modules/bookings";
import { useCurrency } from "@/lib/currency";
import { useToast } from "@/lib/toast";
import { Container } from "@/components/ui/container";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Tab = "overview" | "orders" | "bookings" | "addresses" | "profile";

const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "orders", label: "My Orders", icon: Package },
  { key: "bookings", label: "My Bookings", icon: CalendarClock },
  { key: "addresses", label: "Addresses", icon: MapPin },
  { key: "profile", label: "Profile", icon: UserCog },
];

const TAB_KEYS: Tab[] = ["overview", "orders", "bookings", "addresses", "profile"];

export function AccountDashboard() {
  const { user, logout, wishlistCount } = useCommerce();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") as Tab) || "overview";
  const [tab, setTab] = useState<Tab>(TAB_KEYS.includes(initialTab) ? initialTab : "overview");

  const initials = (user?.name ?? "U")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <Container className="py-10">
      <Breadcrumb items={[{ label: "My Account" }]} className="mb-6" />

      <div className="grid gap-8 lg:grid-cols-[18rem_1fr]">
        {/* sidebar */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-3xl border border-foreground/10 bg-nebula p-5">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-royal-500 to-royal-700 font-bold text-white">
                {initials}
              </span>
              <div className="min-w-0">
                <p className="truncate font-semibold text-foreground">
                  {user?.name}
                </p>
                <p className="truncate text-xs text-muted">{user?.email}</p>
              </div>
            </div>

            <nav className="mt-5 space-y-1">
              {tabs.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-2xl px-3.5 py-2.5 text-sm font-medium transition-colors",
                    tab === t.key
                      ? "bg-gold-400/12 text-gold-600"
                      : "text-foreground hover:bg-foreground/[0.04]"
                  )}
                >
                  <t.icon size={17} />
                  {t.label}
                </button>
              ))}
              <Link
                href="/wishlist"
                className="flex w-full items-center justify-between rounded-2xl px-3.5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-foreground/[0.04]"
              >
                <span className="flex items-center gap-3">
                  <Heart size={17} /> Wishlist
                </span>
                {wishlistCount > 0 && (
                  <span className="rounded-full bg-gold-400 px-1.5 text-xs text-white">
                    {wishlistCount}
                  </span>
                )}
              </Link>
              <button
                onClick={async () => {
                  await customerApi.logout(); // clear the real server session + cookies
                  logout(); // clear local state
                  toast("Signed out", "info");
                }}
                className="flex w-full items-center gap-3 rounded-2xl px-3.5 py-2.5 text-sm font-medium text-rose-mystic transition-colors hover:bg-rose-mystic/5"
              >
                <LogOut size={17} /> Sign Out
              </button>
            </nav>
          </div>
        </aside>

        {/* content */}
        <div className="min-w-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
            >
              {tab === "overview" && <Overview onGoOrders={() => setTab("orders")} />}
              {tab === "orders" && <AccountOrders />}
              {tab === "bookings" && <Bookings />}
              {tab === "addresses" && <Addresses />}
              {tab === "profile" && <Profile />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </Container>
  );
}

/* ---------------- Overview ---------------- */
function Overview({ onGoOrders }: { onGoOrders: () => void }) {
  const { user, orders, wishlistCount, addresses } = useCommerce();
  const stats = [
    { label: "Orders", value: orders.length, icon: Package },
    { label: "Wishlist", value: wishlistCount, icon: Heart },
    { label: "Addresses", value: addresses.length, icon: MapPin },
  ];
  return (
    <div>
      <h1 className="text-2xl font-semibold text-foreground">
        Namaste, {user?.name?.split(" ")[0]} 👋
      </h1>
      <p className="mt-1 text-muted">Here&apos;s a quick look at your account.</p>

      <div className="mt-6 grid grid-cols-3 gap-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-3xl border border-foreground/10 bg-nebula p-5 text-center"
          >
            <s.icon size={20} className="mx-auto text-gold-600" />
            <p className="mt-2 text-2xl font-bold text-foreground">{s.value}</p>
            <p className="text-xs text-muted">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-3xl border border-foreground/10 bg-nebula p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-foreground">Recent Orders</h2>
          {orders.length > 0 && (
            <button
              onClick={onGoOrders}
              className="text-sm font-medium text-gold-600 hover:text-gold-500"
            >
              View all
            </button>
          )}
        </div>
        {orders.length === 0 ? (
          <EmptyOrders />
        ) : (
          <div className="mt-4 space-y-3">
            {orders.slice(0, 2).map((o) => (
              <OrderRow key={o.id} order={o} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- Orders (overview mini-preview helpers) ---------------- */
function EmptyOrders() {
  return (
    <div className="flex flex-col items-center py-10 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-gold-400/15 to-royal-400/15 text-gold-600">
        <ShoppingBag size={26} />
      </span>
      <p className="mt-4 font-semibold text-foreground">No orders yet</p>
      <p className="mt-1 max-w-xs text-sm text-muted">
        When you order a certified gemstone, it&apos;ll appear here with live status.
      </p>
      <Link href="/shop" className="mt-5">
        <Button variant="gold" size="md">
          Start Shopping
        </Button>
      </Link>
    </div>
  );
}

const ORDER_STATUS_META: Record<string, { pill: string; dot: string; bar: string }> = {
  Confirmed: {
    pill: "bg-royal-400/12 text-royal-600",
    dot: "bg-royal-500",
    bar: "from-royal-400/60 to-royal-500/40",
  },
  Energising: {
    pill: "bg-gold-400/15 text-gold-600",
    dot: "bg-gold-500",
    bar: "from-gold-400/70 to-gold-500/50",
  },
  Shipped: {
    pill: "bg-aura/15 text-aura",
    dot: "bg-aura",
    bar: "from-aura/60 to-royal-400/40",
  },
  Delivered: {
    pill: "bg-emerald-500/15 text-emerald-600",
    dot: "bg-emerald-500",
    bar: "from-emerald-400/60 to-emerald-500/40",
  },
};

function OrderRow({
  order,
  expanded,
}: {
  order: import("@/lib/store").Order;
  expanded?: boolean;
}) {
  const { format } = useCurrency();
  const meta = ORDER_STATUS_META[order.status] ?? ORDER_STATUS_META.Confirmed;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="group relative overflow-hidden rounded-3xl border border-foreground/10 bg-nebula shadow-[0_10px_30px_-20px_rgba(36,26,59,0.35)] transition-shadow hover:shadow-[0_18px_44px_-24px_rgba(36,26,59,0.5)]"
    >
      {/* status accent bar */}
      <span className={cn("absolute inset-x-0 top-0 h-1 bg-gradient-to-r", meta.bar)} />

      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-gold-400/15 to-royal-400/15 text-gold-600">
            <ShoppingBag size={18} />
          </span>
          <div>
            <p className="text-sm font-bold tracking-wide text-foreground">{order.id}</p>
            <p className="text-xs text-muted">
              {new Date(order.date).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}{" "}
              · {order.items.length} item{order.items.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <span
          className={cn(
            "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
            meta.pill,
          )}
        >
          <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
          {order.status}
        </span>
      </div>

      {/* items */}
      {expanded ? (
        <div className="mt-4 space-y-1 px-5">
          {order.items.map((it) => (
            <div
              key={it.id}
              className="flex items-center gap-3 rounded-2xl p-2 transition-colors hover:bg-foreground/[0.03]"
            >
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-foreground/10">
                <Image src={it.image} alt={it.name} fill sizes="56px" className="object-cover" />
              </div>
              <Link
                href={`/product/${it.slug}`}
                className="line-clamp-1 flex-1 text-sm font-medium text-foreground transition-colors hover:text-gold-600"
              >
                {it.name}
              </Link>
              <span className="rounded-md bg-foreground/5 px-2 py-0.5 text-xs text-muted">×{it.qty}</span>
              <span className="w-20 text-right text-sm font-semibold text-foreground">
                {format(it.price * it.qty)}
              </span>
            </div>
          ))}
        </div>
      ) : (
        // compact (overview): a thumbnail strip
        <div className="mt-4 flex items-center gap-2 px-5">
          {order.items.slice(0, 4).map((it) => (
            <div key={it.id} className="relative h-10 w-10 overflow-hidden rounded-lg border border-foreground/10">
              <Image src={it.image} alt={it.name} fill sizes="40px" className="object-cover" />
            </div>
          ))}
          {order.items.length > 4 && (
            <span className="text-xs text-muted">+{order.items.length - 4}</span>
          )}
          <span className="ml-auto line-clamp-1 text-sm text-muted">
            {order.items[0]?.name}
            {order.items.length > 1 ? ` +${order.items.length - 1} more` : ""}
          </span>
        </div>
      )}

      {/* footer */}
      <div className="mt-4 flex items-center justify-between border-t border-foreground/8 px-5 py-4">
        <span className="text-xs uppercase tracking-wider text-muted">Total paid</span>
        <span className="text-lg font-bold text-foreground">{format(order.total)}</span>
      </div>
    </motion.div>
  );
}

/* ---------------- Bookings ---------------- */
function Bookings() {
  const { format } = useCurrency();
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState<Booking[]>([]);

  useEffect(() => {
    let active = true;
    (async () => {
      const res = await shopApi.bookings.mine();
      if (!active) return;
      setBookings(res.ok ? res.data.bookings : []);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const statusTone: Record<string, string> = {
    pending: "bg-foreground/8 text-muted",
    confirmed: "bg-royal-400/12 text-royal-600",
    in_progress: "bg-gold-400/15 text-gold-600",
    completed: "bg-emerald-500/15 text-emerald-600",
    cancelled: "bg-rose-500/12 text-rose-600",
    refunded: "bg-rose-500/12 text-rose-600",
  };
  const statusLabel: Record<string, string> = {
    pending: "Pending",
    confirmed: "Confirmed",
    in_progress: "In Progress",
    completed: "Completed",
    cancelled: "Cancelled",
    refunded: "Refunded",
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold text-foreground">My Bookings</h1>
      {loading ? (
        <div className="mt-6 flex items-center justify-center gap-2 rounded-3xl border border-foreground/10 bg-nebula py-10 text-sm text-muted">
          <Loader2 size={16} className="animate-spin" /> Loading your bookings…
        </div>
      ) : bookings.length === 0 ? (
        <div className="mt-6 rounded-3xl border border-foreground/10 bg-nebula p-6">
          <div className="flex flex-col items-center py-8 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-foreground/5 text-muted">
              <CalendarClock size={24} />
            </span>
            <p className="mt-3 font-medium text-foreground">No bookings yet</p>
            <p className="mt-1 text-sm text-muted">Your astrology consultations will appear here.</p>
            <Link href="/services" className="mt-4">
              <Button variant="gold" size="sm">
                Explore Services
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {bookings.map((b) => (
            <div key={b.id} className="rounded-2xl border border-foreground/10 bg-nebula p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-foreground">{b.serviceTitle}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {b.bookingNumber} ·{" "}
                    {new Date(b.placedAt).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <span
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-semibold",
                    statusTone[b.status] ?? "bg-foreground/8 text-muted",
                  )}
                >
                  {statusLabel[b.status] ?? b.status}
                </span>
              </div>

              {b.scheduledAt && (
                <p className="mt-3 flex items-center gap-1.5 rounded-lg bg-gold-400/8 px-3 py-2 text-xs text-foreground">
                  <Clock size={13} className="text-gold-600" />
                  Scheduled: {new Date(b.scheduledAt).toLocaleString("en-IN")}
                </p>
              )}

              {b.adminNotes && (
                <p className="mt-2 rounded-lg bg-void px-3 py-2 text-xs leading-relaxed text-muted">
                  {b.adminNotes}
                </p>
              )}

              <div className="mt-3 flex items-center justify-between border-t border-foreground/8 pt-3">
                <span className="text-xs text-muted">
                  Payment:{" "}
                  <span className={b.paymentStatus === "paid" ? "text-emerald-600" : "text-muted"}>
                    {b.paymentStatus === "paid" ? "Paid" : b.paymentStatus === "refunded" ? "Refunded" : "Unpaid"}
                  </span>
                </span>
                <span className="font-bold text-foreground">{format(b.amount)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------- Addresses ---------------- */
function Addresses() {
  const { addresses, addAddress, removeAddress, setDefaultAddress } = useCommerce();
  const { toast } = useToast();
  const [adding, setAdding] = useState(false);

  const handleAdd = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const d = Object.fromEntries(
      new FormData(e.currentTarget).entries()
    ) as Record<string, string>;
    const addr: Address = {
      id: `addr-${Date.now()}`,
      label: d.label || "Home",
      name: d.name,
      phone: d.phone,
      line: d.line,
      city: d.city,
      state: d.state,
      pincode: d.pincode,
    };
    addAddress(addr);
    toast("Address added", "success");
    setAdding(false);
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-foreground">Saved Addresses</h1>
        {!adding && (
          <Button variant="gold" size="sm" onClick={() => setAdding(true)}>
            <Plus size={15} /> Add New
          </Button>
        )}
      </div>

      {adding && (
        <form
          onSubmit={handleAdd}
          className="mt-6 grid gap-4 rounded-3xl border border-foreground/10 bg-nebula p-6 sm:grid-cols-2"
        >
          <input name="label" placeholder="Label (Home / Office)" className={input} />
          <input name="name" required placeholder="Full name" className={input} />
          <input name="phone" required placeholder="Phone" className={input} />
          <input name="pincode" required placeholder="PIN code" className={input} />
          <input name="line" required placeholder="Address" className={`${input} sm:col-span-2`} />
          <input name="city" required placeholder="City" className={input} />
          <input name="state" required placeholder="State" className={input} />
          <div className="flex gap-3 sm:col-span-2">
            <Button variant="gold" size="md" type="submit">
              Save Address
            </Button>
            <Button
              variant="ghost"
              size="md"
              type="button"
              onClick={() => setAdding(false)}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}

      {addresses.length === 0 && !adding ? (
        <div className="mt-6 rounded-3xl border border-foreground/10 bg-nebula p-10 text-center">
          <MapPin size={28} className="mx-auto text-muted" />
          <p className="mt-3 font-medium text-foreground">No addresses saved</p>
          <p className="mt-1 text-sm text-muted">Add one for faster checkout.</p>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {addresses.map((a) => (
            <div
              key={a.id}
              className={cn(
                "relative rounded-3xl border bg-nebula p-5",
                a.isDefault ? "border-gold-400/50" : "border-foreground/10"
              )}
            >
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-foreground/5 px-2.5 py-1 text-xs font-medium text-foreground">
                  {a.label}
                </span>
                {a.isDefault && (
                  <span className="flex items-center gap-1 text-xs font-medium text-gold-600">
                    <Check size={12} /> Default
                  </span>
                )}
              </div>
              <p className="mt-3 font-medium text-foreground">{a.name}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted">
                {a.line}, {a.city}, {a.state} — {a.pincode}
                <br />
                {a.phone}
              </p>
              <div className="mt-4 flex gap-4 text-sm">
                {!a.isDefault && (
                  <button
                    onClick={() => setDefaultAddress(a.id)}
                    className="font-medium text-gold-600 hover:text-gold-500"
                  >
                    Set default
                  </button>
                )}
                <button
                  onClick={() => removeAddress(a.id)}
                  className="flex items-center gap-1 font-medium text-rose-mystic hover:opacity-80"
                >
                  <Trash2 size={13} /> Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------- Profile ---------------- */
function Profile() {
  const { user, updateProfile } = useCommerce();
  const { toast } = useToast();

  const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const d = Object.fromEntries(
      new FormData(e.currentTarget).entries()
    ) as Record<string, string>;
    // Email is the login identity — not editable here (needs a verify flow).
    // Only name + phone are persisted.
    updateProfile({ name: d.name, phone: d.phone });
    toast("Profile updated", "success");
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold text-foreground">Profile</h1>
      <form
        onSubmit={handleSave}
        className="mt-6 max-w-lg space-y-4 rounded-3xl border border-foreground/10 bg-nebula p-6"
      >
        <Labeled label="Full Name">
          <input name="name" defaultValue={user?.name} className={input} />
        </Labeled>
        <Labeled label="Email">
          <input
            name="email"
            type="email"
            defaultValue={user?.email}
            readOnly
            disabled
            title="Email can't be changed here"
            className={cn(input, "cursor-not-allowed opacity-70")}
          />
        </Labeled>
        <Labeled label="Phone">
          <input
            name="phone"
            defaultValue={user?.phone}
            placeholder="+91 00000 00000"
            className={input}
          />
        </Labeled>
        <Button variant="gold" size="md" type="submit">
          Save Changes
        </Button>
      </form>
    </div>
  );
}

const input =
  "w-full rounded-xl border border-foreground/15 bg-void px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted/70 focus:border-gold-400/70 focus:ring-2 focus:ring-gold-400/20";

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
