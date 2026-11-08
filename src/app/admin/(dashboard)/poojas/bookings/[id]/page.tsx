import { BookingDetail } from "./booking-detail";

export default async function PoojaBookingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <BookingDetail key={id} id={id} />;
}
