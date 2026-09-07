import { siteConfig } from "@/config/site";
import { SpotifyIcon } from "@/components/icons";

/**
 * The audio close, on this page's one band.
 *
 * The catalogue above sends people to YouTube; a real share of a podcast
 * audience never watches anything and wants the show in their ears on a drive.
 * That second path deserves the page's one lighter passage rather than a link
 * in the footer, so the band lands here at the end of the scroll with the show
 * already loaded and playable in place.
 *
 * The player is Spotify's own iframe, so it brings its own chrome and its own
 * green; the band gives it a stage-radius frame and otherwise leaves it alone.
 */
export function OnSpotify() {
  return (
    <section className="bx-band">
      <div className="bx-measure py-16 sm:py-24">
        <div className="grid gap-8 lg:grid-cols-[1fr_minmax(0,34rem)] lg:items-center lg:gap-14">
          <div>
            <h2 className="bx-h2 max-w-[16ch] text-[clamp(1.75rem,3.4vw,2.125rem)]">
              Rather just listen?
            </h2>
            <p className="bx-meta mt-3">Full show &middot; Free &middot; No account needed</p>
            <p className="mt-3.5 max-w-[46ch] text-[1.0625rem] leading-relaxed text-[var(--bx-muted)]">
              Every episode is on Spotify as audio, so you can put one on for
              the drive to the courts and leave your phone in your bag.
            </p>
            <a
              href={siteConfig.links.spotify}
              target="_blank"
              rel="noopener noreferrer"
              className="bx-btn bx-btn-sp mt-7"
            >
              <SpotifyIcon className="size-[1.125rem]" />
              Follow on Spotify
            </a>
          </div>

          <div className="bx-tile bx-stage p-2">
            <iframe
              data-testid="embed-iframe"
              title="Juice Bros Pickleball on Spotify"
              style={{ borderRadius: 12 }}
              src="https://open.spotify.com/embed/show/033oOtZrkX2ifvBZ8JQyt5/video?utm_source=generator&theme=0&si=9f02a512c2aa49ab"
              width="624"
              height="351"
              allowFullScreen
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              loading="lazy"
              className="block h-[351px] w-full"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
