import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type EyebrowProps = {
  children: ReactNode;
  color?: "orange" | "yellow";
  size?: "sm" | "xs";
  className?: string;
};

export function Eyebrow({ children, color = "orange", size = "sm", className }: EyebrowProps) {
  return (
    <p
      className={cn(
        "font-semibold tracking-[0.2em] uppercase",
        size === "sm" ? "text-sm" : "text-xs",
        color === "orange" ? "text-brand-orange" : "text-brand-yellow",
        className,
      )}
    >
      {children}
    </p>
  );
}
