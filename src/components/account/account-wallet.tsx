"use client";

/**
 * Customer wallet: balance (cash + bonus), recharge packs or a custom amount
 * via Razorpay, and the full ledger with filters + "load more".
 *
 * The server prices every recharge. The browser only sends the chosen pack or a
 * whole-rupee custom amount, then the Razorpay signature for verification.
 */

import { useEffect, useState } from "react";
import { Wallet, Gift, Loader2, ArrowDownLeft, ArrowUpRight, RefreshCw, Sparkles } from "lucide-react";
import { customerApi } from "@/lib/customer-api";
import { openRazorpayCheckout } from "@/lib/razorpay-client";
import { useCommerce } from "@/lib/store";
import { useToast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { WalletTxn, WalletTxnType, WalletView } from "@/modules/wallets";

const inr = (paise: number) =>
  `₹${(paise / 100).toLocaleString("en-IN", { minimumFractionDigits: paise % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;

const TYPE_LABEL: Record<WalletTxnType, string> = {
  recharge: "Recharge",
  consultation: "Consultation",
  refund: "Refund",
  adjustment: "Adjustment",
  reversal: "Reversal",
};
const FILTERS: { key: WalletTxnType | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "recharge", label: "Recharges" },
  { key: "consultation", label: "Consultations" },
  { key: "refund", label: "Refunds" },
  { key: "adjustment", label: "Adjustments" },
];

export function AccountWallet() {
  const { user } = useCommerce();
  const { toast } = useToast();
  const [wallet, setWallet] = useState<WalletView | null>(null);
  const [txns, setTxns] = useState<WalletTxn[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [filter, setFilter] = useState<WalletTxnType | "all">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [more, setMore] = useState(false);
  const [pack, setPack] = useState<number | null>(null);
  const [custom, setCustom] = useState("");
  const [paying, setPaying] = useState(false);
  const [reload, setReload] = useState(0);

  // Load balance + first page (also re-runs after a recharge).
  useEffect(() => {
    let active = true;
    (async () => {
      const res = await customerApi.wallet.get();
      if (!active) return;
      if (!res.ok) {
        setError(res.message);
      } else {
        setError(null);
        setWallet(res.data.wallet);
        setTxns(res.data.txns);
        setCursor(res.data.nextCursor);
        setFilter("all");
        setPack((p) => p ?? res.data.wallet.packs.find((x) => x.tag)?.amount ?? res.data.wallet.packs[0]?.amount ?? null);
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [reload]);

  async function applyFilter(next: WalletTxnType | "all") {
    setFilter(next);
    setMore(true);
    const res = await customerApi.wallet.txns(undefined, next === "all" ? undefined : next);
    setMore(false);
    if (!res.ok) return toast(res.message, "error");
    setTxns(res.data.items);
    setCursor(res.data.nextCursor);
  }

  async function loadMore() {
    if (!cursor) return;
    setMore(true);
    const res = await customerApi.wallet.txns(cursor, filter === "all" ? undefined : filter);
    setMore(false);
    if (!res.ok) return toast(res.message, "error");
    setTxns((t) => [...t, ...res.data.items.filter((n) => !t.some((o) => o.id === n.id))]);
    setCursor(res.data.nextCursor);
  }

  const customValue = custom.trim() === "" ? null : Number(custom);
  const customValid =
    customValue !== null && wallet !== null && Number.isInteger(customValue) && customValue >= wallet.customMin && customValue <= wallet.customMax;
  const selected = customValue !== null ? (customValid ? { amount: customValue, bonus: 0 } : null) : wallet?.packs.find((p) => p.amount === pack) ?? null;
  const gstPaise = selected && wallet ? Math.round((selected.amount * 100 * wallet.gstPct) / 100) : 0;

  async function recharge() {
    if (!selected || paying) return;
    setPaying(true);
    const created = await customerApi.wallet.createRecharge(customValue !== null ? { customAmount: selected.amount } : { packAmount: selected.amount });
    if (!created.ok) {
      setPaying(false);
      return toast(created.message, "error");
    }
    const d = created.data;
    try {
      await openRazorpayCheckout(
        {
          key: d.keyId,
          amount: d.amount,
          currency: d.currency,
          name: "Astrounkle Wallet",
          description: d.bonusPaise ? `Recharge ${inr(d.amountPaise)} + ${inr(d.bonusPaise)} bonus` : `Recharge ${inr(d.amountPaise)}`,
          order_id: d.razorpayOrderId,
          prefill: { name: user?.name, email: user?.email },
          theme: { color: "#c9942a" },
        },
        {
          onSuccess: async (r) => {
            const v = await customerApi.wallet.verify({
              razorpayOrderId: r.razorpay_order_id,
              razorpayPaymentId: r.razorpay_payment_id,
              razorpaySignature: r.razorpay_signature,
            });
            setPaying(false);
            if (v.ok) {
              toast(`${inr(v.data.creditedPaise)} added to your wallet`, "success");
              setCustom("");
            } else {
              // The signed webhook still credits the wallet if this call failed.
              toast("Payment received. Your balance will update in a moment.", "info");
              setTimeout(() => setReload((n) => n + 1), 4000);
            }
            setReload((n) => n + 1);
          },
          onDismiss: () => setPaying(false),
        },
      );
    } catch (e) {
      setPaying(false);
      toast(e instanceof Error ? e.message : "Could not open the payment window", "error");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-3xl border border-foreground/10 bg-nebula py-10 text-sm text-muted">
        <Loader2 size={16} className="animate-spin" /> Loading your wallet…
      </div>
    );
  }
  if (error || !wallet) {
    return (
      <div className="rounded-3xl border border-foreground/10 bg-nebula p-6 text-center">
        <p className="text-sm text-muted">{error ?? "Could not load your wallet."}</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => { setLoading(true); setReload((n) => n + 1); }}>
          <RefreshCw size={14} /> Try again
        </Button>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-foreground">My Wallet</h1>
      <p className="mt-1 text-muted">Use your wallet balance for chat consultations with astrologers.</p>

      {/* balance */}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-3xl border border-gold-400/30 bg-gradient-to-br from-gold-400/12 to-royal-400/10 p-5 sm:col-span-1">
          <Wallet size={20} className="text-gold-600" aria-hidden />
          <p className="mt-2 text-3xl font-bold text-foreground" aria-live="polite">{inr(wallet.totalPaise)}</p>
          <p className="text-xs text-muted">Total balance</p>
        </div>
        <div className="rounded-3xl border border-foreground/10 bg-nebula p-5">
          <ArrowDownLeft size={20} className="text-emerald-600" aria-hidden />
          <p className="mt-2 text-xl font-bold text-foreground">{inr(wallet.cashPaise)}</p>
          <p className="text-xs text-muted">Paid balance</p>
        </div>
        <div className="rounded-3xl border border-foreground/10 bg-nebula p-5">
          <Gift size={20} className="text-royal-600" aria-hidden />
          <p className="mt-2 text-xl font-bold text-foreground">{inr(wallet.promoPaise)}</p>
          <p className="text-xs text-muted">Bonus balance (used first)</p>
        </div>
      </div>

      {/* recharge */}
      <section className="mt-6 rounded-3xl border border-foreground/10 bg-nebula p-6" aria-labelledby="recharge-h">
        <h2 id="recharge-h" className="font-semibold text-foreground">Add money</h2>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" role="radiogroup" aria-label="Recharge packs">
          {wallet.packs.map((p) => {
            const active = customValue === null && pack === p.amount;
            return (
              <button
                key={p.amount}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => { setPack(p.amount); setCustom(""); }}
                className={cn(
                  "relative rounded-2xl border p-4 text-left transition-colors",
                  active ? "border-gold-500 bg-gold-400/10" : "border-foreground/10 hover:border-gold-400/60",
                )}
              >
                {p.tag && (
                  <span className="absolute -top-2 right-3 rounded-full bg-gold-500 px-2 py-0.5 text-[10px] font-semibold text-white">{p.tag}</span>
                )}
                <p className="text-lg font-bold text-foreground">{inr(p.amount * 100)}</p>
                {p.bonus > 0 ? (
                  <p className="mt-0.5 flex items-center gap-1 text-xs font-medium text-emerald-600">
                    <Sparkles size={12} aria-hidden /> +{inr(p.bonus * 100)} bonus
                  </p>
                ) : (
                  <p className="mt-0.5 text-xs text-muted">No bonus</p>
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-4">
          <label htmlFor="custom-amt" className="text-sm font-medium text-foreground">Or enter an amount</label>
          <div className="mt-1.5 flex max-w-xs items-center rounded-2xl border border-foreground/15 bg-void px-3 focus-within:border-gold-500">
            <span className="text-muted">₹</span>
            <input
              id="custom-amt"
              inputMode="numeric"
              value={custom}
              onChange={(e) => setCustom(e.target.value.replace(/[^\d]/g, "").slice(0, 6))}
              placeholder={`${wallet.customMin} to ${wallet.customMax.toLocaleString("en-IN")}`}
              className="w-full bg-transparent px-2 py-2.5 text-sm text-foreground outline-none"
              aria-describedby="custom-hint"
            />
          </div>
          <p id="custom-hint" className={cn("mt-1 text-xs", customValue !== null && !customValid ? "text-rose-600" : "text-muted")}>
            Whole rupees, {inr(wallet.customMin * 100)} to {inr(wallet.customMax * 100)}. Custom amounts get no bonus.
          </p>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-foreground/8 pt-4">
          <div className="text-sm text-muted">
            {selected ? (
              <>
                You get <span className="font-semibold text-foreground">{inr((selected.amount + selected.bonus) * 100)}</span>
                {gstPaise > 0 && <> · You pay {inr(selected.amount * 100 + gstPaise)} incl. {wallet.gstPct}% GST</>}
              </>
            ) : (
              "Choose a pack or enter an amount"
            )}
          </div>
          <Button variant="gold" size="md" onClick={recharge} disabled={!selected || paying} aria-busy={paying}>
            {paying ? <Loader2 size={16} className="animate-spin" /> : <Wallet size={16} />}
            {selected ? `Pay ${inr(selected.amount * 100 + gstPaise)}` : "Recharge"}
          </Button>
        </div>
      </section>

      {/* ledger */}
      <section className="mt-6 rounded-3xl border border-foreground/10 bg-nebula p-6" aria-labelledby="txn-h">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="txn-h" className="font-semibold text-foreground">Transactions</h2>
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => applyFilter(f.key)}
                aria-pressed={filter === f.key}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                  filter === f.key ? "bg-gold-400/15 text-gold-600" : "bg-foreground/5 text-muted hover:text-foreground",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {txns.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">No transactions yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-foreground/8">
            {txns.map((t) => {
              const total = t.cashPaise + t.promoPaise;
              const credit = total > 0;
              return (
                <li key={t.id} className="flex items-center gap-3 py-3">
                  <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", credit ? "bg-emerald-500/12 text-emerald-600" : "bg-rose-500/10 text-rose-600")}>
                    {credit ? <ArrowDownLeft size={16} aria-hidden /> : <ArrowUpRight size={16} aria-hidden />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{t.note}</p>
                    <p className="text-xs text-muted">
                      {TYPE_LABEL[t.type]} · {new Date(t.at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                      {t.promoPaise !== 0 && t.cashPaise !== 0 && <> · {inr(Math.abs(t.promoPaise))} bonus + {inr(Math.abs(t.cashPaise))} paid</>}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={cn("text-sm font-semibold", credit ? "text-emerald-600" : "text-foreground")}>
                      {credit ? "+" : "−"}{inr(Math.abs(total))}
                    </p>
                    <p className="text-[11px] text-muted">Bal {inr(t.cashAfter + t.promoAfter)}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {cursor && (
          <div className="mt-4 text-center">
            <Button variant="ghost" size="sm" onClick={loadMore} disabled={more}>
              {more && <Loader2 size={14} className="animate-spin" />} Load more
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}
