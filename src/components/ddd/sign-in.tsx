import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { signInWithGoogleIdToken, signOut } from "@/lib/ddd/actions/auth";
import { readGoogleSignInClientId } from "@/lib/ddd/env";

/** The site's Google sign-in, landing on `next` (an invite link joins on the way). */
export function DddSignIn({ next, failed }: { next: string; failed: boolean }) {
  const clientId = readGoogleSignInClientId();
  return (
    <div className="ddd-signin">
      {failed ? (
        <p role="alert" className="ddd-problem">
          Google sign-in didn&apos;t work. Try again.
        </p>
      ) : null}
      {clientId ? (
        <GoogleSignInButton
          clientId={clientId}
          next={next}
          action={signInWithGoogleIdToken}
          signInPath={next}
          unavailableText="Google sign-in isn't available in this browser. Open this page in Safari or Chrome."
        />
      ) : (
        <p className="ddd-problem">Google sign-in isn&apos;t set up on this copy of the site.</p>
      )}
    </div>
  );
}

export function SignOut() {
  return (
    <form action={signOut}>
      <button type="submit" className="ddd-quiet">
        Sign out
      </button>
    </form>
  );
}
