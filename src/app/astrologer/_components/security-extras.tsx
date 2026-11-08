"use client";

/**
 * Security extras for the partner panel.
 *
 * Two-step login: SMS OTP (demo code shown in a toast) or an authenticator
 * app. The authenticator option is REAL TOTP (RFC 6238, SHA-1, 30 s, 6 digits,
 * ±1 step) computed in the browser, so any authenticator app works with the
 * secret. 10 single-use backup codes; turning 2FA off or regenerating codes
 * needs a valid code. Enforcing it at sign-in needs the backend (next step).
 *
 * Devices and login history: the current device is real (from this browser);
 * other rows are DEMO. "Sign out" per device, "sign out all others", and a
 * "This wasn't me" flow.
 */

import { useState } from "react";
import { AlertTriangle, Copy, Download, KeyRound, Laptop, LogOut, MonitorSmartphone, ShieldAlert, ShieldCheck, Smartphone } from "lucide-react";
import { AdminButton, AdminInput, Badge, Card, Field, Modal, useAdminToast, useOnMount } from "@/app/admin/_components";
import { usePartner } from "./partner-context";
import { fmtDateTime, nowMs, timeAgo } from "./demo";
import { signedOutDevicesStore, twoStepStore, useStore } from "./demo-store";
import { deviceLabel } from "./agreement-text";

/* ---------------- TOTP (RFC 6238) ---------------- */
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
function randomSecret(len = 32) { const b = new Uint8Array(len); crypto.getRandomValues(b); return [...b].map((x) => B32[x % 32]).join(""); }
function base32ToBytes(s: string) {
  const clean = s.replace(/=+$/, "").replace(/\s/g, "").toUpperCase();
  let bits = 0, value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = B32.indexOf(ch);
    if (idx < 0) continue;
    value = (value << 5) | idx; bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 0xff); bits -= 8; }
  }
  return new Uint8Array(out);
}
export async function totp(secret: string, step: number) {
  const key = await crypto.subtle.importKey("raw", base32ToBytes(secret), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const msg = new ArrayBuffer(8);
  const view = new DataView(msg);
  view.setUint32(0, Math.floor(step / 2 ** 32));
  view.setUint32(4, step >>> 0);
  const h = new Uint8Array(await crypto.subtle.sign("HMAC", key, msg));
  const o = h[h.length - 1] & 0x0f;
  const code = (((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3]) % 1_000_000;
  return String(code).padStart(6, "0");
}
async function verifyTotp(secret: string, code: string) {
  const step = Math.floor(nowMs() / 30000);
  for (const d of [-1, 0, 1]) if ((await totp(secret, step + d)) === code) return true;
  return false;
}
const backupCodes = () => Array.from({ length: 10 }, () => { const s = randomSecret(8).replace(/[01]/g, "7"); return `${s.slice(0, 4)}-${s.slice(4)}`; });
const SECRET_KEY = "astro_demo_totp_secret";

/* ---------------- Two-step login ---------------- */
export function TwoStepCard() {
  const { me } = usePartner();
  const { toast } = useAdminToast();
  const state = useStore(twoStepStore);
  const [setup, setSetup] = useState<null | { method: "sms" | "app"; secret?: string; smsCode?: string }>(null);
  const [code, setCode] = useState("");
  const [codes, setCodes] = useState<string[] | null>(null);
  const [savedAck, setSavedAck] = useState(false);
  const [askOff, setAskOff] = useState<"off" | "regen" | null>(null);
  const [smsCheck, setSmsCheck] = useState<string | null>(null);
  if (!me) return null;
  const phone = me.phone ? `••••••${me.phone.slice(-4)}` : "your mobile";

  const begin = (method: "sms" | "app") => {
    setCode("");
    if (method === "app") setSetup({ method, secret: randomSecret() });
    else { const c = String(Math.floor(100000 + Math.random() * 900000)); setSetup({ method, smsCode: c }); toast(`Demo OTP sent to ${phone}: ${c}`, "info"); }
  };

  const confirm = async () => {
    if (!setup || code.length !== 6) return;
    const ok = setup.method === "app" ? await verifyTotp(setup.secret ?? "", code) : code === setup.smsCode;
    if (!ok) return toast("That code is not right. Check the time on your phone and try again.", "error");
    const list = backupCodes();
    if (setup.secret) localStorage.setItem(SECRET_KEY, setup.secret);
    twoStepStore.set({ method: setup.method, enabledAt: new Date(nowMs()).toISOString(), backupCodes: list, usedCodes: [] });
    setSetup(null);
    setCodes(list);
    setSavedAck(false);
    toast("Two-step login is on", "success");
  };

  /** Verify a code for sensitive actions: TOTP / SMS (demo) / backup code (single use). */
  const checkCode = async (c: string) => {
    const v = c.trim().toUpperCase();
    if (/^[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(v)) {
      if (state.backupCodes.includes(v) && !state.usedCodes.includes(v)) { twoStepStore.set({ ...state, usedCodes: [...state.usedCodes, v] }); return true; }
      return false;
    }
    if (state.method === "app") return verifyTotp(localStorage.getItem(SECRET_KEY) ?? "", v);
    return smsCheck !== null && v === smsCheck;
  };

  const openSensitive = (kind: "off" | "regen") => {
    setCode("");
    setAskOff(kind);
    if (state.method === "sms") { const c = String(Math.floor(100000 + Math.random() * 900000)); setSmsCheck(c); toast(`Demo OTP sent to ${phone}: ${c}`, "info"); }
  };

  const runSensitive = async () => {
    if (!(await checkCode(code))) return toast("Invalid code", "error");
    if (askOff === "off") { twoStepStore.set({ method: "off", enabledAt: null, backupCodes: [], usedCodes: [] }); localStorage.removeItem(SECRET_KEY); toast("Two-step login turned off", "info"); }
    else { const list = backupCodes(); twoStepStore.set({ ...twoStepStore.get(), backupCodes: list, usedCodes: [] }); setCodes(list); setSavedAck(false); toast("New backup codes created. Old ones no longer work.", "success"); }
    setAskOff(null);
    setSmsCheck(null);
    setCode("");
  };

  const downloadCodes = (list: string[]) => {
    const blob = new Blob([`Astrounkle Partner backup codes\n${me.displayName}\nCreated ${new Date(nowMs()).toLocaleString("en-IN")}\n\nEach code works once.\n\n${list.join("\n")}\n`], { type: "text/plain" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "astrounkle-backup-codes.txt"; a.click(); URL.revokeObjectURL(a.href);
  };

  const secretPretty = setup?.secret?.match(/.{1,4}/g)?.join(" ");
  const uri = setup?.secret ? `otpauth://totp/Astrounkle%20Partner:${encodeURIComponent(me.email)}?secret=${setup.secret}&issuer=Astrounkle&digits=6&period=30` : "";
  const left = state.backupCodes.filter((c) => !state.usedCodes.includes(c)).length;

  return (
    <Card className="space-y-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--a-fg)" }}><ShieldCheck size={16} /> Two-step login</p>
        <Badge tone={state.method === "off" ? "rose" : "green"}>{state.method === "off" ? "Off" : state.method === "app" ? "Authenticator app" : "SMS OTP"}</Badge>
      </div>
      {state.method === "off" && !setup && (
        <>
          <p className="text-sm" style={{ color: "var(--a-muted)" }}>Ask for a code after your password, so a stolen password alone cannot open your account or your payouts.</p>
          <div className="flex flex-wrap gap-2">
            <AdminButton onClick={() => begin("app")}><KeyRound size={15} /> Use an authenticator app</AdminButton>
            <AdminButton variant="outline" onClick={() => begin("sms")}><Smartphone size={15} /> Use SMS to {phone}</AdminButton>
          </div>
        </>
      )}
      {setup && (
        <div className="space-y-3">
          {setup.method === "app" ? (
            <>
              <p className="text-sm" style={{ color: "var(--a-fg)" }}>1. In Google Authenticator, Microsoft Authenticator or Authy, choose <b>Enter a setup key</b>.</p>
              <p className="text-sm" style={{ color: "var(--a-fg)" }}>2. Account: <b>Astrounkle Partner</b>, key:</p>
              <div className="flex items-center gap-2 rounded-lg px-3 py-2 font-mono text-sm tracking-wider" style={{ background: "var(--a-surface-2)", color: "var(--a-fg)" }}>
                <span className="flex-1 break-all">{secretPretty}</span>
                <button type="button" aria-label="Copy key" onClick={() => { void navigator.clipboard?.writeText(setup.secret ?? ""); toast("Key copied", "success"); }}><Copy size={15} /></button>
              </div>
              <details className="text-xs" style={{ color: "var(--a-muted)" }}><summary className="cursor-pointer">Setup link (for apps that accept a link)</summary><p className="mt-1 break-all font-mono">{uri}</p></details>
              <p className="text-sm" style={{ color: "var(--a-fg)" }}>3. Enter the 6-digit code the app shows.</p>
            </>
          ) : <p className="text-sm" style={{ color: "var(--a-fg)" }}>Enter the 6-digit code sent to {phone}.</p>}
          <div className="flex flex-wrap items-end gap-2">
            <Field label="Code"><AdminInput inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} className="w-36 tracking-[0.4em]" /></Field>
            <AdminButton onClick={confirm} disabled={code.length !== 6}>Turn on</AdminButton>
            <AdminButton variant="ghost" onClick={() => setSetup(null)}>Cancel</AdminButton>
          </div>
        </div>
      )}
      {state.method !== "off" && !setup && (
        <div className="space-y-2 text-sm">
          <p style={{ color: "var(--a-muted)" }}>On since {state.enabledAt ? fmtDateTime(state.enabledAt) : "–"} · {left} of 10 backup codes left</p>
          {left <= 3 && <p className="flex items-center gap-1.5 text-xs text-amber-700"><AlertTriangle size={13} /> Few backup codes left. Create new ones.</p>}
          <div className="flex flex-wrap gap-2">
            <AdminButton variant="outline" onClick={() => openSensitive("regen")}>New backup codes</AdminButton>
            <AdminButton variant="danger" onClick={() => openSensitive("off")}>Turn off</AdminButton>
          </div>
        </div>
      )}

      <Modal open={!!codes} onClose={() => savedAck && setCodes(null)} title="Save your backup codes" subtitle="Use one if you lose your phone. Each code works once. They are shown only now." size="sm">
        {codes && (
          <div className="space-y-4">
            <ul className="grid grid-cols-2 gap-2 rounded-lg p-3 font-mono text-sm" style={{ background: "var(--a-surface-2)", color: "var(--a-fg)" }}>{codes.map((c) => <li key={c}>{c}</li>)}</ul>
            <div className="flex gap-2">
              <AdminButton variant="outline" onClick={() => downloadCodes(codes)}><Download size={15} /> Download</AdminButton>
              <AdminButton variant="outline" onClick={() => { void navigator.clipboard?.writeText(codes.join("\n")); toast("Copied", "success"); }}><Copy size={15} /> Copy</AdminButton>
            </div>
            <label className="flex items-center gap-2 text-sm" style={{ color: "var(--a-fg)" }}><input type="checkbox" checked={savedAck} onChange={(e) => setSavedAck(e.target.checked)} /> I saved these codes somewhere safe</label>
            <AdminButton className="w-full" disabled={!savedAck} onClick={() => setCodes(null)}>Done</AdminButton>
          </div>
        )}
      </Modal>
      <Modal open={!!askOff} onClose={() => setAskOff(null)} title={askOff === "off" ? "Turn off two-step login?" : "Create new backup codes?"} subtitle="Enter a code from your app or SMS, or a backup code." size="sm">
        <div className="space-y-3">
          <AdminInput value={code} onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 9))} placeholder="123456 or ABCD-EFGH" aria-label="Code" />
          <AdminButton className="w-full" variant={askOff === "off" ? "danger" : "primary"} disabled={code.length < 6} onClick={runSensitive}>Confirm</AdminButton>
        </div>
      </Modal>
    </Card>
  );
}

/* ---------------- Devices + login history ---------------- */
const H = 3600_000;
interface Device { id: string; label: string; city: string; ip: string; lastActive: number; current?: boolean; kind: "phone" | "computer" }

export function DevicesCard({ onSignOutAll }: { onSignOutAll: () => void }) {
  const { toast } = useAdminToast();
  const out = useStore(signedOutDevicesStore);
  const [list, setList] = useState<Device[]>([]);
  const [wasntMe, setWasntMe] = useState(false);
  const [history, setHistory] = useState<{ at: number; device: string; city: string; ip: string; result: "success" | "wrong_password" | "wrong_otp" | "locked"; flag?: string }[]>([]);

  useOnMount(() => {
    const t = nowMs();
    const ua = navigator.userAgent;
    setList([
      { id: "this", label: deviceLabel(ua), city: "This device", ip: "49.36.xx.xx", lastActive: t, current: true, kind: /Android|iPhone|iPad/i.test(ua) ? "phone" : "computer" },
      { id: "d2", label: "Chrome on Android", city: "Jaipur, Rajasthan", ip: "49.36.xx.xx", lastActive: t - 2 * H, kind: "phone" },
      { id: "d3", label: "Safari on iOS", city: "Delhi", ip: "103.21.xx.xx", lastActive: t - 6 * 24 * H, kind: "phone" },
      { id: "d4", label: "Edge on Windows", city: "Jaipur, Rajasthan", ip: "49.36.xx.xx", lastActive: t - 19 * 24 * H, kind: "computer" },
    ]);
    setHistory([
      { at: t - 2 * 60000, device: deviceLabel(ua), city: "Jaipur", ip: "49.36.xx.xx", result: "success" },
      { at: t - 2 * H, device: "Chrome on Android", city: "Jaipur", ip: "49.36.xx.xx", result: "success" },
      { at: t - 30 * H, device: "Chrome on Windows", city: "Lucknow", ip: "117.98.xx.xx", result: "wrong_password", flag: "New city" },
      { at: t - 30 * H + 60000, device: "Chrome on Windows", city: "Lucknow", ip: "117.98.xx.xx", result: "wrong_password", flag: "New city" },
      { at: t - 30 * H + 120000, device: "Chrome on Windows", city: "Lucknow", ip: "117.98.xx.xx", result: "locked", flag: "5 failed tries" },
      { at: t - 6 * 24 * H, device: "Safari on iOS", city: "Delhi", ip: "103.21.xx.xx", result: "success", flag: "New device" },
      { at: t - 9 * 24 * H, device: "Chrome on Android", city: "Jaipur", ip: "49.36.xx.xx", result: "wrong_otp" },
      { at: t - 19 * 24 * H, device: "Edge on Windows", city: "Jaipur", ip: "49.36.xx.xx", result: "success" },
    ]);
  });

  const shown = list.filter((d) => !out.includes(d.id));
  const others = shown.filter((d) => !d.current);
  const RESULT = { success: { t: "Signed in", tone: "green" as const }, wrong_password: { t: "Wrong password", tone: "rose" as const }, wrong_otp: { t: "Wrong code", tone: "gold" as const }, locked: { t: "Locked for 15 min", tone: "rose" as const } };

  return (
    <>
      <Card className="space-y-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--a-fg)" }}><MonitorSmartphone size={16} /> Where you are signed in</p>
          {others.length > 0 && <AdminButton variant="outline" onClick={() => { signedOutDevicesStore.set((l) => [...l, ...others.map((d) => d.id)]); toast(`Signed out ${others.length} other device${others.length > 1 ? "s" : ""}`, "success"); }}><LogOut size={15} /> Sign out all others</AdminButton>}
        </div>
        <ul className="divide-y" style={{ borderColor: "var(--a-border)" }}>
          {shown.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
              {d.kind === "phone" ? <Smartphone size={18} style={{ color: "var(--a-muted)" }} /> : <Laptop size={18} style={{ color: "var(--a-muted)" }} />}
              <span className="min-w-0 flex-1"><span className="font-medium" style={{ color: "var(--a-fg)" }}>{d.label}</span> {d.current && <Badge tone="green">This device</Badge>}<span className="block text-xs" style={{ color: "var(--a-muted)" }}>{d.city} · IP {d.ip} · {d.current ? "active now" : `active ${timeAgo(new Date(d.lastActive).toISOString())}`}</span></span>
              {!d.current && <AdminButton variant="ghost" onClick={() => { signedOutDevicesStore.set((l) => [...l, d.id]); toast(`${d.label} signed out`, "success"); }}>Sign out</AdminButton>}
            </li>
          ))}
        </ul>
      </Card>

      <Card className="space-y-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold" style={{ color: "var(--a-fg)" }}>Login history</p>
          <AdminButton variant="ghost" onClick={() => setWasntMe(true)}><ShieldAlert size={15} /> Something looks wrong?</AdminButton>
        </div>
        <ul className="divide-y text-sm" style={{ borderColor: "var(--a-border)" }}>
          {history.map((h, i) => (
            <li key={i} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
              <span><span style={{ color: "var(--a-fg)" }}>{h.device} · {h.city}</span><span className="block text-xs" style={{ color: "var(--a-muted)" }}>{fmtDateTime(new Date(h.at).toISOString())} · IP {h.ip}</span></span>
              <span className="flex items-center gap-1.5">{h.flag && <Badge tone="gold">{h.flag}</Badge>}<Badge tone={RESULT[h.result].tone}>{RESULT[h.result].t}</Badge></span>
            </li>
          ))}
        </ul>
        <p className="text-[11px]" style={{ color: "var(--a-faint)" }}>Kept for 90 days. After 5 wrong passwords an account locks for 15 minutes and you get an email.</p>
      </Card>

      <Modal open={wasntMe} onClose={() => setWasntMe(false)} title="Secure your account" subtitle="If you do not recognise a sign-in, do these now." size="sm">
        <ol className="list-decimal space-y-2 pl-5 text-sm" style={{ color: "var(--a-fg)" }}>
          <li>Change your password (top of this page).</li>
          <li>Turn on two-step login.</li>
          <li>Sign out of every device, including this one.</li>
        </ol>
        <p className="mt-3 text-xs" style={{ color: "var(--a-muted)" }}>Payouts to a changed bank account pause for 24 hours, so your money stays safe while you do this.</p>
        <AdminButton className="mt-4 w-full" variant="danger" onClick={() => { setWasntMe(false); onSignOutAll(); }}>Sign out everywhere now</AdminButton>
      </Modal>
    </>
  );
}
