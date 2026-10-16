"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  Database,
  Server,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";
import { PageHeader, AdminButton } from "../../_components";

interface HealthReport {
  status: "ok" | "degraded";
  server: { up: true; time: string; uptimeSec: number; nodeEnv: string };
  globalDataSource: "mock" | "mongo";
  modulesOnMongo: string[];
  modulesOnMock: string[];
  database: {
    configured: boolean;
    used: boolean;
    connected: boolean;
    name: string | null;
    servicesCount: number | null;
    pingMs: number | null;
    error: string | null;
  };
}

type FetchState =
  | { phase: "loading" }
  | { phase: "ok"; report: HealthReport; latencyMs: number }
  | { phase: "error"; message: string };

const POLL_MS = 5000;

export function HealthView() {
  const [state, setState] = useState<FetchState>({ phase: "loading" });
  const [auto, setAuto] = useState(true);
  const [lastChecked, setLastChecked] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const check = useCallback(async () => {
    const started = Date.now();
    try {
      const res = await fetch("/api/v1/health", { cache: "no-store" });
      const report = (await res.json()) as HealthReport;
      setState({ phase: "ok", report, latencyMs: Date.now() - started });
    } catch (e) {
      setState({
        phase: "error",
        message: e instanceof Error ? e.message : "Request failed",
      });
    }
    setLastChecked(new Date().toLocaleTimeString());
  }, []);

  useEffect(() => {
    check();
  }, [check]);

  useEffect(() => {
    if (!auto) {
      if (timer.current) clearTimeout(timer.current);
      return;
    }
    const tick = () => {
      check().finally(() => {
        timer.current = setTimeout(tick, POLL_MS);
      });
    };
    timer.current = setTimeout(tick, POLL_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [auto, check]);

  const report = state.phase === "ok" ? state.report : null;
  const serverUp = state.phase === "ok";
  const dbUsed = report?.database.used ?? false;
  const dbOk = report?.database.connected ?? false;

  return (
    <div>
      <PageHeader
        title="System Health"
        subtitle="Live status of the backend server and database connection."
        action={
          <div className="flex items-center gap-2">
            <AdminButton
              variant={auto ? "outline" : "ghost"}
              onClick={() => setAuto((a) => !a)}
            >
              <Activity size={16} />
              {auto ? "Auto-refresh: on" : "Auto-refresh: off"}
            </AdminButton>
            <AdminButton onClick={() => check()}>
              <RefreshCw size={16} />
              Check now
            </AdminButton>
          </div>
        }
      />

      {/* Overall banner */}
      <OverallBanner state={state} />

      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatusCard
          icon={<Server size={18} />}
          label="Backend server"
          ok={serverUp}
          okText="Running"
          failText="Unreachable"
          lines={
            report
              ? [
                  ["Environment", report.server.nodeEnv],
                  ["Uptime", `${report.server.uptimeSec}s`],
                  [
                    "Response time",
                    state.phase === "ok" ? `${state.latencyMs} ms` : "—",
                  ],
                ]
              : []
          }
        />

        <StatusCard
          icon={<Database size={18} />}
          label="Database"
          // DB is only "used" when at least one module is on Mongo.
          ok={dbUsed ? dbOk : true}
          okText={dbUsed ? "Connected" : "Not used yet (all modules on mock)"}
          failText="Disconnected"
          lines={
            report
              ? dbUsed
                ? [
                    ["Database", report.database.name ?? "—"],
                    [
                      "Services in DB",
                      report.database.servicesCount?.toString() ?? "—",
                    ],
                    ["Ping", report.database.pingMs != null ? `${report.database.pingMs} ms` : "—"],
                  ]
                : [["Note", "Set DATA_SOURCE_<MODULE>=mongo to migrate a module"]]
              : []
          }
          error={dbUsed ? report?.database.error ?? null : null}
        />

        <StatusCard
          icon={<Clock size={18} />}
          label="Migration progress"
          ok
          okText={
            report
              ? `${report.modulesOnMongo.length} on MongoDB · ${report.modulesOnMock.length} on mock`
              : "—"
          }
          failText="—"
          lines={
            report
              ? [
                  ["On MongoDB", report.modulesOnMongo.join(", ") || "none"],
                  ["Global default", report.globalDataSource],
                  ["Last checked", lastChecked ?? "—"],
                ]
              : []
          }
        />
      </div>
    </div>
  );
}

function OverallBanner({ state }: { state: FetchState }) {
  let tone: "green" | "amber" | "red";
  let text: string;

  if (state.phase === "loading") {
    tone = "amber";
    text = "Checking system status…";
  } else if (state.phase === "error") {
    tone = "red";
    text = "Cannot reach the backend server.";
  } else if (state.report.status === "degraded") {
    tone = "amber";
    text = "Server is up but the database is not reachable.";
  } else {
    tone = "green";
    text =
      state.report.database.used
        ? "All systems operational — server and database are healthy."
        : "Server is operational (all modules on mock data).";
  }

  const palette = {
    green: { bg: "rgba(16,185,129,0.1)", bd: "rgba(16,185,129,0.35)", fg: "#047857", Icon: CheckCircle2 },
    amber: { bg: "rgba(234,179,8,0.1)", bd: "rgba(234,179,8,0.4)", fg: "#92400e", Icon: Clock },
    red: { bg: "rgba(244,63,94,0.1)", bd: "rgba(244,63,94,0.4)", fg: "#be123c", Icon: XCircle },
  }[tone];

  const { Icon } = palette;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-3 rounded-xl border px-4 py-3.5"
      style={{ background: palette.bg, borderColor: palette.bd, color: palette.fg }}
    >
      <Icon size={20} />
      <span className="text-sm font-semibold">{text}</span>
    </motion.div>
  );
}

function StatusCard({
  icon,
  label,
  ok,
  okText,
  failText,
  lines,
  error,
}: {
  icon: React.ReactNode;
  label: string;
  ok: boolean;
  okText: string;
  failText: string;
  lines: Array<[string, string]>;
  error?: string | null;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border p-5"
      style={{ borderColor: "var(--a-border)", background: "var(--a-surface)" }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2" style={{ color: "var(--a-muted)" }}>
          {icon}
          <span className="text-sm font-medium">{label}</span>
        </div>
        <span
          className="inline-flex h-2.5 w-2.5 rounded-full"
          style={{ background: ok ? "#10b981" : "#f43f5e" }}
        />
      </div>

      <p
        className="mt-3 text-lg font-semibold"
        style={{ color: ok ? "var(--a-fg)" : "#be123c" }}
      >
        {ok ? okText : failText}
      </p>

      <dl className="mt-3 space-y-1.5">
        {lines.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between text-sm">
            <dt style={{ color: "var(--a-faint)" }}>{k}</dt>
            <dd className="font-medium" style={{ color: "var(--a-fg)" }}>
              {v}
            </dd>
          </div>
        ))}
      </dl>

      {error && (
        <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {error}
        </p>
      )}
    </motion.div>
  );
}
