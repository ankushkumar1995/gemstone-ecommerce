import { DevotionalEditor } from "./devotional-editor";

export default async function AdminDevotionalEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DevotionalEditor id={id === "new" ? null : id} />;
}
