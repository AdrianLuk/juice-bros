"use client";

import { useCallback, useRef, useState } from "react";
import Script from "next/script";
import { useRouter, unstable_rethrow } from "next/navigation";

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * "Continue with Google", rendered by Google Identity Services rather than
 * Supabase's OAuth-redirect flow (see Booking Buddy's ADR-0013 for the full
 * rationale; the short version is that the redirect showed Google's consent
 * screen as the raw Supabase project URL, not this app's own domain).
 *
 * This is transport, not domain logic — the same GSI script, nonce dance, and
 * button chrome for any app section that wants Google sign-in — so it lives
 * here and is shared, the way `booking-buddy/request-origin` already is. Each
 * context supplies its own `action` (a Server Action that hands the ID token
 * to `supabase.auth.signInWithIdToken` and then does whatever post-sign-in
 * work that context needs) and its own `signInPath` (where to bounce on
 * failure). Google's own button chrome replaces the shadcn `Button` used for
 * every other sign-in method — Google's branding guidelines require it — which
 * is an accepted tradeoff, not an oversight.
 */
export function GoogleSignInButton({
  clientId,
  next,
  action,
  signInPath,
}: {
  clientId: string;
  next: string;
  /**
   * Always ends in a Next.js redirect (success or handled failure). The raw
   * (un-hashed) nonce is the second argument — Supabase re-hashes it itself to
   * check against the ID token's `nonce` claim.
   */
  action: (idToken: string, nonce: string, next: string) => Promise<void>;
  /** Where to send the browser if GSI itself can't complete the exchange. */
  signInPath: string;
}) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [unavailable, setUnavailable] = useState(false);

  const initialize = useCallback(async () => {
    const container = containerRef.current;
    if (!window.google || !container) return;

    // Raw nonce travels to the Server Action; Google only ever sees (and
    // returns, inside the ID token) its SHA-256 hash. Supabase re-hashes the
    // raw value itself to check it against that claim. Without this, a stolen
    // ID token could be replayed to mint a session.
    const nonce = crypto.randomUUID();
    const hashedNonce = await sha256Hex(nonce);

    window.google.accounts.id.initialize({
      client_id: clientId,
      nonce: hashedNonce,
      use_fedcm_for_prompt: true,
      callback: async ({ credential }) => {
        try {
          await action(credential, nonce, next);
        } catch (error) {
          // `action` always ends in a Next.js redirect — that redirect throws
          // a control-flow error which must be allowed through, not treated as
          // a real failure.
          unstable_rethrow(error);
          router.push(`${signInPath}?error=google_unavailable`);
        }
      },
    });

    window.google.accounts.id.renderButton(container, {
      theme: "outline",
      size: "large",
      shape: "rectangular",
      text: "continue_with",
      width: String(container.offsetWidth || 300),
    });
  }, [clientId, next, action, signInPath, router]);

  if (unavailable) {
    return (
      <p className="text-center text-sm text-muted-foreground">
        Google sign-in isn&apos;t available in this browser. Try another method
        above.
      </p>
    );
  }

  return (
    <>
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onLoad={initialize}
        onError={() => setUnavailable(true)}
      />
      <div ref={containerRef} className="flex w-full justify-center" />
    </>
  );
}
