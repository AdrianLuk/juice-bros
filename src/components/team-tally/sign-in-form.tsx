"use client";

import { useActionState, useState } from "react";

import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import {
  signInWithGoogleIdToken,
  signInWithMagicLink,
  signInWithPassword,
  signUpWithPassword,
  type AuthFormState,
} from "@/lib/team-tally/actions/auth";
import { TEAM_TALLY_SIGN_IN_PATH } from "@/lib/team-tally/routes";

const EMPTY: AuthFormState = {};

type Mode = "magic-link" | "password" | "sign-up";

const ERRORS: Record<string, string> = {
  link_invalid: "That sign-in link has expired or was already used. Ask for a new one.",
  google_unavailable: "Google sign-in isn't working right now. Try another way.",
};

/**
 * Team Tally's sign-in, on the site's Broadcast Dark tokens. Kept plain on
 * purpose: Team Tally's own look arrives with #627.
 */
export function TeamTallySignInForm({
  next,
  error,
  googleClientId,
}: {
  next: string;
  error?: string;
  googleClientId?: string;
}) {
  const [mode, setMode] = useState<Mode>("magic-link");
  const [magicState, magicAction, magicPending] = useActionState(signInWithMagicLink, EMPTY);
  const [passwordState, passwordAction, passwordPending] = useActionState(signInWithPassword, EMPTY);
  const [signUpState, signUpAction, signUpPending] = useActionState(signUpWithPassword, EMPTY);

  if (magicState.sent || signUpState.sent) {
    return (
      <p className="text-[0.9375rem] leading-relaxed text-(--bx-muted)">
        Check your email. We&apos;ve sent you a sign-in link, and you can close this tab.
      </p>
    );
  }

  const formError =
    mode === "magic-link" ? magicState.error : mode === "password" ? passwordState.error : signUpState.error;

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <p role="alert" className="text-[0.9375rem] text-(--bx-ink)">
          {ERRORS[error] ?? "Something went wrong signing you in. Try again."}
        </p>
      )}

      {mode === "magic-link" && (
        <form action={magicAction} className="flex flex-col gap-4">
          <input type="hidden" name="next" value={next} />
          <Field id="tt-magic-email" label="Email" name="email" type="email" autoComplete="email" />
          <p className="text-sm text-(--bx-muted)">We&apos;ll email you a link. No password to remember.</p>
          <Submit pending={magicPending} idle="Email me a sign-in link" busy="Sending…" />
        </form>
      )}

      {mode === "password" && (
        <form action={passwordAction} className="flex flex-col gap-4">
          <input type="hidden" name="next" value={next} />
          <Field id="tt-password-email" label="Email" name="email" type="email" autoComplete="email" />
          <Field
            id="tt-password"
            label="Password"
            name="password"
            type="password"
            autoComplete="current-password"
          />
          <Submit pending={passwordPending} idle="Sign in" busy="Signing in…" />
        </form>
      )}

      {mode === "sign-up" && (
        <form action={signUpAction} className="flex flex-col gap-4">
          <input type="hidden" name="next" value={next} />
          <Field id="tt-signup-email" label="Email" name="email" type="email" autoComplete="email" />
          <Field
            id="tt-signup-password"
            label="Password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
          />
          <Submit pending={signUpPending} idle="Create account" busy="Creating account…" />
        </form>
      )}

      {formError && (
        <p role="alert" className="text-[0.9375rem] text-(--bx-ink)">
          {formError}
        </p>
      )}

      {googleClientId && (
        <div className="flex flex-col gap-4 border-t border-(--bx-line-soft) pt-6">
          <GoogleSignInButton
            clientId={googleClientId}
            next={next}
            action={signInWithGoogleIdToken}
            signInPath={TEAM_TALLY_SIGN_IN_PATH}
          />
        </div>
      )}

      <div className="flex flex-col items-start gap-2 border-t border-(--bx-line-soft) pt-5">
        {mode !== "magic-link" && (
          <button type="button" className="bx-quietlink" onClick={() => setMode("magic-link")}>
            Email me a link instead
          </button>
        )}
        {mode !== "password" && (
          <button type="button" className="bx-quietlink" onClick={() => setMode("password")}>
            Sign in with a password
          </button>
        )}
        {mode !== "sign-up" && (
          <button type="button" className="bx-quietlink" onClick={() => setMode("sign-up")}>
            Create an account with a password
          </button>
        )}
      </div>
    </div>
  );
}

function Field({
  id,
  label,
  ...input
}: { id: string; label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="bx-label">
        {label}
      </label>
      <input id={id} className="bx-field" required {...input} />
    </div>
  );
}

function Submit({ pending, idle, busy }: { pending: boolean; idle: string; busy: string }) {
  return (
    <button type="submit" disabled={pending} className="bx-btn bx-btn-play w-fit disabled:opacity-60">
      {pending ? busy : idle}
    </button>
  );
}
