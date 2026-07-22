import { cn } from "@/lib/utils";
import { Eyebrow } from "./eyebrow";

type SectionHeadingProps = {
  eyebrow?: string;
  eyebrowColor?: "orange" | "yellow";
  title: string;
  align?: "left" | "center";
  weight?: "semibold" | "bold";
  responsive?: boolean;
};

export function SectionHeading({
  eyebrow,
  eyebrowColor,
  title,
  align = "left",
  weight = "bold",
  responsive = true,
}: SectionHeadingProps) {
  return (
    <div className={align === "center" ? "text-center" : undefined}>
      {eyebrow && <Eyebrow color={eyebrowColor}>{eyebrow}</Eyebrow>}
      <h2
        className={cn(
          "font-heading text-2xl tracking-tight",
          weight === "bold" ? "font-bold" : "font-semibold",
          eyebrow && "mt-1",
          responsive && "sm:text-3xl",
        )}
      >
        {title}
      </h2>
    </div>
  );
}
