import { Suspense } from "react";
import { PoojaBookingsManager } from "./bookings-manager";

export default function PoojaBookingsPage() {
  return <Suspense fallback={null}><PoojaBookingsManager /></Suspense>;
}
