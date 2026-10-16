import { EditLoader } from "./edit-loader";

export default async function EditBannerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <EditLoader id={id} />;
}
