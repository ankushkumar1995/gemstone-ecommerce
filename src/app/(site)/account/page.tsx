import type { Metadata } from "next";
import { Suspense } from "react";
import { AccountView } from "@/components/account/account-view";

export const metadata: Metadata = {
  title: "My Account — Astrounkle",
  description: "Sign in or create your Astrounkle account to track orders and save gemstones.",
};

// The account view is session-dependent and reads the URL (?redirect, ?tab),
// so there's nothing to statically prerender — render it dynamically and wrap
// in Suspense for the useSearchParams() client hook.
export const dynamic = "force-dynamic";

export default function AccountPage() {
  return (
    <Suspense fallback={null}>
      <AccountView />
    </Suspense>
  );
}
