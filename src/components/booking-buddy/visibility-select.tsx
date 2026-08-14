import { cn } from "@/lib/utils";
import {
  VISIBILITY_LEVELS,
  type VisibilityLevel,
} from "@/lib/booking-buddy/visibility";

const VISIBILITY_LABELS: Record<VisibilityLevel, string> = {
  none: "Nothing",
  slots: "Slots I share with them",
  calendar: "Slots and my open time",
};

/** Least to most permissive — the order comes from the levels themselves. */
export const VISIBILITY_OPTIONS = VISIBILITY_LEVELS.map((value) => ({
  value: value as string,
  label: VISIBILITY_LABELS[value],
}));

export function visibilityLabel(level: VisibilityLevel): string {
  return VISIBILITY_LABELS[level];
}

/**
 * A plain `<select>` rather than the shadcn one: these sit inside forms
 * submitted to Server Actions, and the native control posts its value with no
 * JavaScript involved, matching the rest of the page.
 */
export function FormSelect({
  className,
  ...props
}: React.ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30",
        className,
      )}
      {...props}
    />
  );
}

export function VisibilitySelect({
  name = "level",
  extraOptions = [],
  ...props
}: React.ComponentProps<"select"> & {
  /** Prepended choices that aren't levels — "use the group default". */
  extraOptions?: { value: string; label: string }[];
}) {
  return (
    <FormSelect name={name} {...props}>
      {[...extraOptions, ...VISIBILITY_OPTIONS].map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </FormSelect>
  );
}
