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
          "font-heading text-3xl font-semibold tracking-tight",
          eyebrow && "mt-1 sm:text-4xl",
        )}
      >
        {title}
      </h1>
      {description && <p className="mt-2 text-muted-foreground">{description}</p>}
    </>
  );
}
