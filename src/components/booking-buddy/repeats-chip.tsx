import { Repeat2Icon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * "Every Tuesday" on a game a Standing Game posted, so the organizer and
 * friends alike can tell a regular game from a one-off. Set in the board's
 * stamped sign face like the status badge beside it, with a repeat mark so it
 * doesn't read as a second status.
 */
export function RepeatsChip({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-sm border border-current/25 px-1.5 py-0.5 font-bb-sign text-[0.66rem] leading-none tracking-widest text-foreground/80 uppercase",
        className,
      )}
    >
      <Repeat2Icon aria-hidden className="size-3" />
      {label}
    </span>
  );
}
