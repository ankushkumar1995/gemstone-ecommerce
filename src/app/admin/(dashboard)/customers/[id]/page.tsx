import { CustomerDetailView } from "./customer-detail-view";

export default async function CustomerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ edit?: string }>;
}) {
  const { id } = await params;
  const { edit } = await searchParams;
  // Keyed by id so switching customers remounts (and reloads) the view.
  return <CustomerDetailView key={id} id={id} initialEdit={edit === "1"} />;
}
