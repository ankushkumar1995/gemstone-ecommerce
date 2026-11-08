import { ServiceEditor } from "../service-editor";

export default async function EditServicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Keyed so switching services remounts and reloads the editor.
  return <ServiceEditor key={id} id={id} />;
}
