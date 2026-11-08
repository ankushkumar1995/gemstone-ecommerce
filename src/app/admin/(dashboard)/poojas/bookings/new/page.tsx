import { Suspense } from "react";
import { NewBookingForm } from "./new-booking-form";

export default function NewPoojaBookingPage() {
  return <Suspense fallback={null}><NewBookingForm /></Suspense>;
}
