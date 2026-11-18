import { AdminSignatureView } from "./signature-view";

export default async function AdminSignaturePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AdminSignatureView id={id} />;
}
