import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getYoutubeEmbedUrl(youtubeUrl: string) {
  const url = new URL(youtubeUrl);
  const videoId =
    url.hostname === "youtu.be"
      ? url.pathname.slice(1)
      : url.searchParams.get("v");
  return videoId ? `https://www.youtube.com/embed/${videoId}` : youtubeUrl;
}
