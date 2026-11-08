import { PoojaEditor } from "../pooja-editor";

export default async function EditPoojaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Keyed so switching poojas remounts and reloads the editor.
  return <PoojaEditor key={id} id={id} />;
}
