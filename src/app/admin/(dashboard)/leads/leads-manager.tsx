"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Mail, Phone, Inbox, RefreshCw } from "lucide-react";
import { adminApi } from "@/lib/admin-api";
import type { Lead, LeadStatus } from "@/modules/leads";
import { Card, PageHeader, StatusPill, AdminButton } from "../../_components/ui";
import { cn } from "@/lib/utils";

const STATUSES: LeadStatus[] = ["new", "contacted", "converted", "closed"];
const statusTone: Record<LeadStatus, "gold" | "blue" | "green" | "muted"> = {
  new: "gold",
  contacted: "blue",
  converted: "green",
  closed: "muted",
};

export function LeadsManager() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<LeadStatus | "all">("all");

  const load = async () => {
    setLoading(true);
    const res = await adminApi.leads.list();
    if (res.ok) setLeads(res.data);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const changeStatus = async (id: string, status: LeadStatus) => {
    // optimistic update
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status } : l)));
    await adminApi.leads.updateStatus(id, status);
  };

  const filtered = filter === "all" ? leads : leads.filter((l) => l.status === filter);

  return (
    <div>
      <PageHeader
        title="Leads"
        subtitle="Enquiries from the contact form and service bookings."
        action={
          <AdminButton variant="outline" onClick={load}>
            <RefreshCw size={15} /> Refresh
          </AdminButton>
        }
      />

      {/* filter tabs */}
      <div className="mb-5 flex flex-wrap gap-2">
        {(["all", ...STATUSES] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-sm font-medium capitalize transition-colors",
              filter === s
                ? "border-transparent bg-[var(--a-gold-soft)] text-[var(--a-gold)]"
                : "text-[var(--a-muted)] hover:text-[var(--a-fg)]"
            )}
            style={filter === s ? undefined : { borderColor: "var(--a-border)" }}
          >
            {s}
            {s !== "all" && (
              <span className="ml-1.5 opacity-70">
                {leads.filter((l) => l.status === s).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <Card>
          <p style={{ color: "var(--a-muted)" }}>Loading leads…</p>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center py-10 text-center">
            <Inbox size={28} style={{ color: "var(--a-muted)" }} />
            <p className="mt-3 font-medium" style={{ color: "var(--a-fg)" }}>
              No leads here
            </p>
            <p className="mt-1 text-sm" style={{ color: "var(--a-muted)" }}>
              New enquiries will appear here automatically.
            </p>
          </div>
        </Card>
      ) : (
        <motion.div
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }}
          initial="hidden"
          animate="show"
          className="space-y-3"
        >
          {filtered.map((lead) => (
            <Card
              key={lead.id}
              hover
              variants={{
                hidden: { opacity: 0, y: 14 },
                show: { opacity: 1, y: 0, transition: { duration: 0.35 } },
              }}
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold" style={{ color: "var(--a-fg)" }}>
                      {lead.name}
                    </p>
                    <StatusPill tone={lead.source === "service" ? "blue" : "muted"}>
                      {lead.source}
                    </StatusPill>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm" style={{ color: "var(--a-muted)" }}>
                    <a href={`mailto:${lead.email}`} className="flex items-center gap-1.5 hover:text-[var(--a-gold)]">
                      <Mail size={13} /> {lead.email}
                    </a>
                    {lead.phone && (
                      <a href={`tel:${lead.phone}`} className="flex items-center gap-1.5 hover:text-[var(--a-gold)]">
                        <Phone size={13} /> {lead.phone}
                      </a>
                    )}
                  </div>
                  {lead.topic && (
                    <p className="mt-2 text-sm" style={{ color: "var(--a-fg)" }}>
                      <span style={{ color: "var(--a-faint)" }}>Topic:</span> {lead.topic}
                    </p>
                  )}
                  {lead.message && (
                    <p className="mt-1 text-sm" style={{ color: "var(--a-muted)" }}>
                      {lead.message}
                    </p>
                  )}
                  {lead.birth?.date && (
                    <p className="mt-1 text-xs" style={{ color: "var(--a-faint)" }}>
                      Birth: {lead.birth.date} {lead.birth.time} · {lead.birth.place}
                    </p>
                  )}
                </div>

                <div className="flex flex-col items-end gap-2">
                  <span className="text-xs" style={{ color: "var(--a-faint)" }}>
                    {new Date(lead.createdAt).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                  <StatusPill tone={statusTone[lead.status]}>{lead.status}</StatusPill>
                  {/* status changer */}
                  <div className="flex gap-1">
                    {STATUSES.map((s) => (
                      <button
                        key={s}
                        onClick={() => changeStatus(lead.id, s)}
                        title={`Mark ${s}`}
                        className={cn(
                          "rounded-md px-2 py-1 text-[11px] font-medium capitalize transition-colors",
                          lead.status === s
                            ? "bg-[var(--a-gold)] text-white"
                            : "text-[var(--a-muted)] hover:bg-black/[0.04]"
                        )}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </motion.div>
      )}
    </div>
  );
}
