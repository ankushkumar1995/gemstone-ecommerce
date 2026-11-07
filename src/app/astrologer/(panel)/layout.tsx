import { AdminToastProvider } from "@/app/admin/_components";
import { PartnerProvider } from "../_components/partner-context";
import { PartnerShell } from "../_components/partner-shell";

/** Signed-in partner pages: session context + shell + toasts. */
export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminToastProvider>
      <PartnerProvider>
        <PartnerShell>{children}</PartnerShell>
      </PartnerProvider>
    </AdminToastProvider>
  );
}
