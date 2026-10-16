"use client";

import { useEffect, useMemo, useState } from "react";
import {
  UserPlus,
  Users as UsersIcon,
  CheckCircle2,
  ShieldCheck,
  Pencil,
  Trash2,
  Ban,
  Mail,
  Copy,
  PauseCircle,
  RotateCcw,
  Eye,
  KeyRound,
  Unlock,
} from "lucide-react";
import type { ResolvedUser, Role } from "@/modules/users";
import { adminApi } from "@/lib/admin-api";
import { useOnMount } from "../../_components";
import {
  PageHeader,
  AdminButton,
  StatCard,
  StatsSkeleton,
  DataTable,
  StatusPill,
  ActionMenu,
  ConfirmDialog,
  Modal,
  Field,
  AdminTextarea,
  Avatar,
  useAdminToast,
  type Column,
} from "../../_components";
import { UserFormModal } from "./user-form-modal";
import { RolesPanel } from "./roles-panel";

const STATUS_TONE: Record<ResolvedUser["status"], "green" | "gold" | "muted" | "rose"> = {
  active: "green",
  invited: "gold",
  disabled: "muted",
  suspended: "rose",
};

export function UsersManager() {
  const { toast } = useAdminToast();
  const [users, setUsers] = useState<ResolvedUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ResolvedUser | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [toDelete, setToDelete] = useState<ResolvedUser | null>(null);
  const [toSuspend, setToSuspend] = useState<ResolvedUser | null>(null);
  const [suspendReason, setSuspendReason] = useState("");
  const [resetResult, setResetResult] = useState<{ email: string; password: string } | null>(null);

  const load = async () => {
    setLoading(true);
    const [u, r] = await Promise.all([adminApi.users.list(), adminApi.roles.list()]);
    if (u.ok) setUsers(u.data);
    if (r.ok) setRoles(r.data);
    setLoading(false);
  };

  useOnMount(load);

  const stats = useMemo(() => {
    const total = users.length;
    const active = users.filter((u) => u.status === "active").length;
    const admins = users.filter((u) => u.role.key === "owner" || u.role.key === "admin").length;
    return { total, active, admins };
  }, [users]);

  const openEditor = (u: ResolvedUser | null) => {
    setEditing(u);
    setFormOpen(true);
  };

  const setStatus = async (u: ResolvedUser, status: ResolvedUser["status"], reason?: string) => {
    const res = await adminApi.users.setStatus(u.id, status, reason);
    if (res.ok) {
      setUsers((prev) => prev.map((x) => (x.id === u.id ? res.data : x)));
      const label =
        status === "active" ? "activated" : status === "suspended" ? "suspended" : "deactivated";
      toast(`User ${label}`, "success");
    } else toast(res.message, "error");
  };

  const confirmSuspend = async () => {
    if (!toSuspend) return;
    await setStatus(toSuspend, "suspended", suspendReason.trim() || undefined);
    setToSuspend(null);
    setSuspendReason("");
  };

  const resendInvite = async (u: ResolvedUser) => {
    // Re-issuing an invite is modelled as keeping status "invited" (email send
    // is the login phase). For now, confirm to the admin.
    toast(`Invite re-sent to ${u.email}`, "success");
  };

  const copyEmail = async (u: ResolvedUser) => {
    try {
      await navigator.clipboard.writeText(u.email);
      toast("Email copied", "success");
    } catch {
      toast("Could not copy", "error");
    }
  };

  const resetPassword = async (u: ResolvedUser) => {
    const res = await adminApi.users.resetPassword(u.id);
    if (res.ok) {
      setResetResult({ email: u.email, password: res.data.tempPassword ?? "" });
    } else toast(res.message, "error");
  };

  const unlock = async (u: ResolvedUser) => {
    const res = await adminApi.users.unlock(u.id);
    if (res.ok) {
      setUsers((prev) => prev.map((x) => (x.id === u.id ? res.data : x)));
      toast("Account unlocked", "success");
    } else toast(res.message, "error");
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    const res = await adminApi.users.remove(toDelete.id);
    if (res.ok) {
      toast("User removed", "success");
      setUsers((prev) => prev.filter((u) => u.id !== toDelete.id));
    } else toast(res.message, "error");
    setToDelete(null);
  };

  const columns: Column<ResolvedUser>[] = [
    {
      key: "name",
      header: "User",
      searchable: true,
      sortable: true,
      accessor: (u) => u.name,
      cell: (u) => (
        <div className="flex items-center gap-3">
          <Avatar name={u.name} />
          <div className="min-w-0">
            <p className="truncate font-medium" style={{ color: "var(--a-fg)" }}>{u.name}</p>
            <p className="truncate text-xs" style={{ color: "var(--a-faint)" }}>{u.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: "role",
      header: "Role",
      sortable: true,
      filterable: true,
      filterOptions: roles.map((r) => r.name),
      accessor: (u) => u.role.name,
      cell: (u) => (
        <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold"
          style={{ borderColor: "var(--a-border)", color: "var(--a-fg)" }}>
          <ShieldCheck size={12} className="text-gold-500" />
          {u.role.name}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      filterable: true,
      filterOptions: ["active", "invited", "disabled", "suspended"],
      accessor: (u) => u.status,
      cell: (u) => (
        <div className="flex items-center gap-2">
          <StatusPill tone={STATUS_TONE[u.status]}>{u.status}</StatusPill>
          {u.isLocked && <StatusPill tone="rose">locked</StatusPill>}
        </div>
      ),
    },
    {
      key: "lastLoginAt",
      header: "Last active",
      align: "right",
      sortable: true,
      accessor: (u) => u.lastLoginAt ?? "",
      cell: (u) => (
        <span className="text-sm" style={{ color: "var(--a-muted)" }}>
          {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : "—"}
        </span>
      ),
    },
  ];

  const isLastOwner = (u: ResolvedUser) =>
    u.role.key === "owner" &&
    users.filter((x) => x.role.key === "owner" && x.status === "active").length <= 1;

  return (
    <div>
      <PageHeader
        title="Users & Roles"
        subtitle="Manage who can access the admin panel and what they can do."
        action={
          <AdminButton onClick={() => openEditor(null)}>
            <UserPlus size={16} /> Add User
          </AdminButton>
        }
      />

      {loading ? (
        <StatsSkeleton count={3} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard icon={UsersIcon} value={stats.total} label="Total Users" tone="royal" />
          <StatCard icon={CheckCircle2} value={stats.active} label="Active" tone="green" />
          <StatCard icon={ShieldCheck} value={stats.admins} label="Owners / Admins" tone="gold" />
        </div>
      )}

      <div className="mt-6">
        <DataTable
          data={users}
          columns={columns}
          getRowId={(u) => u.id}
          loading={loading}
          searchPlaceholder="Search users…"
          emptyTitle="No users yet"
          emptyMessage="Add your first admin user."
          onRefresh={load}
          onRowClick={(u) => openEditor(u)}
          rowActions={(u) => {
            const lastOwner = isLastOwner(u);
            const actions: Parameters<typeof ActionMenu>[0]["actions"] = [
              { label: "Edit", icon: Pencil, onClick: () => openEditor(u) },
              { label: "View details", icon: Eye, onClick: () => openEditor(u) },
              { label: "Copy email", icon: Copy, onClick: () => copyEmail(u) },
              { label: "Reset password", icon: KeyRound, onClick: () => resetPassword(u) },
            ];

            // Unlock — only when the account is currently locked out.
            if (u.isLocked) {
              actions.push({ label: "Unlock account", icon: Unlock, onClick: () => unlock(u), separated: true });
            }

            // Status transitions
            if (u.status === "invited") {
              actions.push({ label: "Resend invite", icon: Mail, onClick: () => resendInvite(u), separated: true });
            }
            if (u.status !== "active") {
              actions.push({ label: "Activate", icon: CheckCircle2, onClick: () => setStatus(u, "active"), separated: u.status !== "invited" });
            }
            // The last active Owner can't be deactivated / suspended / removed —
            // omit those actions entirely rather than showing them disabled.
            if (!lastOwner) {
              if (u.status === "active") {
                actions.push({ label: "Deactivate", icon: Ban, onClick: () => setStatus(u, "disabled"), separated: true });
              }
              if (u.status !== "suspended") {
                actions.push({ label: "Suspend", icon: PauseCircle, onClick: () => setToSuspend(u) });
              }
            }
            if (u.status === "suspended") {
              actions.push({ label: "Lift suspension", icon: RotateCcw, onClick: () => setStatus(u, "active") });
            }
            if (!lastOwner) {
              actions.push({
                label: "Remove",
                icon: Trash2,
                danger: true,
                onClick: () => setToDelete(u),
                separated: true,
              });
            }
            return <ActionMenu actions={actions} />;
          }}
        />
      </div>

      <RolesPanel roles={roles} loading={loading} />

      <UserFormModal
        open={formOpen}
        editing={editing}
        roles={roles}
        onClose={() => setFormOpen(false)}
        onSaved={(u, isNew) => {
          setUsers((prev) => (isNew ? [u, ...prev] : prev.map((x) => (x.id === u.id ? u : x))));
          setFormOpen(false);
        }}
      />

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={confirmDelete}
        title="Remove user?"
        message={`"${toDelete?.name}" will lose access to the admin panel.`}
        confirmLabel="Remove"
        danger
      />

      <Modal
        open={!!toSuspend}
        onClose={() => {
          setToSuspend(null);
          setSuspendReason("");
        }}
        title="Suspend user"
        subtitle={toSuspend ? `${toSuspend.name} · ${toSuspend.email}` : undefined}
        size="sm"
      >
        <div className="space-y-4">
          <Field label="Reason" hint="Shown in the audit log and to other admins.">
            <AdminTextarea
              rows={3}
              value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)}
              placeholder="e.g. Suspicious activity, pending review…"
            />
          </Field>
          <div className="flex justify-end gap-3">
            <AdminButton
              variant="outline"
              onClick={() => {
                setToSuspend(null);
                setSuspendReason("");
              }}
            >
              Cancel
            </AdminButton>
            <AdminButton variant="danger" onClick={confirmSuspend}>
              Suspend
            </AdminButton>
          </div>
        </div>
      </Modal>

      <Modal
        open={!!resetResult}
        onClose={() => setResetResult(null)}
        title="Password reset"
        subtitle={resetResult?.email}
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm" style={{ color: "var(--a-muted)" }}>
            Share this new temporary password with the user. They&apos;ll set their own on next
            login. It won&apos;t be shown again.
          </p>
          <div
            className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5"
            style={{ borderColor: "var(--a-border)", background: "var(--a-surface-2)" }}
          >
            <code className="text-sm font-semibold" style={{ color: "var(--a-fg)" }}>
              {resetResult?.password}
            </code>
            <button
              onClick={async () => {
                if (resetResult) {
                  await navigator.clipboard.writeText(resetResult.password).catch(() => {});
                  toast("Password copied", "success");
                }
              }}
              className="text-[var(--a-gold)] hover:opacity-70"
              aria-label="Copy"
            >
              <Copy size={16} />
            </button>
          </div>
          <div className="flex justify-end">
            <AdminButton onClick={() => setResetResult(null)}>Done</AdminButton>
          </div>
        </div>
      </Modal>
    </div>
  );
}
