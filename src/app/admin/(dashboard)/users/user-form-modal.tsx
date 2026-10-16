"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, Wand2, Copy, Eye, EyeOff } from "lucide-react";
import type { ResolvedUser, Role } from "@/modules/users";
import { adminApi } from "@/lib/admin-api";
import {
  Modal,
  Field,
  AdminInput,
  AdminDropdown,
  AdminButton,
  Toggle,
  useAdminToast,
} from "../../_components";

type Status = ResolvedUser["status"];

/** Client-side strong password generator (mirrors the server's rules). */
function makePassword(len = 14): string {
  const sets = ["ABCDEFGHJKLMNPQRSTUVWXYZ", "abcdefghijkmnopqrstuvwxyz", "23456789", "!@#$%&*?"];
  const all = sets.join("");
  const out = sets.map((s) => s[Math.floor(Math.random() * s.length)]);
  for (let i = out.length; i < len; i++) out.push(all[Math.floor(Math.random() * all.length)]);
  return out.sort(() => Math.random() - 0.5).join("");
}

export function UserFormModal({
  open,
  editing,
  roles,
  onClose,
  onSaved,
}: {
  open: boolean;
  editing: ResolvedUser | null;
  roles: Role[];
  onClose: () => void;
  onSaved: (user: ResolvedUser, isNew: boolean) => void;
}) {
  const { toast } = useAdminToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState("");
  const [status, setStatus] = useState<Status>("active");
  const [autoPassword, setAutoPassword] = useState(true);
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [saving, setSaving] = useState(false);
  // After creating with an auto-generated password, show it once here.
  const [createdTempPassword, setCreatedTempPassword] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setCreatedTempPassword(null);
    if (editing) {
      setName(editing.name);
      setEmail(editing.email);
      setRoleId(editing.roleId);
      setStatus(editing.status);
    } else {
      setName("");
      setEmail("");
      setRoleId(roles.find((r) => r.key === "support")?.id ?? roles[roles.length - 1]?.id ?? "");
      setStatus("active");
      setAutoPassword(true);
      setPassword("");
      setShowPw(false);
    }
  }, [open, editing, roles]);

  const selectedRole = roles.find((r) => r.id === roleId);
  const isOwnerEditing = editing?.role?.key === "owner";

  const save = async () => {
    if (!name.trim() || (!editing && !email.trim())) {
      toast("Name and email are required", "error");
      return;
    }
    setSaving(true);

    if (editing) {
      const res = await adminApi.users.update(editing.id, { name: name.trim(), roleId, status });
      setSaving(false);
      if (res.ok) {
        toast("User updated", "success");
        onSaved(res.data, false);
      } else toast(res.message, "error");
      return;
    }

    // Create: send a password only when not auto-generating.
    const res = await adminApi.users.create({
      name: name.trim(),
      email: email.trim(),
      roleId,
      status,
      ...(autoPassword ? {} : { password }),
    });
    setSaving(false);
    if (res.ok) {
      toast("User added", "success");
      onSaved(res.data.user, true);
      if (res.data.tempPassword) {
        // Keep the modal open to reveal the one-time temp password.
        setCreatedTempPassword(res.data.tempPassword);
      } else {
        onClose();
      }
    } else {
      toast(res.message, "error");
    }
  };

  const copyTemp = async () => {
    if (!createdTempPassword) return;
    try {
      await navigator.clipboard.writeText(createdTempPassword);
      toast("Password copied", "success");
    } catch {
      toast("Could not copy", "error");
    }
  };

  /* ---- after-create: show the one-time temp password ---- */
  if (createdTempPassword) {
    return (
      <Modal open={open} onClose={onClose} title="User created" subtitle={email} size="sm">
        <div className="space-y-4">
          <p className="text-sm" style={{ color: "var(--a-muted)" }}>
            Share this temporary password with the user. They&apos;ll be asked to set a new one on
            first login. It won&apos;t be shown again.
          </p>
          <div
            className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5"
            style={{ borderColor: "var(--a-border)", background: "var(--a-surface-2)" }}
          >
            <code className="text-sm font-semibold" style={{ color: "var(--a-fg)" }}>
              {createdTempPassword}
            </code>
            <button onClick={copyTemp} className="text-[var(--a-gold)] hover:opacity-70" aria-label="Copy">
              <Copy size={16} />
            </button>
          </div>
          <div className="flex justify-end">
            <AdminButton onClick={onClose}>Done</AdminButton>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? "Edit user" : "Add user"}
      subtitle={editing ? editing.email : "Create an admin account for a teammate."}
      size="md"
    >
      <div className="space-y-4">
        <Field label="Full name" required>
          <AdminInput value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Riya Kapoor" />
        </Field>

        <Field label="Email" required hint={editing ? "Email can't be changed after creation." : undefined}>
          <AdminInput
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@astrounkle.com"
            disabled={!!editing}
          />
        </Field>

        <Field
          label="Role"
          required
          hint={isOwnerEditing ? "This is the Owner account." : selectedRole?.description}
        >
          <AdminDropdown
            value={roleId}
            onChange={setRoleId}
            options={roles.map((r) => ({ value: r.id, label: r.name }))}
            placeholder="Select a role"
          />
        </Field>

        {/* Password — only when creating a new user */}
        {!editing && (
          <div className="rounded-lg border p-3" style={{ borderColor: "var(--a-border)" }}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium" style={{ color: "var(--a-fg)" }}>
                Auto-generate password
              </span>
              <Toggle checked={autoPassword} onChange={setAutoPassword} />
            </div>
            {autoPassword ? (
              <p className="mt-1.5 text-xs" style={{ color: "var(--a-faint)" }}>
                A strong temporary password is generated and shown once after creating.
              </p>
            ) : (
              <div className="mt-3">
                <div className="relative">
                  <AdminInput
                    type={showPw ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 chars, 1 letter + 1 number"
                    className="pr-20"
                  />
                  <div className="absolute right-2 top-1/2 flex -translate-y-1/2 gap-1">
                    <button type="button" onClick={() => setShowPw((s) => !s)} className="p-1 text-[var(--a-muted)]" aria-label="Toggle">
                      {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                    <button type="button" onClick={() => setPassword(makePassword())} className="p-1 text-[var(--a-gold)]" aria-label="Generate">
                      <Wand2 size={15} />
                    </button>
                  </div>
                </div>
                <p className="mt-1 text-xs" style={{ color: "var(--a-faint)" }}>
                  The user must change this on first login.
                </p>
              </div>
            )}
          </div>
        )}

        {editing && (
          <Field label="Status">
            <AdminDropdown
              value={status}
              onChange={(v) => setStatus(v as Status)}
              options={[
                { value: "active", label: "Active" },
                { value: "disabled", label: "Disabled" },
                { value: "suspended", label: "Suspended" },
              ]}
              direction="up"
            />
          </Field>
        )}

        {selectedRole && (
          <div
            className="rounded-lg border p-3"
            style={{ borderColor: "var(--a-border)", background: "var(--a-surface-2)" }}
          >
            <p className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: "var(--a-fg)" }}>
              <ShieldCheck size={13} className="text-gold-500" />
              {selectedRole.name} can access
            </p>
            <p className="mt-1 text-xs" style={{ color: "var(--a-muted)" }}>
              {selectedRole.permissions.includes("*:*")
                ? "Everything (full access)."
                : `${selectedRole.permissions.length} permissions across the panel.`}
            </p>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <AdminButton variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </AdminButton>
          <AdminButton onClick={save} disabled={saving}>
            {saving ? "Saving…" : editing ? "Save changes" : "Create user"}
          </AdminButton>
        </div>
      </div>
    </Modal>
  );
}
