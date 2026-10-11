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
  return <CustomerDetailView id={id} initialEdit={edit === "1"} />;
}
