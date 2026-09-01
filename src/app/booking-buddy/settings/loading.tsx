import { BbPageSkeleton } from "@/components/booking-buddy/bb-page-skeleton";

// Heading copy mirrors settings/page.tsx so the shell doesn't shift on swap.
export default function Loading() {
  return (
    <BbPageSkeleton
      title="Settings"
      description="Your username was picked for you when you signed up. Change it to whatever you'd rather give out."
    />
  );
}
