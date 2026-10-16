"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCommerce } from "@/lib/store";
import { AccountAuth } from "@/components/account/account-auth";
import { AccountDashboard } from "@/components/account/account-dashboard";
import { Container } from "@/components/ui/container";

/**
 * Shows the login/signup card when logged out, and the full dashboard when
 * logged in.
 *
 * We wait for `authReady` (the real /me session check) before deciding WHICH
 * to show. Without this gate, a refresh briefly renders the login card (while
 * `user` is still null) and then swaps to the dashboard — a visible flash.
 * While the session is resolving we render a neutral placeholder of the same
 * shape so there's no layout jump either way.
 */
export function AccountView() {
  const { user, authReady } = useCommerce();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Already signed in but arrived with a ?redirect (e.g. clicked "Sign in to
  // checkout" while a session was already active) → send them along.
  const redirect = searchParams.get("redirect");
  useEffect(() => {
    if (authReady && user && redirect && /^\/(?!\/)/.test(redirect)) {
      router.replace(redirect);
    }
  }, [authReady, user, redirect, router]);

  if (!authReady) return <AccountLoading />;
  return user ? <AccountDashboard /> : <AccountAuth />;
}

/** Neutral, content-less placeholder shown until the session is known. */
function AccountLoading() {
  return (
    <Container className="py-10">
      <div className="grid gap-8 lg:grid-cols-[18rem_1fr]">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="h-64 animate-pulse rounded-3xl border border-foreground/10 bg-nebula" />
        </aside>
        <div className="min-w-0 space-y-6">
          <div className="h-8 w-56 animate-pulse rounded-xl bg-foreground/5" />
          <div className="grid grid-cols-3 gap-4">
            <div className="h-28 animate-pulse rounded-3xl border border-foreground/10 bg-nebula" />
            <div className="h-28 animate-pulse rounded-3xl border border-foreground/10 bg-nebula" />
            <div className="h-28 animate-pulse rounded-3xl border border-foreground/10 bg-nebula" />
          </div>
          <div className="h-48 animate-pulse rounded-3xl border border-foreground/10 bg-nebula" />
        </div>
      </div>
    </Container>
  );
}
