"use client";

import { useCommerce } from "@/lib/store";
import { AccountAuth } from "@/components/account/account-auth";
import { AccountDashboard } from "@/components/account/account-dashboard";

/**
 * Shows the login/signup card when logged out, and the full dashboard when
 * logged in. Auth is demo-only (no backend) and persists via the store.
 *
 * On first render (server + initial client) `user` is null — matching HTML on
 * both sides — then the store hydrates from localStorage and re-renders.
 */
export function AccountView() {
  const { user } = useCommerce();
  return user ? <AccountDashboard /> : <AccountAuth />;
}
