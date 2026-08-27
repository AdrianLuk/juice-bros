"use client";

import { useCallback, useRef, useState } from "react";
import Script from "next/script";
import { useRouter, unstable_rethrow } from "next/navigation";

import { signInWithGoogleIdToken } from "@/lib/booking-buddy/actions/auth";
import { SIGN_IN_PATH } from "@/lib/booking-buddy/routes";

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * "Continue with Google", rendered by Google Identity Services rather than
 * Supabase's OAuth-redirect flow — see ADR-0013. Google's own button chrome
 * replaces the shadcn one used for every other sign-in method here; that's
 * an accepted tradeoff, not an oversight.
 */
export function GoogleSignInButton({
  clientId,
  next,
}: {
  clientId: string;
  next: string;
}) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [unavailable, setUnavailable] = useState(false);

  const initialize = useCallback(async () => {
    const container = containerRef.current;
    if (!window.google || !container) return;

    // Raw nonce travels to the Server Action below; Google only ever sees
    // (and returns, inside the ID token) its SHA-256 hash. Supabase re-hashes
    // the raw value itself to check it against that claim.
    const nonce = crypto.randomUUID();
    const hashedNonce = await sha256Hex(nonce);

    window.google.accounts.id.initialize({
      client_id: clientId,
      nonce: hashedNonce,
      use_fedcm_for_prompt: true,
      callback: async ({ credential }) => {
        try {
          await signInWithGoogleIdToken(credential, nonce, next);
        } catch (error) {
          // signInWithGoogleIdToken always ends in a Next.js redirect (success
          // or handled failure) — that redirect throws a control-flow error
          // which must be allowed through, not treated as a real failure.
          unstable_rethrow(error);
          router.push(`${SIGN_IN_PATH}?error=google_unavailable`);
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
  }, [clientId, next, router]);

  if (unavailable) {
    return (
      <p className="text-center text-sm text-muted-foreground">
        Google sign-in isn&apos;t available in this browser. Try another
        method above.
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
