export type Episode = {
  id: string;
  title: string;
  youtubeUrl: string;
  spotifyUrl?: string;
  description: string;
  date: string;
  featured?: boolean;
};

export const episodes: Episode[] = [
  {
    id: "ep-001",
    title: "Welcome to Juice Bros Pickleball",
    youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    spotifyUrl: "https://open.spotify.com/show/placeholder",
    description: "The first episode of Juice Bros Pickleball — who we are and why we started this podcast.",
    date: "2026-01-01",
    featured: true,
  },
];
