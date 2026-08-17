import { SectionHeading } from "@/components/typography/section-heading";

export function SpotifyEmbed() {
  return (
    <div className="mt-20 flex flex-col items-center gap-4 text-center">
      <SectionHeading title="Listen on Spotify" align="center" responsive={false} />
      <p className="max-w-md text-muted-foreground">
        Prefer audio? Stream every episode straight from Spotify.
      </p>
      <div className="mt-2 w-full max-w-160 rounded-[1.75rem] bg-black/3 p-1.5 ring-1 ring-black/5">
        <iframe
          data-testid="embed-iframe"
          style={{ borderRadius: 20 }}
          src="https://open.spotify.com/embed/show/033oOtZrkX2ifvBZ8JQyt5/video?utm_source=generator&theme=0&si=9f02a512c2aa49ab"
          width="624"
          height="351"
          allowFullScreen
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          loading="lazy"
          className="w-full"
        ></iframe>
      </div>
    </div>
  );
}
