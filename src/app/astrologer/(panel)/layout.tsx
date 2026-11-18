import { PartnerProvider } from "../_components/partner-context";
import { PartnerShell } from "../_components/partner-shell";
import { ConsultInboxProvider } from "../_components/consult-inbox";

/** Signed-in partner pages: session context + chat inbox + shell (toasts come from the astrologer root layout). */
export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <PartnerProvider>
      <ConsultInboxProvider>
        <PartnerShell>{children}</PartnerShell>
      </ConsultInboxProvider>
    </PartnerProvider>
  );
}
