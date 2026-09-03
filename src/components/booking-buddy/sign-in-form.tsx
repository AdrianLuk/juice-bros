"use client";

import { useActionState, useState } from "react";
import { MailCheckIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  signInWithMagicLink,
  signInWithPassword,
  signUpWithPassword,
  signInWithGoogleIdToken,
  type AuthFormState,
} from "@/lib/booking-buddy/actions/auth";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { SIGN_IN_PATH } from "@/lib/booking-buddy/routes";

const EMPTY: AuthFormState = {};

type Mode = "magic-link" | "password" | "sign-up";

export function SignInForm({
  next,
  error,
  googleClientId,
}: {
  next: string;
  error?: string;
  googleClientId?: string;
}) {
  const [mode, setMode] = useState<Mode>("magic-link");

  const [magicState, magicAction, magicPending] = useActionState(
    signInWithMagicLink,
    EMPTY,
  );
  const [passwordState, passwordAction, passwordPending] = useActionState(
    signInWithPassword,
    EMPTY,
  );
  const [signUpState, signUpAction, signUpPending] = useActionState(
    signUpWithPassword,
    EMPTY,
  );

  if (magicState.sent) {
    return (
      <div className="flex flex-col items-center gap-3 py-4 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <MailCheckIcon className="size-6" />
        </div>
        <p className="text-sm">
          Check your email. We&apos;ve sent you a sign-in link. You can close
          this tab.
        </p>
      </div>
    );
  }

  if (signUpState.sent) {
    return (
      <div className="flex flex-col items-center gap-3 py-4 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <MailCheckIcon className="size-6" />
        </div>
        <p className="text-sm">
          Almost there. Confirm your email address using the link we just sent,
          then sign in.
        </p>
      </div>
    );
  }

  return (
    <div>
      {error && (
        <p className="mb-4 text-sm text-destructive" role="alert">
          {error === "link_invalid"
            ? "That sign-in link has expired or was already used. Request a new one."
            : error === "google_unavailable"
              ? "Google sign-in isn't available right now. Try another method."
              : "Something went wrong signing you in. Try again."}
        </p>
      )}

      {mode === "magic-link" && (
        <form action={magicAction} className="flex flex-col gap-3">
          <input type="hidden" name="next" value={next} />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="magic-email">Email</Label>
            <Input
              id="magic-email"
              name="email"
              type="email"
              autoComplete="email"
              required
            />
          </div>
          <p className="text-sm text-muted-foreground">
            We&apos;ll email you a link. No password to remember.
          </p>
          {magicState.error && (
            <p className="text-sm text-destructive" role="alert">
              {magicState.error}
            </p>
          )}
          <Button type="submit" disabled={magicPending}>
            {magicPending ? "Sending…" : "Email me a sign-in link"}
          </Button>
        </form>
      )}

      {mode === "password" && (
        <form action={passwordAction} className="flex flex-col gap-3">
          <input type="hidden" name="next" value={next} />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password-email">Email</Label>
            <Input
              id="password-email"
              name="email"
              type="email"
              autoComplete="email"
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </div>
          {passwordState.error && (
            <p className="text-sm text-destructive" role="alert">
              {passwordState.error}
            </p>
          )}
          <Button type="submit" disabled={passwordPending}>
            {passwordPending ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      )}

      {mode === "sign-up" && (
        <form action={signUpAction} className="flex flex-col gap-3">
          <input type="hidden" name="next" value={next} />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="signup-name">Your name</Label>
            <Input
              id="signup-name"
              name="display_name"
              autoComplete="name"
              placeholder="How friends will see you"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="signup-email">Email</Label>
            <Input
              id="signup-email"
              name="email"
              type="email"
              autoComplete="email"
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="signup-password">Password</Label>
            <Input
              id="signup-password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>
          {signUpState.error && (
            <p className="text-sm text-destructive" role="alert">
              {signUpState.error}
            </p>
          )}
          <Button type="submit" disabled={signUpPending}>
            {signUpPending ? "Creating account…" : "Create account"}
          </Button>
        </form>
      )}

      {googleClientId && (
        <>
          <div className="my-6 flex items-center gap-3">
            <span className="h-px flex-1 bg-border" />
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              or
            </span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <GoogleSignInButton
            clientId={googleClientId}
            next={next}
            action={signInWithGoogleIdToken}
            signInPath={SIGN_IN_PATH}
          />
        </>
      )}

      <div className="mt-6 flex flex-col gap-0.5 text-sm">
        {mode !== "magic-link" && (
          <button
            type="button"
            className="-mx-2 rounded-md px-2 py-1.5 text-left text-muted-foreground transition-colors hover:bg-muted hover:text-primary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            onClick={() => setMode("magic-link")}
          >
            Email me a link instead
          </button>
        )}
        {mode !== "password" && (
          <button
            type="button"
            className="-mx-2 rounded-md px-2 py-1.5 text-left text-muted-foreground transition-colors hover:bg-muted hover:text-primary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            onClick={() => setMode("password")}
          >
            Sign in with a password
          </button>
        )}
        {mode !== "sign-up" && (
          <button
            type="button"
            className="-mx-2 rounded-md px-2 py-1.5 text-left text-muted-foreground transition-colors hover:bg-muted hover:text-primary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            onClick={() => setMode("sign-up")}
          >
            Create an account with a password
          </button>
        )}
      </div>
    </div>
  );
}
