"use client";

import { useState } from "react";

import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { signInWithGoogleIdToken } from "@/lib/match-mixer/actions";
import { readGoogleSignInClientId } from "@/lib/match-mixer/env";

/**
 * Match Mixer's Google sign-in, for the two places an organizer is asked for
 * it: Go Live and My Mixers. No redirect: the caller carries straight on with
 * `onSignedIn`. Google's script only loads from here, so a screen that never
 * asks for sign-in fetches nothing. `path` is where the shared button returns
 * to when this browser can't run the script's popup.
 */
export function MixerSignIn({ path, onSignedIn }: { path: string; onSignedIn: () => void | Promise<void> }) {
  const clientId = readGoogleSignInClientId();
  const [problem, setProblem] = useState<string | null>(null);

  if (!clientId) {
    return (
      <p className="mm-note mt-2" data-tone="refused">
        Google sign-in isn&rsquo;t set up on this copy of the site.
      </p>
    );
  }

  const signedIn = async (idToken: string, nonce: string) => {
    const { ok } = await signInWithGoogleIdToken(idToken, nonce).catch(() => ({ ok: false }));
    if (!ok) {
      setProblem("Google sign-in didn't work. Try again.");
      return;
    }
    await onSignedIn();
  };

  return (
    <>
      <div className="mt-2">
        <GoogleSignInButton
          clientId={clientId}
          next={path}
          action={signedIn}
          signInPath={path}
          unavailableText="Google sign-in isn't available in this browser. Open this page in Safari or Chrome."
        />
      </div>
      <p className="mm-note mt-2" role="status" data-tone={problem ? "refused" : undefined}>
        {problem}
      </p>
    </>
  );
}
