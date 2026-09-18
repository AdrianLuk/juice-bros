"use client";

import Link from "next/link";

import { buildJoinMessage } from "@/lib/on-deck/join-message";
import { ON_DECK_QR_DISPLAY_PATH, ON_DECK_QR_HOLD_UP_PATH } from "@/lib/on-deck/routes";
import { useCopyToClipboard } from "@/components/on-deck/use-copy-to-clipboard";

/**
 * The first-night kit (issue #521, parent #512 / OD-6.8) — the two things
 * that actually have to happen before a brand-new Club's first Saturday, led
 * by the one that needs no hardware. Two items, not four: the Kiosk and the
 * Volunteer Link are capabilities rather than setup steps (see CONTEXT.md's
 * Floor Mode entry), and for this release's solo organizer both usually
 * resolve to "skip this" — a checklist where half the steps are optional
 * teaches that the product is more complicated than it is. Neither appears
 * here; both stay reachable from the floor screen once a Session is open.
 *
 * Shown while the Club has never closed a Session — home computes that once
 * (`pastSessions.length === 0`, the same read the past-nights rows use) and
 * this component trusts it rather than re-deriving it, so there is one place
 * that decides what "new" means. Deliberately outside the lit panel above:
 * that panel is "one thing lit" (tonight's one action), and this is
 * preparation rather than tonight's action, so it stays in the same readout
 * register as the rows beneath it.
 */
export function FirstNightKit({
  clubName,
  joinUrl,
}: {
  clubName: string;
  joinUrl: string;
}) {
  const message = buildJoinMessage(clubName, joinUrl);
  const { copied, copy } = useCopyToClipboard(message);

  return (
    <section
      className="od-kit"
      aria-labelledby="od-kit-heading"
      data-testid="first-night-kit"
    >
      <h2 id="od-kit-heading" className="od-readout text-arena-fg">
        Before your first night
      </h2>

      <div className="od-kit-item">
        <div className="od-kit-item-text">
          <p className="od-bo-lab">Put the join link in your group chat</p>
          <p className="od-bo-hint">
            Pin it once. It always points at whatever night is open, so you
            never post a new one.
          </p>
        </div>
        <button type="button" className="od-key od-key--chip" onClick={copy}>
          {copied ? "Copied" : "Copy the message"}
        </button>
      </div>

      <div className="od-kit-item">
        <div className="od-kit-item-text">
          <p className="od-bo-lab">Have the code ready for walk-ups</p>
          <p className="od-bo-hint">
            Show it from your own phone at the door — no printer needed.{" "}
            <Link
              href={ON_DECK_QR_DISPLAY_PATH}
              className="underline underline-offset-4"
            >
              Prefer a printed sign?
            </Link>
          </p>
        </div>
        <Link href={ON_DECK_QR_HOLD_UP_PATH} className="od-key od-key--chip">
          Show the code
        </Link>
      </div>
    </section>
  );
}
