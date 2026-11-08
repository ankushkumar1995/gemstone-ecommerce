import { PoojaEditor } from "../pooja-editor";

/** /admin/poojas/new            → new pooja
 *  /admin/poojas/new?type=havan → new havan / yagya */
export default async function NewPoojaPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const { type } = await searchParams;
  const t = type === "havan" ? "havan" : "pooja";
  return <PoojaEditor key={t} defaultType={t} />;
}
