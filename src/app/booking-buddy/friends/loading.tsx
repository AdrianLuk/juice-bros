import { BbPageSkeleton } from "@/components/booking-buddy/bb-page-skeleton";

// Heading copy mirrors friends/page.tsx so the shell doesn't shift on swap.
export default function Loading() {
  return (
    <BbPageSkeleton
      title="Friends"
      description="Connections are mutual. Once you're both in, you can see each other's open time."
    />
  );
}
