import type { Metadata } from "next";
import { RitualDetailPage, ritualMetadata } from "@/components/pooja/ritual-detail-page";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return ritualMetadata((await params).slug, "pooja");
}

export default async function PoojaDetailPage({ params }: Props) {
  return <RitualDetailPage slug={(await params).slug} type="pooja" />;
}
