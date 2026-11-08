import type { Metadata, Viewport } from "next";
import "../admin/admin.css";

export const metadata: Metadata = {
  title: "Partner Panel — Astrounkle",
  robots: { index: false, follow: false },
  // Installable partner app (separate from the storefront PWA).
  manifest: "/astrologer.webmanifest",
  appleWebApp: { capable: true, title: "AU Partner", statusBarStyle: "default" },
};

export const viewport: Viewport = { themeColor: "#c9942a" };

/**
 * Partner (astrologer) area. Reuses the admin design system (`.admin-root`
 * tokens + shared components) so both back-offices look and behave alike.
 * The signed-in shell lives in the (panel) group; login / apply / password
 * pages render without it.
 */
export default function AstrologerLayout({ children }: { children: React.ReactNode }) {
  return <div className="admin-root">{children}</div>;
}
