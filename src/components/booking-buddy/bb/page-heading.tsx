import { cn } from "@/lib/utils";

/**
 * A Booking Buddy page title in the rec-hall-board world — set in the Anton
 * notice face, no eyebrow (the routed sign already marks the section). The
 * marketing site keeps the shared `PageHeading`; this is the app's own.
 */
export function BbPageHeading({
  title,
  description,
  titleViewTransitionName,
  className,
}: {
  title: string;
  description?: string;
  /** For a list row that morphs its title into this heading across a navigation. */
  titleViewTransitionName?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <h1
        style={
          titleViewTransitionName
            ? { viewTransitionName: titleViewTransitionName }
            : undefined
        }
        className="bb-h text-[2.1rem] leading-[0.95] sm:text-[2.7rem]"
      >
        {title}
      </h1>
      {description && (
        <p className="max-w-xl text-[0.95rem] text-muted-foreground">
          {description}
        </p>
      )}
    </div>
  );
}
