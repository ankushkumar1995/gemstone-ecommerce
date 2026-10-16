import type { Metadata } from "next";
import "./admin.css";

export const metadata: Metadata = {
  title: "Admin — Astrounkle",
  robots: { index: false, follow: false },
};

/**
 * Top-level admin layout. Only applies the dark `.admin-root` design system
 * to everything under /admin. The dashboard shell (sidebar + topbar) lives in
 * the (dashboard) route group so the login page can opt out of it.
 */
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="admin-root">{children}</div>;
}
