import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireCustomer } from "@/modules/customer-auth";
import { orderService } from "@/modules/orders";
import { settingsService } from "@/modules/settings";
import { InvoiceView } from "@/components/account/invoice-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Invoice — Astrounkle",
  robots: { index: false, follow: false },
};

export default async function InvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Must be signed in, and the order must belong to this customer.
  const guard = await requireCustomer();
  if (!guard.ok) redirect(`/account?redirect=/account/orders/${id}/invoice`);

  const res = await orderService.getById(id);
  if (!res.ok || res.value.customerId !== guard.value.customerId) notFound();

  const settingsRes = await settingsService.get();
  const settings = settingsRes.ok ? settingsRes.value : null;

  return <InvoiceView order={res.value} settings={settings} />;
}
