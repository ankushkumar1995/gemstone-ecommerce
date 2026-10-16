"use client";

import { useState } from "react";
import { Check, Minus, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { Role } from "@/modules/users";
import {
  RESOURCES,
  ACTIONS,
  RESOURCE_LABELS,
  hasPermission,
} from "@/modules/users/rbac";
import { Card } from "../../_components";

/** Read-only reference: what each role can do, as an expandable matrix. */
export function RolesPanel({ roles, loading }: { roles: Role[]; loading: boolean }) {
  const [openId, setOpenId] = useState<string | null>(null);

  if (loading) return null;

  return (
    <Card className="mt-8">
      <div className="mb-1">
        <h2 className="text-lg font-semibold" style={{ color: "var(--a-fg)" }}>
          Roles & permissions
        </h2>
        <p className="text-sm" style={{ color: "var(--a-muted)" }}>
          What each role can access. Expand a role to see its permission matrix.
        </p>
      </div>

      <div className="mt-4 space-y-2">
        {roles.map((role) => {
          const isOpen = openId === role.id;
          const isSuper = role.permissions.includes("*:*");
          const count = isSuper ? RESOURCES.length * ACTIONS.length : role.permissions.length;
          return (
            <div
              key={role.id}
              className="overflow-hidden rounded-xl border"
              style={{ borderColor: "var(--a-border)" }}
            >
              <button
                onClick={() => setOpenId(isOpen ? null : role.id)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-black/[0.02]"
              >
                <div className="min-w-0">
                  <p className="font-semibold" style={{ color: "var(--a-fg)" }}>
                    {role.name}
                    {role.isSystem && (
                      <span className="ml-2 rounded-full bg-black/[0.06] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide" style={{ color: "var(--a-muted)" }}>
                        preset
                      </span>
                    )}
                  </p>
                  <p className="truncate text-xs" style={{ color: "var(--a-faint)" }}>
                    {role.description}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-xs font-medium" style={{ color: "var(--a-muted)" }}>
                    {isSuper ? "Full access" : `${count} perms`}
                  </span>
                  <ChevronDown
                    size={16}
                    className="transition-transform"
                    style={{ color: "var(--a-muted)", transform: isOpen ? "rotate(180deg)" : "none" }}
                  />
                </div>
              </button>

              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="border-t"
                    style={{ borderColor: "var(--a-border)" }}
                  >
                    <div className="overflow-x-auto p-4">
                      <table className="w-full text-sm">
                        <thead>
                          <tr>
                            <th className="pb-2 text-left font-medium" style={{ color: "var(--a-faint)" }}>
                              Section
                            </th>
                            {ACTIONS.map((a) => (
                              <th key={a} className="pb-2 text-center font-medium capitalize" style={{ color: "var(--a-faint)" }}>
                                {a}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {RESOURCES.map((res) => (
                            <tr key={res} className="border-t" style={{ borderColor: "var(--a-border)" }}>
                              <td className="py-2 pr-4" style={{ color: "var(--a-fg)" }}>
                                {RESOURCE_LABELS[res]}
                              </td>
                              {ACTIONS.map((a) => {
                                const allowed = hasPermission(role.permissions, res, a);
                                return (
                                  <td key={a} className="py-2 text-center">
                                    {allowed ? (
                                      <Check size={15} className="mx-auto text-emerald-500" />
                                    ) : (
                                      <Minus size={14} className="mx-auto" style={{ color: "var(--a-faint)" }} />
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
