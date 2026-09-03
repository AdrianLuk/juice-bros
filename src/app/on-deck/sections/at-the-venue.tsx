import { Reveal } from "@/components/motion/reveal";
import { SectionHeading } from "@/components/typography/section-heading";

/**
 * Two static props from the player's side of a night, dropped into the light
 * marketing page: the printed Club QR sign that never changes, and the one
 * verdict a player's phone collapses to once they're in the queue. Both quote
 * the On Deck Arena design system (`on-deck/DESIGN.md`) — Saira Condensed
 * signage, Geist Mono readouts, orange for LIVE, cool blue for on-deck — with
 * every rule scoped under `.odv`, never touching the real `.od-*` arena CSS.
 *
 * The sign and phone screen stay dark because they depict physical objects at
 * a venue, not themeable surfaces. Nothing here is a screenshot; the QR is a
 * drawn placeholder and scans as nothing.
 */

// A drawn stand-in for a QR block: a fixed 11×11 bit grid with the three finder
// squares a real QR carries, so it reads as a QR code at a glance without
// encoding (or claiming to encode) anything.
const QR_BITS = [
  "11111110101",
  "10000010110",
  "10111010011",
  "10111010101",
  "10111010010",
  "10000010111",
  "11111110101",
  "00000000100",
  "11011011101",
  "01001000010",
  "10110111011",
];

export function AtTheVenue() {
  return (
    <section className="w-full bg-muted/50">
      <div className="mx-auto w-full max-w-4xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <SectionHeading
            eyebrow="At the Venue"
            title="A sign on the wall and your phone"
            align="center"
          />
          <p className="mt-4 text-lg text-muted-foreground">
            The club prints one sign and never touches it again. A player scans
            it, gives a first name, and their phone does the rest.
          </p>
        </Reveal>

        <Reveal variant="scale" className="mt-12">
          <div className="odv">
            <figure className="odv-sign">
              <div className="odv-sign-inner">
                <div className="odv-sign-brand">
                  <span className="odv-sign-mark" aria-hidden>
                    {/* eslint-disable-next-line @next/next/no-img-element -- local trusted SVG, no next/image optimization needed */}
                    <img src="/brand/JB_Logo_White.svg" alt="" />
                  </span>
                  <span className="odv-mono">On Deck</span>
                </div>
                <p className="odv-sign-headline">Join tonight&apos;s social</p>
                <div className="odv-qr" aria-hidden>
                  {QR_BITS.map((row, y) => (
                    <div key={y} className="odv-qr-row">
                      {row.split("").map((bit, x) => (
                        <span
                          key={x}
                          className={bit === "1" ? "odv-qr-on" : "odv-qr-off"}
                        />
                      ))}
                    </div>
                  ))}
                </div>
                <p className="odv-sign-instruction">
                  Point your camera here. No app, no sign-up.
                </p>
                <p className="odv-mono odv-sign-venue">TO Pickleball Club</p>
              </div>
              <figcaption className="odv-caption">
                Printed once. The link behind it always points at whatever
                session is running.
              </figcaption>
            </figure>

            <figure className="odv-phone-wrap">
              <div className="odv-phone">
                <span className="odv-phone-notch" aria-hidden />
                <div className="odv-phone-screen">
                  <div className="odv-phone-head">
                    <span className="odv-phone-venue">TO Pickleball</span>
                    <span className="odv-mono odv-phone-status">
                      Session running
                    </span>
                  </div>

                  <div className="odv-verdict">
                    <p className="odv-verdict-line">
                      #4
                      <span className="odv-verdict-of">of 6</span>
                      <span className="odv-verdict-tail">in the queue</span>
                    </p>
                    <p className="odv-verdict-sub">
                      Hang around. You don&apos;t need to touch anything.
                    </p>
                  </div>

                  <p className="odv-mono odv-phone-note">
                    Playing as Intermediate
                  </p>
                  <span className="odv-phone-key" aria-hidden>
                    Leave the queue
                  </span>
                </div>
              </div>
              <figcaption className="odv-caption">
                Every player sees only their own line. The question &ldquo;am I
                next?&rdquo; answers itself.
              </figcaption>
            </figure>
          </div>
        </Reveal>
      </div>

      <style>{venueCss}</style>
    </section>
  );
}

/* Scoped under `.odv`. Palette from `on-deck/DESIGN.md`: near-neutral cool
   graphite, one committed warm accent (`#f26522`, unaltered), one cool
   secondary. */
const venueCss = `
.odv {
  --odv-bg: oklch(0.16 0.014 255);
  --odv-panel: oklch(0.213 0.017 258);
  --odv-recessed: oklch(0.13 0.013 255);
  --odv-line-soft: oklch(0.3 0.018 258 / 0.6);
  --odv-fg: oklch(0.97 0.006 250);
  --odv-dim: oklch(0.74 0.012 250);
  --odv-faint: oklch(0.64 0.012 250);
  --odv-live: #f26522;
  --odv-next: oklch(0.86 0.09 218);
  --odv-next-line: oklch(0.72 0.1 218 / 0.7);
  --odv-arena: var(--font-arena), "Saira Condensed", "Arial Narrow", sans-serif;

  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 3rem;
  justify-items: center;
  align-items: center;
}
@media (min-width: 768px) {
  .odv {
    grid-template-columns: auto auto;
    justify-content: center;
    gap: 4rem;
  }
}

.odv-mono {
  font-family: var(--font-mono), ui-monospace, monospace;
  font-size: 0.75rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  font-variant-numeric: tabular-nums;
}

.odv figure {
  margin: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
}
@media (min-width: 768px) {
  .odv figure { width: auto; }
}
.odv-caption {
  margin-top: 1rem;
  max-width: 34ch;
  text-align: center;
  font-size: 0.9rem;
  line-height: 1.55;
  color: var(--muted-foreground);
}

/* --- The printed sign, on a light mount --- */
.odv-sign { width: 100%; max-width: 17rem; }
@media (min-width: 768px) { .odv-sign { width: 19rem; max-width: 19rem; } }
.odv-sign-inner {
  width: 100%;
  background: var(--odv-bg);
  border-radius: 14px;
  padding: 1.6rem 1.4rem 1.35rem;
  color: var(--odv-fg);
  text-align: center;
  border: 6px solid oklch(1 0 0 / 0.92);
  outline: 1px solid oklch(0 0 0 / 0.08);
  box-shadow:
    inset 0 1px 0 0 oklch(1 0 0 / 0.06),
    0 2px 4px oklch(0 0 0 / 0.12),
    0 30px 55px -28px oklch(0.2 0.13 40 / 0.45);
}
.odv-sign-brand {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.55rem;
  color: var(--odv-faint);
}
.odv-sign-mark {
  display: inline-flex;
  width: 1.5rem;
  height: 1.5rem;
}
.odv-sign-mark img { width: 100%; height: 100%; }
.odv-sign-headline {
  margin-top: 0.9rem;
  font-family: var(--odv-arena);
  font-weight: 800;
  font-size: 1.55rem;
  line-height: 1;
  letter-spacing: -0.01em;
  text-transform: uppercase;
}
.odv-qr {
  margin: 1.1rem auto 0;
  width: fit-content;
  padding: 0.6rem;
  background: var(--odv-fg);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 0;
}
.odv-qr-row { display: flex; }
.odv-qr-on, .odv-qr-off {
  width: 0.72rem;
  height: 0.72rem;
}
.odv-qr-on { background: var(--odv-bg); }
.odv-qr-off { background: transparent; }
.odv-sign-instruction {
  margin-top: 1.1rem;
  font-size: 0.95rem;
  color: var(--odv-dim);
}
.odv-sign-venue {
  margin-top: 0.9rem;
  color: var(--odv-faint);
}

/* --- The player's phone --- */
.odv-phone-wrap { width: 100%; max-width: 16.5rem; }
@media (min-width: 768px) { .odv-phone-wrap { width: 16rem; } }
.odv-phone {
  position: relative;
  width: 100%;
  background: oklch(0.09 0.01 255);
  border-radius: 2.5rem;
  padding: 0.45rem;
  box-shadow:
    inset 0 0 0 1.5px oklch(1 0 0 / 0.08),
    inset 0 1px 0 0 oklch(1 0 0 / 0.14),
    0 1px 2px oklch(0 0 0 / 0.5),
    0 30px 60px -26px oklch(0 0 0 / 0.78);
}
.odv-phone-notch {
  position: absolute;
  top: 0.45rem;
  left: 50%;
  translate: -50% 0;
  width: 38%;
  height: 1.15rem;
  background: oklch(0.09 0.01 255);
  border-radius: 0 0 0.9rem 0.9rem;
  z-index: 2;
}
.odv-phone-screen {
  position: relative;
  background: var(--odv-bg);
  border-radius: 2.1rem;
  padding: 2.4rem 1.15rem 1.9rem;
  color: var(--odv-fg);
}
.odv-phone-head {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--odv-line-soft);
}
.odv-phone-venue {
  font-family: var(--odv-arena);
  font-weight: 800;
  font-size: 1.6rem;
  line-height: 0.95;
  letter-spacing: -0.01em;
  text-transform: uppercase;
}
.odv-phone-status { color: var(--odv-live); }

.odv-verdict {
  margin-top: 1.25rem;
  background: var(--odv-panel);
  border: 1px solid var(--odv-next-line);
  border-radius: 14px;
  padding: 1.35rem 1.15rem;
  box-shadow:
    inset 0 1px 0 0 oklch(0.86 0.11 218 / 0.32),
    inset 0 22px 40px -30px oklch(0.82 0.14 218 / 0.85),
    0 16px 36px -22px oklch(0 0 0 / 0.7);
}
.odv-verdict-line {
  font-family: var(--odv-arena);
  font-weight: 800;
  font-size: 2.85rem;
  line-height: 0.92;
  letter-spacing: -0.01em;
  text-transform: uppercase;
  color: var(--odv-fg);
}
.odv-verdict-of {
  font-family: var(--font-mono), ui-monospace, monospace;
  font-weight: 400;
  font-size: 1.15rem;
  letter-spacing: 0.02em;
  color: var(--odv-dim);
  margin-left: 0.6rem;
}
.odv-verdict-tail {
  display: block;
  margin-top: 0.35rem;
  font-size: 1.5rem;
  color: var(--odv-dim);
}
.odv-verdict-sub {
  margin-top: 0.85rem;
  font-size: 0.85rem;
  line-height: 1.5;
  color: var(--odv-dim);
}

.odv-phone-note {
  margin-top: 1.15rem;
  color: var(--odv-faint);
}
.odv-phone-key {
  display: block;
  margin-top: 0.7rem;
  font-size: 0.8rem;
  color: var(--odv-faint);
  text-decoration: underline;
  text-decoration-color: var(--odv-line-soft);
  text-underline-offset: 4px;
}
`;
