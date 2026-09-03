import { cn } from "@/lib/utils";

/**
 * The status key — the one element on the board that never tilts. It maps the
 * four pin colours to their fixed meanings so a first-time visitor can read the
 * board. Sits at the foot of the dashboard; also reusable inline where a
 * surface leans on the pin law (Games, Friends).
 */

// The pin-colour law is exactly four. The orange commit pin is an action cue,
// not a fifth law entry — it never appears here.
const ENTRIES: { color: string; label: string }[] = [
  { color: "var(--bb-pin-in)", label: "You're in" },
  { color: "var(--bb-pin-need)", label: "Needs you" },
  { color: "var(--bb-pin-maybe)", label: "Maybe" },
  { color: "var(--bb-pin-info)", label: "Info" },
];

export function StatusKey({
  className,
  variant = "bar",
}: {
  className?: string;
  /** "bar" — the full-width footer strip; "inline" — a quiet run of chips within a page. */
  variant?: "bar" | "inline";
}) {
  return (
    <div
      className={cn(
        "bb-key flex flex-wrap items-center gap-x-5 gap-y-1.5",
        variant === "bar"
          ? "justify-center rounded-t-sm px-4 py-2.5 text-[0.68rem]"
          : "rounded-sm px-3 py-1.5 text-[0.64rem]",
        className,
      )}
    >
      {ENTRIES.map((entry) => (
        <span key={entry.label} className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="size-2.5 rounded-full"
            style={{
              backgroundColor: entry.color,
              boxShadow: "inset 0 -1px 1px rgba(0,0,0,.3)",
            }}
          />
          {entry.label}
        </span>
      ))}
    </div>
  );
}
