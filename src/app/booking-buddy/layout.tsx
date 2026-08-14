import { QueryProvider } from "@/components/booking-buddy/query-provider";

/**
 * Booking Buddy's section layout.
 *
 * Deliberately does not call `verifySession` itself: the sign-in page lives
 * beneath this layout too, and gating here would lock people out of the very
 * page they need. The gate is the proxy (optimistic) plus `verifySession` in
 * each protected page and Server Action (authoritative) — see ADR 0003.
 */
export default function BookingBuddyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <QueryProvider>{children}</QueryProvider>;
}
