"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { runItAgainHref } from "@/components/apps/match-mixer/lib/persistence/share-link";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { signInWithGoogleIdToken } from "@/lib/match-mixer/actions";
import { readGoogleSignInClientId } from "@/lib/match-mixer/env";
import type { MyMixer } from "@/lib/match-mixer/live-mixers";
import { MATCH_MIXER_ROOT, MY_MIXERS_PATH, organizerLinkPath } from "@/lib/match-mixer/routes";

/**
 * My Mixers (#691). `nights` is null when nobody is signed in, and `problem`
 * then says so. Each night opens as its Organizer Link does, and "Run it
 * again" opens the editor with that night's Roster and settings and no board
 * drawn. Nothing is written until the organizer goes live.
 */
export function MyMixers({ nights, problem }: { nights: MyMixer[] | null; problem: string | null }) {
  return (
    <div className="mm-sheet">
      <div className="mm-face mm-fixings">
        <header className="mm-head">
          <div className="mm-headline">
            <h1 className="mm-title">Match Mixer</h1>
            <p className="mm-meta">My Mixers</p>
          </div>
          <p className="mm-lede">
            {nights
              ? "Every night you've taken live, newest first. Open one to see its scores, or run it again with a fresh draw."
              : problem}
          </p>
        </header>

        <div className="mt-8 max-w-3xl">
          {nights === null ? (
            <SignIn />
          ) : nights.length === 0 ? (
            <p className="mm-note">
              You haven&rsquo;t taken a board live yet. Draw one on the{" "}
              <Link href={MATCH_MIXER_ROOT} prefetch={false} className="underline">
                Match Mixer page
              </Link>{" "}
              and press Go live. It will be here.
            </p>
          ) : (
            <section aria-labelledby="mm-mine-heading">
              <h2 id="mm-mine-heading" className="mm-legend mm-rail">
                Your nights
              </h2>
              <ul className="mm-mine">
                {nights.map((night) => (
                  <Night key={night.id} night={night} />
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function Night({ night }: { night: MyMixer }) {
  const date = new Date(night.wentLiveAt);
  const day = date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  return (
    <li className="mm-mine-row">
      <div>
        {/* The browser's own time zone: the server's would call a 7pm night tomorrow. */}
        <time className="mm-mine-when" dateTime={night.wentLiveAt} suppressHydrationWarning>
          {day}
        </time>
        <p className="mm-note">
          {night.players} players · {night.finishedAt ? "Finished" : "Live"}
        </p>
      </div>
      <div className="mm-mine-actions">
        <Link href={organizerLinkPath(night.organizerToken)} prefetch={false} className="mm-share" aria-label={`Open ${day}`}>
          Open
        </Link>
        <Link
          href={runItAgainHref(night.config, MATCH_MIXER_ROOT)}
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

function SignIn() {
  const router = useRouter();
  const clientId = readGoogleSignInClientId();
  const [problem, setProblem] = useState<string | null>(null);

  const signedIn = async (idToken: string, nonce: string) => {
    const { ok } = await signInWithGoogleIdToken(idToken, nonce).catch(() => ({ ok: false }));
    if (!ok) {
      setProblem("Google sign-in didn't work. Try again.");
      return;
    }
    router.refresh();
  };

  if (!clientId) {
    return (
      <p className="mm-note" data-tone="refused">
        Google sign-in isn&rsquo;t set up on this copy of the site.
      </p>
    );
  }
  return (
    <>
      <GoogleSignInButton
        clientId={clientId}
        next={MY_MIXERS_PATH}
        action={signedIn}
        signInPath={MY_MIXERS_PATH}
        unavailableText="Google sign-in isn't available in this browser. Open this page in Safari or Chrome."
      />
      <p className="mm-note mt-2" role="status" data-tone={problem ? "refused" : undefined}>
        {problem}
      </p>
    </>
  );
}
