import { BbPageSkeleton } from "@/components/booking-buddy/bb-page-skeleton";

// Heading copy mirrors bookings/page.tsx so the shell doesn't shift on swap.
export default function Loading() {
  return (
    <BbPageSkeleton
      title="Your bookings"
      description="Court reservations you've already made, typed in here so they're ready to share."
    />
  );
}
