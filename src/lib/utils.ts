import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getYoutubeEmbedUrl(youtubeUrl: string) {
  const videoId = new URL(youtubeUrl).searchParams.get("v");
  return videoId ? `https://www.youtube.com/embed/${videoId}` : youtubeUrl;
}
