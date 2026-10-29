import { CategoryDetailView } from "./category-detail-view";

export default async function AdminCategoryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CategoryDetailView id={id} />;
}
