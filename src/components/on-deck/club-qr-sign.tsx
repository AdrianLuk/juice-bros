"use client";

import { useState } from "react";

export type Paper = "letter" | "a4";

const PAPERS: { value: Paper; label: string; hint: string }[] = [
  { value: "letter", label: "Letter", hint: "8.5 by 11 inches" },
  { value: "a4", label: "A4", hint: "210 by 297 mm" },
];

/**
 * The Club QR sign (issue #463) — one surface doing two jobs.
 *
 * On screen it is the Organizer holding a phone up at the door on a night the
 * printed sign isn't on the wall (the job #413 shipped this route for). On
 * paper it is the sign itself, which is the first line of the night's own
 * checklist. Drawing both from one piece of markup is the point: the copy is
 * written once, and an Organizer has already seen exactly what the printer
 * will hand back before spending a sheet on it. Everything that differs
 * between the two lives in `globals.css`, never in a second component.
 *
 * The code encodes `clubQrPath(club.id)` — the stable Club link, resolved
 * server-side by `clubJoinQr`. Never a per-Session URL: the whole premise of
 * a printed sign is that it is printed once and never reprinted.
 */
export function ClubQrSign({
  clubName,
  venueName,
  url,
  svg,
}: {
  clubName: string;
  venueName: string;
  url: string;
  svg: string;
}) {
  const [paper, setPaper] = useState<Paper>("letter");

  return (
    <>
      <div className="od-sign" data-paper={paper}>
        <p className="od-sign-brand">
          {/* eslint-disable-next-line @next/next/no-img-element -- local trusted SVG, and next/image would fetch at print time */}
          <img src="/brand/JB_Logo.svg" alt="" />
          <span>On Deck</span>
        </p>

        <p className="od-sign-club">{clubName}</p>
        <p className="od-sign-headline">Scan to join the queue</p>

        <div
          role="img"
          aria-label={`Scan to join at ${url}`}
          className="od-sign-qr"
          dangerouslySetInnerHTML={{ __html: svg }}
        />

        <p className="od-sign-url">{url}</p>

        <ol className="od-sign-steps">
          <li>
            <span className="od-sign-step-n" aria-hidden>
              1
            </span>
            <span>Point your camera at the code. No app, no sign-up.</span>
          </li>
          <li>
            <span className="od-sign-step-n" aria-hidden>
              2
            </span>
            <span>Put in your name and how you play.</span>
          </li>
          <li>
            <span className="od-sign-step-n" aria-hidden>
              3
            </span>
            <span>Watch the board. It calls you when a court comes free.</span>
          </li>
        </ol>

        <p className="od-sign-note">
          This is new, so tell a volunteer if anything looks off.
        </p>

        <p className="od-sign-venue">{venueName}</p>
      </div>

      {/* Named as one block so the print stylesheet takes the whole thing off
          the page in a single rule. Nothing you can change belongs on paper. */}
      <div className="od-sign-controls mt-8 flex flex-col items-center gap-4">
        <fieldset className="flex items-center gap-3">
          <legend className="sr-only">Paper size</legend>
          {PAPERS.map((option) => (
            <label
              key={option.value}
              className="flex cursor-pointer items-center gap-2 text-sm"
            >
              <input
                type="radio"
                name="paper"
                value={option.value}
                checked={paper === option.value}
                onChange={() => setPaper(option.value)}
                className="accent-brand-orange"
              />
              <span>{option.label}</span>
              <span className="sr-only">{option.hint}</span>
            </label>
          ))}
        </fieldset>

        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-full bg-brand-orange px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          Print the sign
        </button>
      </div>
    </>
  );
}
