import { AstrologerDetailView } from "./astrologer-detail-view";

export default async function AdminAstrologerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AstrologerDetailView id={id} />;
}
