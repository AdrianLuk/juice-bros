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
    <span
      className={cn(
        "inline-flex w-fit items-center rounded-full border border-current/25 bg-current/10 px-3 py-1 font-semibold tracking-[0.2em] text-[11px] uppercase",
        size === "xs" && "px-2.5 py-0.5",
        color === "orange" ? "text-brand-orange" : "text-brand-yellow",
        className,
      )}
    >
      {children}
    </span>
  );
}
