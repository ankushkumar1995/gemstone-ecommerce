import { AdminShell } from "../_components/shell";
import { AdminToastProvider } from "../_components/toast";
import { MediaProvider } from "@/lib/media-store";

/**
 * Dashboard layout — wraps all authenticated admin pages with the shell
 * (sidebar + topbar) and the admin toast provider. The login page is NOT in
 * this group, so it renders without the shell.
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminToastProvider>
      <MediaProvider>
        <AdminShell>{children}</AdminShell>
      </MediaProvider>
    </AdminToastProvider>
  );
}
