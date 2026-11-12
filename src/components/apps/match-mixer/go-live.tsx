"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import type { BoardConfig } from "@/components/apps/match-mixer/lib/engine/pools";
import {
  recall,
  remember,
  type RememberedLive,
} from "@/components/apps/match-mixer/lib/persistence/live-storage";
import { encodeSharePayload } from "@/components/apps/match-mixer/lib/persistence/share-link";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { goLive, signInWithGoogleIdToken } from "@/lib/match-mixer/actions";
import { readGoogleSignInClientId } from "@/lib/match-mixer/env";
import { MATCH_MIXER_ROOT } from "@/lib/match-mixer/routes";

const UNREACHABLE =
  "Couldn't reach Match Mixer, so the board didn't go live. Your board is still here. Check your signal and try again.";

/**
 * Go Live (ADR 0006, #687): the one control on `/tools/match-mixer` that
 * touches the network, and only when pressed. A failure leaves the board on
 * screen as it was and says why. Success remembers the Organizer Link in this
 * browser and opens it.
 *
 * `config` is null while there is no board, or the board on screen is stale:
 * going live commits the board that is drawn, so it has to be the current one.
 */
export function GoLive({ config }: { config: BoardConfig | null }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [remembered, setRemembered] = useState<RememberedLive | null>(null);

  useEffect(() => {
    /* eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot read of browser storage after hydration */
    setRemembered(recall());
  }, []);

  // Set when Go Live came back asking for sign-in. Google's script only loads
  // from here, so a board that never goes live still fetches nothing.
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const clientId = readGoogleSignInClientId();

  const go = async () => {
    if (!config) return;
    setPending(true);
    setProblem(null);
    let outcome: Awaited<ReturnType<typeof goLive>>;
    try {
      outcome = await goLive(encodeSharePayload(config));
    } catch {
      outcome = { ok: false, problem: UNREACHABLE };
    }
    if (!outcome.ok) {
      setPending(false);
      setProblem(outcome.problem);
      if (outcome.signIn) setNeedsSignIn(true);
      return;
    }
    remember({ ...outcome.value, wentLiveAt: new Date().toISOString() });
    router.push(outcome.value.organizerPath);
  };

  // Signed in, it carries straight on: one tap of Google's button goes live.
  const signedIn = async (idToken: string, nonce: string) => {
    const { ok } = await signInWithGoogleIdToken(idToken, nonce).catch(() => ({ ok: false }));
    if (!ok) {
      setProblem("Google sign-in didn't work. Try again.");
      return;
    }
    setNeedsSignIn(false);
    await go();
  };

  return (
    <div className="mt-6">
      {config ? (
        <>
          <button
            type="button"
            className="mm-share"
            onClick={go}
            disabled={pending}
            aria-describedby="mm-go-live-note"
          >
            {pending ? "Going live…" : "Go live"}
          </button>
          <p className="mm-note mt-2" id="mm-go-live-note">
            Puts this board online with a link for the group chat. You sign in with Google so it&rsquo;s saved to your
            account, and players never need one. This is the one step that sends the names to our server.
          </p>
          <p className="mm-note mt-2" role="status" data-tone={problem ? "refused" : undefined}>
            {problem}
          </p>
          {needsSignIn ? (
            clientId ? (
              <div className="mt-2">
                <GoogleSignInButton
                  clientId={clientId}
                  next={MATCH_MIXER_ROOT}
                  action={signedIn}
                  signInPath={MATCH_MIXER_ROOT}
                  unavailableText="Google sign-in isn't available in this browser. Open this page in Safari or Chrome."
                />
              </div>
            ) : (
              <p className="mm-note mt-2" data-tone="refused">
                Google sign-in isn&rsquo;t set up on this copy of the site.
              </p>
            )
          ) : null}
        </>
      ) : null}
      {remembered ? (
        <p className="mm-note mt-2">
          Your last board went live on {when(remembered.wentLiveAt)}.{" "}
          {/* No prefetch: this page fetches nothing until Go Live is pressed. */}
          <Link href={remembered.organizerPath} prefetch={false} className="underline">
            Open its Organizer Link
          </Link>
        </p>
      ) : null}
    </div>
  );
}

function when(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}
