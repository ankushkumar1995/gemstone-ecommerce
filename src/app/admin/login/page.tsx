import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminLogin } from "./admin-login";
import { LoginBrandPanel } from "./login-brand-panel";

export const metadata: Metadata = {
  title: "Admin Login — Astrounkle",
  robots: { index: false, follow: false },
};

export default function AdminLoginPage() {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      {/* left: cinematic brand panel (hidden on small screens) */}
      <LoginBrandPanel />

      {/* right: login form */}
      <div className="flex items-center justify-center px-5 py-10 sm:px-10">
        <Suspense fallback={null}>
          <AdminLogin />
        </Suspense>
      </div>
    </div>
  );
}
