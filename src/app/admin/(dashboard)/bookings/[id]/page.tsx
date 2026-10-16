import { BookingDetailView } from "./booking-detail-view";

export default async function AdminBookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <BookingDetailView id={id} />;
}
