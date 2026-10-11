"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
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
} from "lucide-react";
import { useCommerce, type Address } from "@/lib/store";
import { useCurrency } from "@/lib/currency";
import { useToast } from "@/lib/toast";
import { Container } from "@/components/ui/container";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Tab = "overview" | "orders" | "addresses" | "profile";

const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "orders", label: "My Orders", icon: Package },
  { key: "addresses", label: "Addresses", icon: MapPin },
  { key: "profile", label: "Profile", icon: UserCog },
];

export function AccountDashboard() {
  const { user, logout, wishlistCount } = useCommerce();
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("overview");

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
                onClick={() => {
                  logout();
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
              {tab === "orders" && <Orders />}
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

/* ---------------- Orders ---------------- */
function Orders() {
  const { orders } = useCommerce();
  return (
    <div>
      <h1 className="text-2xl font-semibold text-foreground">My Orders</h1>
      {orders.length === 0 ? (
        <div className="mt-6 rounded-3xl border border-foreground/10 bg-nebula p-6">
          <EmptyOrders />
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {orders.map((o) => (
            <OrderRow key={o.id} order={o} expanded />
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyOrders() {
  return (
    <div className="flex flex-col items-center py-8 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-foreground/5 text-muted">
        <ShoppingBag size={24} />
      </span>
      <p className="mt-3 font-medium text-foreground">No orders yet</p>
      <p className="mt-1 text-sm text-muted">
        Your gemstone orders will appear here.
      </p>
      <Link href="/shop" className="mt-4">
        <Button variant="gold" size="sm">
          Start Shopping
        </Button>
      </Link>
    </div>
  );
}

function OrderRow({
  order,
  expanded,
}: {
  order: import("@/lib/store").Order;
  expanded?: boolean;
}) {
  const { format } = useCurrency();
  const statusTone: Record<string, string> = {
    Confirmed: "bg-royal-400/12 text-royal-600",
    Energising: "bg-gold-400/15 text-gold-600",
    Shipped: "bg-aura/15 text-aura",
    Delivered: "bg-emerald-500/15 text-emerald-600",
  };
  return (
    <div className="rounded-2xl border border-foreground/10 bg-void p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-foreground">{order.id}</p>
          <p className="text-xs text-muted">
            {new Date(order.date).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}{" "}
            · {order.items.length} item(s)
          </p>
        </div>
        <span
          className={cn(
            "rounded-full px-3 py-1 text-xs font-semibold",
            statusTone[order.status]
          )}
        >
          {order.status}
        </span>
      </div>

      {expanded && (
        <div className="mt-4 space-y-2 border-t border-foreground/8 pt-4">
          {order.items.map((it) => (
            <div key={it.id} className="flex items-center gap-3">
              <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-foreground/10">
                <Image src={it.image} alt={it.name} fill sizes="44px" className="object-cover" />
              </div>
              <Link
                href={`/product/${it.slug}`}
                className="line-clamp-1 flex-1 text-sm text-foreground hover:text-gold-600"
              >
                {it.name}
              </Link>
              <span className="text-sm text-muted">×{it.qty}</span>
              <span className="text-sm font-medium text-foreground">
                {format(it.price * it.qty)}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between border-t border-foreground/8 pt-3">
        <span className="text-sm text-muted">Total</span>
        <span className="font-bold text-foreground">{format(order.total)}</span>
      </div>
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
    updateProfile({ name: d.name, email: d.email, phone: d.phone });
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
          <input name="email" type="email" defaultValue={user?.email} className={input} />
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
