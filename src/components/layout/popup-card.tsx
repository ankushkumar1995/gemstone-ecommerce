"use client";

/**
 * PopupCard — pure presentation for a single popup. Renders content by type
 * (promo / newsletter / lead / announcement / html) inside the chosen layout
 * (center / corner / top-bar / bottom-bar / fullscreen) with the admin's
 * design options applied. All behaviour (when to show, analytics, frequency)
 * lives in PopupManager; this component only renders + calls back.
 */

import { useState, type CSSProperties, type FormEvent } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import type { PublicPopup } from "@/modules/popups";
import { cn } from "@/lib/utils";

/** Minimal allowlist sanitiser for custom-HTML popups (no deps). Strips
 *  <script>/<style>/<iframe>, event-handler attributes and javascript: URLs. */
export function sanitizeHtml(html: string): string {
  return html
    .replace(/<\s*(script|style|iframe|object|embed|link|meta)[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/<\s*(script|style|iframe|object|embed|link|meta)[^>]*\/?>/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(href|src)\s*=\s*("javascript:[^"]*"|'javascript:[^']*')/gi, "$1=\"#\"");
}

const radiusMap = { none: "0px", soft: "18px", round: "28px" } as const;
// Wider, more "standard" popup sizes.
const widthMap = { sm: "34rem", md: "46rem", lg: "60rem" } as const;

export interface PopupCardProps {
  popup: PublicPopup;
  onClose: (opts?: { dontShowAgain?: boolean }) => void;
  onCtaClick: (href: string) => void;
  onSubmit: (data: { email: string; name?: string; phone?: string; message?: string }) => Promise<boolean>;
}

export function PopupCard({ popup, onClose, onCtaClick, onSubmit }: PopupCardProps) {
  const { design, content, type } = popup;
  const accent = design.accentColor || "#c9942a";
  const bg = design.backgroundColor || "#ffffff";
  const fg = design.textColor || "#1a1333";

  const isBar = design.layout === "top-bar" || design.layout === "bottom-bar";
  const isFull = design.layout === "fullscreen";

  const cardStyle: CSSProperties = {
    background: bg,
    color: fg,
    borderRadius: isBar || isFull ? "0px" : radiusMap[design.radius],
    width: isBar || isFull ? "100%" : "min(92vw, " + widthMap[design.width] + ")",
    "--nk-accent": accent,
  } as CSSProperties;

  const positionWrap = cn(
    "pointer-events-none fixed z-[60] flex",
    design.layout === "center" && "inset-0 items-center justify-center p-4",
    isFull && "inset-0 items-center justify-center",
    design.layout === "top-bar" && "inset-x-0 top-0 justify-center",
    design.layout === "bottom-bar" && "inset-x-0 bottom-0 justify-center",
    design.layout === "corner" && cornerClass(popup),
  );

  const entrance = getEntrance(design.layout);

  return (
    <>
      {design.overlay && (design.layout === "center" || isFull) && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => design.closeOnOverlayClick && onClose()}
          className="fixed inset-0 z-[59] bg-black/60 backdrop-blur-sm"
          aria-hidden
        />
      )}

      <div className={positionWrap}>
        <motion.div
          role="dialog"
          aria-modal={design.layout === "center" || isFull}
          aria-label={content.heading || "Popup"}
          initial={entrance.initial}
          animate={entrance.animate}
          exit={entrance.initial}
          transition={{ type: "spring", stiffness: 300, damping: 26 }}
          style={cardStyle}
          className={cn(
            "pointer-events-auto relative overflow-hidden shadow-[0_30px_80px_-24px_rgba(20,15,40,0.55)]",
            isBar ? "flex items-center gap-4 px-5 py-3" : "",
            isFull ? "flex h-full w-full flex-col items-center justify-center p-8 text-center" : "",
            !isBar && !isFull ? "max-h-[90vh] overflow-y-auto" : "",
          )}
        >
          {design.showClose && (
            <button
              onClick={() => onClose()}
              aria-label="Close"
              className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/80 text-neutral-800 shadow-sm backdrop-blur-sm transition-colors hover:bg-white"
            >
              <X size={16} />
            </button>
          )}

          {type === "html" ? (
            <div
              className={cn(!isBar && !isFull && "p-6")}
              // Sanitised above; admin-authored content.
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(content.html || "") }}
            />
          ) : design.imageOnly && content.image ? (
            <ImageOnly popup={popup} onCtaClick={onCtaClick} />
          ) : (
            <Body
              popup={popup}
              accent={accent}
              isBar={isBar}
              onCtaClick={onCtaClick}
              onSubmit={onSubmit}
            />
          )}
        </motion.div>
      </div>
    </>
  );
}

/** Image-only popup: the whole modal is the image. If a first CTA link is set,
 *  clicking anywhere on the image follows it. */
function ImageOnly({
  popup,
  onCtaClick,
}: {
  popup: PublicPopup;
  onCtaClick: (href: string) => void;
}) {
  const { content } = popup;
  const link = content.ctas[0]?.href;
  return (
    <div className="w-full overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={content.image}
        alt={content.heading || ""}
        onClick={() => link && onCtaClick(link)}
        className={cn(
          "block h-auto max-h-[82vh] w-full object-contain",
          link && "cursor-pointer",
        )}
      />
    </div>
  );
}

function Body({
  popup,
  accent,
  isBar,
  onCtaClick,
  onSubmit,
}: {
  popup: PublicPopup;
  accent: string;
  isBar: boolean;
  onCtaClick: (href: string) => void;
  onSubmit: PopupCardProps["onSubmit"];
}) {
  const { content, type } = popup;
  const showForm = type === "newsletter" || type === "lead";
  // Is there anything to show in the text/content area?
  const hasContent =
    Boolean(content.heading) ||
    Boolean(content.body) ||
    Boolean(content.couponCode) ||
    showForm ||
    content.ctas.length > 0;

  return (
    <div className={cn(isBar ? "flex w-full flex-wrap items-center justify-center gap-3" : "")}>
      {!isBar && content.image && (
        <div className="w-full overflow-hidden">
          {/* Fill the full popup width, keep the image's own proportions
              (no side gaps, no cropping). Tall images are capped by height. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={content.image}
            alt={content.heading || ""}
            className="block h-auto max-h-[26rem] w-full object-cover"
          />
        </div>
      )}

      {hasContent && (
      <div className={cn(isBar ? "flex flex-wrap items-center justify-center gap-x-3 gap-y-2" : "p-6")}>
        {content.heading && (
          <h3 className={cn("font-display font-semibold", isBar ? "text-base" : "text-2xl")}>
            {content.heading}
          </h3>
        )}
        {content.body && (
          <p className={cn("opacity-80", isBar ? "text-sm" : "mt-2 text-sm leading-relaxed")}>
            {content.body}
          </p>
        )}

        {content.couponCode && (
          <div className="mt-3 inline-flex items-center gap-2 rounded-lg border border-dashed px-3 py-1.5 text-sm font-semibold" style={{ borderColor: accent, color: accent }}>
            <span className="opacity-60">Code:</span> {content.couponCode}
          </div>
        )}

        {showForm && <PopupForm popup={popup} accent={accent} onSubmit={onSubmit} />}

        {content.ctas.length > 0 && (
          <div className={cn("flex flex-wrap gap-2", isBar ? "" : "mt-4")}>
            {content.ctas.map((c, i) => (
              <button
                key={i}
                onClick={() => onCtaClick(c.href)}
                className={cn(
                  "rounded-full px-5 py-2 text-sm font-semibold transition-transform hover:scale-[1.03]",
                  c.style === "ghost" && "bg-black/5 text-current",
                  c.style === "secondary" && "border",
                )}
                style={
                  c.style === "primary"
                    ? { background: accent, color: "#fff" }
                    : c.style === "secondary"
                      ? { borderColor: accent, color: accent }
                      : undefined
                }
              >
                {c.label}
              </button>
            ))}
          </div>
        )}
      </div>
      )}
    </div>
  );
}

function PopupForm({
  popup,
  accent,
  onSubmit,
}: {
  popup: PublicPopup;
  accent: string;
  onSubmit: PopupCardProps["onSubmit"];
}) {
  const { content, type } = popup;
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const isLead = type === "lead";

  const handle = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const okFlag = await onSubmit({
      email,
      name: name || undefined,
      phone: phone || undefined,
      message: message || undefined,
    });
    setSubmitting(false);
    if (okFlag) setDone(true);
    else setError("Something went wrong. Please try again.");
  };

  if (done) {
    return (
      <p className="mt-4 rounded-lg bg-black/5 px-4 py-3 text-sm">
        {content.successMessage || "Thank you! We'll be in touch soon."}
      </p>
    );
  }

  const inputCls =
    "w-full rounded-lg border border-black/15 bg-white/60 px-3 py-2.5 text-sm text-neutral-900 outline-none focus:border-current";

  return (
    <form onSubmit={handle} className="mt-4 space-y-2.5">
      {isLead && (
        <>
          <input className={inputCls} placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
          <input className={inputCls} placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </>
      )}
      <input
        className={inputCls}
        type="email"
        required
        placeholder={content.emailPlaceholder || "you@example.com"}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      {isLead && (
        <textarea
          className={cn(inputCls, "resize-none")}
          rows={3}
          placeholder="How can we help?"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
      )}
      {error && <p className="text-xs text-rose-600">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-full px-5 py-2.5 text-sm font-semibold text-white transition-transform hover:scale-[1.02] disabled:opacity-60"
        style={{ background: accent }}
      >
        {submitting ? "Submitting…" : content.submitLabel || (isLead ? "Request Callback" : "Subscribe")}
      </button>
    </form>
  );
}

function cornerClass(popup: PublicPopup): string {
  switch (popup.design.corner) {
    case "bottom-left":
      return "bottom-0 left-0 items-end justify-start p-4 sm:p-6";
    case "top-right":
      return "top-0 right-0 items-start justify-end p-4 sm:p-6";
    case "top-left":
      return "top-0 left-0 items-start justify-start p-4 sm:p-6";
    case "bottom-right":
    default:
      return "bottom-0 right-0 items-end justify-end p-4 sm:p-6";
  }
}

function getEntrance(layout: PublicPopup["design"]["layout"]) {
  switch (layout) {
    case "top-bar":
      return { initial: { y: "-100%", opacity: 0 }, animate: { y: 0, opacity: 1 } };
    case "bottom-bar":
      return { initial: { y: "100%", opacity: 0 }, animate: { y: 0, opacity: 1 } };
    case "corner":
      return { initial: { y: 24, opacity: 0, scale: 0.96 }, animate: { y: 0, opacity: 1, scale: 1 } };
    case "fullscreen":
      return { initial: { opacity: 0, scale: 1.02 }, animate: { opacity: 1, scale: 1 } };
    case "center":
    default:
      return { initial: { opacity: 0, scale: 0.94, y: 16 }, animate: { opacity: 1, scale: 1, y: 0 } };
  }
}
