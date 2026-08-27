import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** The 11-char video ID from a watch (`?v=`) or short (`youtu.be/`) URL, or null. */
export function getYoutubeVideoId(youtubeUrl: string): string | null {
  const url = new URL(youtubeUrl);
  return url.hostname === "youtu.be"
    ? url.pathname.slice(1) || null
    : url.searchParams.get("v");
}
