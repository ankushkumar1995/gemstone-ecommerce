import Link from "next/link";
import { Gem } from "lucide-react";

/** Centered card used by the partner login / apply / password pages. */
export function AuthFrame({ title, subtitle, children, wide = false, footer }: { title: string; subtitle?: string; children: React.ReactNode; wide?: boolean; footer?: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-start justify-center px-4 py-10 sm:items-center">
      <div className={wide ? "w-full max-w-2xl" : "w-full max-w-md"}>
        <Link href="/" className="mb-6 flex items-center justify-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#e6b43a] to-[#9169ff] text-white shadow-sm"><Gem size={20} /></span>
          <span className="text-lg font-semibold" style={{ color: "var(--a-fg)" }}>Astrounkle <span style={{ color: "var(--a-gold)" }}>Partner</span></span>
        </Link>
        <div className="rounded-2xl border p-6 shadow-sm sm:p-8" style={{ borderColor: "var(--a-border)", background: "var(--a-surface)" }}>
          <h1 className="text-xl font-semibold" style={{ color: "var(--a-fg)" }}>{title}</h1>
          {subtitle && <p className="mt-1 text-sm" style={{ color: "var(--a-muted)" }}>{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
        {footer && <div className="mt-5 text-center text-sm" style={{ color: "var(--a-muted)" }}>{footer}</div>}
      </div>
    </div>
  );
}

/** Inline error box for forms. */
export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return <p role="alert" className="rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-700">{message}</p>;
}

/** Turn API validation details into a field → message map. */
export function fieldErrors(details: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (Array.isArray(details)) for (const d of details as { field?: string; message?: string }[]) if (d?.field && d.message && !out[d.field]) out[d.field] = d.message;
  return out;
}
