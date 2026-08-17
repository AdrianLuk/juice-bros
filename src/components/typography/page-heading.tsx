import { cn } from "@/lib/utils";
import { Eyebrow } from "./eyebrow";

type PageHeadingProps = {
  eyebrow?: string;
  title: string;
  description?: string;
};

export function PageHeading({ eyebrow, title, description }: PageHeadingProps) {
  return (
    <>
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <h1
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
