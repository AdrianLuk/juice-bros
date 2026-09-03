import type { ElementType, ReactNode } from "react";

import { cn } from "@/lib/utils";
import { Pushpin, type PinColor } from "./pushpin";

/**
 * A piece of stock pinned to the board. Warm kraft paper, a near-square corner,
 * one real pushpin, a real contact shadow. `pinned` opts the card into its
 * slight resting rotation (kept opt-in so the board stays *kept*); `pin` picks
 * the pushpin colour from the status law; `interactive` adds the lift-and-press
 * feel for a whole-card link/button.
 */

export function BoardCard({
  children,
  className,
  as: Tag = "div",
  pinned = true,
  pin = "info",
  pinLabel,
  interactive = false,
  pinInOnMount = false,
  ...rest
}: {
  children: ReactNode;
  className?: string;
  as?: ElementType;
  pinned?: boolean;
  pin?: PinColor | null;
  pinLabel?: string;
  interactive?: boolean;
  /** Animate this card in as if just pinned up (a newly posted game, a synced booking). */
  pinInOnMount?: boolean;
  [key: string]: unknown;
}) {
  return (
    <Tag
      className={cn(
        "bb-card p-4 sm:p-5",
        pinned && "bb-pinned",
        interactive && "bb-card-interactive",
        pinInOnMount && "bb-pin-in",
        className,
      )}
      {...rest}
    >
      {pin ? <Pushpin color={pin} label={pinLabel} /> : null}
      {children}
    </Tag>
  );
}
