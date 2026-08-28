import { cn } from "@/lib/utils";
import { Eyebrow } from "./eyebrow";

type PageHeadingProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  /**
   * A `view-transition-name` for the title text — set by a list row that
   * navigates here (e.g. a Booking Buddy game row) and its own title so the
   * two morph into each other across the navigation. Must be unique in the
   * document; leave unset everywhere else.
   */
  titleViewTransitionName?: string;
};

export function PageHeading({
  eyebrow,
  title,
  description,
  titleViewTransitionName,
}: PageHeadingProps) {
  return (
    <>
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <h1
        style={
          titleViewTransitionName
            ? { viewTransitionName: titleViewTransitionName }
            : undefined
        }
        className={cn(
          "font-heading text-4xl font-semibold tracking-[-0.02em]",
          eyebrow && "mt-3 sm:text-5xl",
        )}
      >
        {title}
      </h1>
      {description && (
        <p className="mt-3 max-w-xl text-lg text-muted-foreground">{description}</p>
      )}
    </>
  );
}
