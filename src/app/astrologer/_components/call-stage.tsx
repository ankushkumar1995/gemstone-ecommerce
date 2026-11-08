"use client";

/**
 * Voice / video call stage (DEMO media). The UI and rules are final; the media
 * will come from the calling provider (Agora / 100ms) later.
 *   • "Connecting" until both sides join (customer has JOIN_TIMEOUT_SEC)
 *   • billing starts when connected and pauses while reconnecting
 *   • a drop longer than RECONNECT_SEC ends the call (lost time is not billed)
 *   • mute, speaker, camera on/off, and your own camera preview (real, via
 *     getUserMedia) for video, with clear errors when permission is denied
 */

import { useEffect, useRef, useState } from "react";
import { Camera, CameraOff, Mic, MicOff, Signal, SignalLow, Volume2, VolumeX, WifiOff } from "lucide-react";
import { AdminButton, Avatar } from "@/app/admin/_components";
import { nowMs } from "./demo";

export const RECONNECT_SEC = 30;
export const JOIN_TIMEOUT_SEC = 45;

export type CallPhase = "connecting" | "connected" | "reconnecting" | "ended";

export function CallStage({ video, customer, ended, onConnected, onPauseChange, onFail }: {
  video: boolean;
  customer: string;
  ended: boolean;
  onConnected: (at: number) => void;
  /** Called with true when a drop starts and false (plus paused ms) when it recovers. */
  onPauseChange: (paused: boolean, pausedMs?: number) => void;
  onFail: (reason: string) => void;
}) {
  const [phase, setPhase] = useState<CallPhase>("connecting");
  const [muted, setMuted] = useState(false);
  const [speaker, setSpeaker] = useState(true);
  const [cam, setCam] = useState(video);
  const [camError, setCamError] = useState<string | null>(null);
  const [quality, setQuality] = useState<"good" | "weak">("good");
  const [dropLeft, setDropLeft] = useState(RECONNECT_SEC);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const dropStart = useRef<number | null>(null);

  // Demo: the customer joins after ~3s.
  useEffect(() => {
    if (ended) return;
    const t = setTimeout(() => { setPhase("connected"); onConnected(nowMs()); }, 3000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Local camera preview for video calls.
  useEffect(() => {
    if (!video || !cam || ended) return;
    let stopped = false;
    if (!navigator.mediaDevices?.getUserMedia) { const t = setTimeout(() => setCamError("This browser cannot use the camera."), 0); return () => clearTimeout(t); }
    navigator.mediaDevices.getUserMedia({ video: true, audio: false }).then((s) => {
      if (stopped) { s.getTracks().forEach((t) => t.stop()); return; }
      streamRef.current = s;
      setCamError(null);
      if (videoRef.current) videoRef.current.srcObject = s;
    }).catch((e: unknown) => {
      const name = e instanceof DOMException ? e.name : "";
      setCamError(name === "NotAllowedError" ? "Camera permission was denied. Allow it from the address bar." : name === "NotFoundError" ? "No camera found." : "Could not start the camera.");
    });
    return () => { stopped = true; streamRef.current?.getTracks().forEach((t) => t.stop()); streamRef.current = null; };
  }, [video, cam, ended]);

  // Reconnect countdown.
  useEffect(() => {
    if (phase !== "reconnecting") return;
    const id = setInterval(() => {
      const started = dropStart.current ?? nowMs();
      const left = RECONNECT_SEC - Math.floor((nowMs() - started) / 1000);
      setDropLeft(Math.max(0, left));
      if (left <= 0) { clearInterval(id); setPhase("ended"); onFail(`Call dropped for over ${RECONNECT_SEC} seconds`); }
    }, 1000);
    return () => clearInterval(id);
  }, [phase, onFail]);

  const simulateDrop = () => {
    if (phase !== "connected") return;
    dropStart.current = nowMs();
    setDropLeft(RECONNECT_SEC);
    setPhase("reconnecting");
    onPauseChange(true);
  };
  const simulateRecover = () => {
    if (phase !== "reconnecting") return;
    const paused = nowMs() - (dropStart.current ?? nowMs());
    dropStart.current = null;
    setPhase("connected");
    onPauseChange(false, paused);
  };

  const status = ended ? "Call ended" : phase === "connecting" ? `Calling ${customer}…` : phase === "reconnecting" ? `Reconnecting… ${dropLeft}s` : "Connected";

  return (
    <div className="flex h-full flex-col">
      <div className="relative flex flex-1 items-center justify-center overflow-hidden rounded-t-lg bg-gradient-to-b from-[#1f1638] to-[#2d2150] text-white">
        <div className="flex flex-col items-center gap-3">
          <Avatar name={customer} size={88} />
          <p className="text-lg font-semibold">{customer}</p>
          <p className="flex items-center gap-2 text-sm text-white/80" aria-live="polite">
            {phase === "reconnecting" ? <WifiOff size={15} /> : quality === "good" ? <Signal size={15} /> : <SignalLow size={15} />}
            {status}
          </p>
          {video && phase === "connected" && <p className="text-xs text-white/60">Customer camera is off</p>}
          {phase === "reconnecting" && <p className="max-w-xs text-center text-xs text-white/70">Billing is paused. If the call does not come back in {RECONNECT_SEC} seconds it ends, and the customer pays only for connected time.</p>}
        </div>
        {video && (
          <div className="absolute bottom-3 right-3 h-36 w-28 overflow-hidden rounded-lg border border-white/20 bg-black/40">
            {cam && !camError ? <video ref={videoRef} autoPlay playsInline muted className="h-full w-full -scale-x-100 object-cover" aria-label="Your camera" /> : <div className="flex h-full items-center justify-center p-2 text-center text-[11px] text-white/70">{camError ?? "Camera off"}</div>}
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2 rounded-b-lg border-t p-3" style={{ borderColor: "var(--a-border)" }}>
        <AdminButton variant={muted ? "danger" : "outline"} onClick={() => setMuted((v) => !v)} aria-pressed={muted} disabled={ended}>{muted ? <MicOff size={16} /> : <Mic size={16} />}{muted ? "Unmute" : "Mute"}</AdminButton>
        <AdminButton variant="outline" onClick={() => setSpeaker((v) => !v)} aria-pressed={speaker} disabled={ended}>{speaker ? <Volume2 size={16} /> : <VolumeX size={16} />}Speaker</AdminButton>
        {video && <AdminButton variant={cam ? "outline" : "danger"} onClick={() => setCam((v) => !v)} aria-pressed={!cam} disabled={ended}>{cam ? <Camera size={16} /> : <CameraOff size={16} />}{cam ? "Camera off" : "Camera on"}</AdminButton>}
        <span className="mx-2 h-6 w-px" style={{ background: "var(--a-border)" }} aria-hidden />
        <span className="text-xs" style={{ color: "var(--a-faint)" }}>Demo:</span>
        <AdminButton variant="ghost" onClick={() => setQuality((q) => (q === "good" ? "weak" : "good"))} disabled={ended || phase !== "connected"}>Weak network</AdminButton>
        {phase === "reconnecting" ? <AdminButton variant="ghost" onClick={simulateRecover}>Reconnect</AdminButton> : <AdminButton variant="ghost" onClick={simulateDrop} disabled={ended || phase !== "connected"}>Drop call</AdminButton>}
      </div>
      {quality === "weak" && phase === "connected" && <p className="px-3 pb-2 text-center text-xs text-amber-700">Weak network on your side. Move closer to Wi-Fi or switch off video.</p>}
    </div>
  );
}
