import { cn } from "@/lib/utils";

/**
 * The pushpin — the status law made physical. Four colours, one fixed meaning
 * each (green in / red needs-you / amber maybe / cobalt info); `commit` is the
 * single orange action pin per screen. Rendered as a matte enamel disc with a
 * real cast shadow, positioned at the top edge of whatever it pins.
 */

export type PinColor = "in" | "need" | "maybe" | "info" | "commit";

const PIN_MEANING: Record<PinColor, string> = {
  in: "You're in",
  need: "Needs you",
  maybe: "Maybe",
  info: "Info",
  commit: "Your move",
};

export function Pushpin({
  color = "info",
  className,
  label,
}: {
  color?: PinColor;
  className?: string;
  /** Overrides the default status word for the screen-reader announcement. */
  label?: string;
}) {
  return (
    <span
      className={cn("bb-pin", `bb-pin--${color}`, className)}
      role="img"
      aria-label={label ?? PIN_MEANING[color]}
    />
  );
}
