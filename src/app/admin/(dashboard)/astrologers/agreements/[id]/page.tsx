import { AgreementDetail } from "./agreement-detail";

export default async function AdminAgreementDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AgreementDetail id={id} />;
}
