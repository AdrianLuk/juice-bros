import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

/**
 * The row of cross-links every Booking Buddy page ends on (e.g. "Your
 * bookings" / "Back to Booking Buddy") — styled as ghost-button pills so they
 * read as real navigation rather than inline prose links.
 */
export function FooterNav({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <nav className={cn("mt-14 flex flex-wrap items-center gap-2", className)}>
      {children}
    </nav>
  );
}

export function FooterLink({
  href,
  back,
  children,
}: {
  href: string;
  back?: boolean;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "gap-1.5")}>
      {back && <ArrowLeftIcon className="size-3.5" />}
      {children}
    </Link>
  );
}
