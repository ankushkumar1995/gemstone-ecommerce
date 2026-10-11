import type { Metadata } from "next";
import { AccountView } from "@/components/account/account-view";

export const metadata: Metadata = {
  title: "My Account — Nakshatra",
  description: "Sign in or create your Nakshatra account to track orders and save gemstones.",
};

export default function AccountPage() {
  return <AccountView />;
}
