"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { runItAgainHref } from "@/components/apps/match-mixer/lib/persistence/share-link";
import type { MyMixer, Outcome } from "@/lib/match-mixer/live-mixers";
import { MATCH_MIXER_ROOT, MY_MIXERS_PATH, organizerLinkPath } from "@/lib/match-mixer/routes";

import { MixerSignIn } from "./sign-in";

/**
 * My Mixers (#691). Signed out, `outcome` is the refusal that asks for
 * sign-in. Each Live Mixer opens as its Organizer Link does, and "Run it
 * again" opens the editor with its Roster and settings and no board drawn.
 * Nothing is written until the organizer goes live.
 */
export function MyMixers({ outcome }: { outcome: Outcome<MyMixer[]> }) {
  const router = useRouter();
  return (
    <div className="mm-sheet">
      <div className="mm-face mm-fixings">
        <header className="mm-head">
          <div className="mm-headline">
            <h1 className="mm-title">Match Mixer</h1>
            <p className="mm-meta">My Mixers</p>
          </div>
          <p className="mm-lede">
            {outcome.ok
              ? "Every board you've taken live, newest first. Open one to see its scores, or run it again with a fresh Seed."
              : outcome.problem}
          </p>
        </header>

        <div className="mt-8 max-w-3xl">
          {!outcome.ok ? (
            <MixerSignIn path={MY_MIXERS_PATH} onSignedIn={() => router.refresh()} />
          ) : outcome.value.length === 0 ? (
            <p className="mm-note">
              You haven&rsquo;t taken a board live yet. Make one on the{" "}
              <Link href={MATCH_MIXER_ROOT} prefetch={false} className="underline">
                Match Mixer page
              </Link>{" "}
              and press Go live. It will be here.
            </p>
          ) : (
            <section aria-labelledby="mm-mine-heading">
              <h2 id="mm-mine-heading" className="mm-legend mm-rail">
                Your Live Mixers
              </h2>
              <ul className="mm-mine">
                {outcome.value.map((mixer) => (
                  <MixerRow key={mixer.id} mixer={mixer} />
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function MixerRow({ mixer }: { mixer: MyMixer }) {
  const day = new Date(mixer.wentLiveAt).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  return (
    <li className="mm-mine-row">
      <div>
        {/* The browser's own time zone: the server's would call a 7pm start tomorrow. */}
        <time className="mm-mine-when" dateTime={mixer.wentLiveAt} suppressHydrationWarning>
          {day}
        </time>
        <p className="mm-note">
          {mixer.players} players · {mixer.finishedAt ? "Finished" : "Live"}
        </p>
      </div>
      <div className="mm-mine-actions">
        <Link href={organizerLinkPath(mixer.organizerToken)} prefetch={false} className="mm-share" aria-label={`Open ${day}`}>
          Open
        </Link>
        <Link
          href={runItAgainHref(mixer.config, MATCH_MIXER_ROOT)}
          prefetch={false}
          className="mm-share"
          aria-label={`Run it again, from ${day}`}
        >
          Run it again
        </Link>
      </div>
    </li>
  );
}
