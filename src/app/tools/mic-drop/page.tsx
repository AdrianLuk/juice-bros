import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { NewPollForm } from "@/components/mic-drop/host-controls";
import { MicDropLanding } from "@/components/mic-drop/landing";
import { signInWithGoogleIdToken, signOut } from "@/lib/mic-drop/actions/host";
import { getVisitor } from "@/lib/mic-drop/dal";
import { readGoogleSignInClientId } from "@/lib/mic-drop/env";
import { listPolls } from "@/lib/mic-drop/polls";
import { MIC_DROP_ROOT, pollPath } from "@/lib/mic-drop/routes";
import { createClient } from "@/lib/mic-drop/supabase/server";

export const metadata: Metadata = {
  title: "Mic Drop: the karaoke vote",
  description:
    "Everyone backs their favourite Contestant from their own phone, and the chart re-sorts as the Votes come in. Free, nothing to install, and Guests don't sign in.",
};

/**
 * Mic Drop's front door (issue #668). Signed out it's the landing, a preview
 * with a demo chart and the Host's Google sign-in at the bottom; an account
 * off the allowlist is told it can't host, and a Host gets their Polls.
 * Unlisted: the layout keeps it out of search and off the Tools page.
 */
export default async function MicDropPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const visitor = await getVisitor();

  if (visitor.kind === "signed-out") {
    const { error } = await searchParams;
    const clientId = readGoogleSignInClientId();
    return (
      <MicDropLanding
        hostSignIn={
          <>
        {error && (
          <p role="alert" className="md-problem">
            Google sign-in didn&apos;t work. Try again.
          </p>
        )}
        {clientId ? (
          <div className="md-google">
            <GoogleSignInButton
              clientId={clientId}
              next={MIC_DROP_ROOT}
              action={signInWithGoogleIdToken}
              signInPath={MIC_DROP_ROOT}
              unavailableText="Google sign-in isn't available in this browser. Open this page in Safari or Chrome."
            />
          </div>
        ) : (
          <p className="md-problem">Google sign-in isn&apos;t set up on this copy of the site.</p>
        )}
          </>
        }
      />
    );
  }

  if (visitor.kind === "not-host") {
    return (
      <div className="md-notice">
        <h1>Can&apos;t host</h1>
        <p>
          This account can&apos;t host Mic Drop Polls. To vote, open the Guest Link from the group
          chat: Guests don&apos;t sign in.
        </p>
        <SignOut />
      </div>
    );
  }

  const polls = await listPolls(await createClient());

  return (
    <>
      <header className="md-field">
        <div className="md-col">
          <h1>Your Polls</h1>
          <div className="md-field-meta">
            <span>Mic Drop</span>
            <span>
              {polls.length} {polls.length === 1 ? "Poll" : "Polls"}
            </span>
          </div>
        </div>
      </header>
      <div className="md-host">
        <div className="md-col">
          <NewPollForm />
          {polls.length > 0 && (
            <ul className="md-polls">
              {polls.map((poll) => (
                <li key={poll.id}>
                  <Link href={pollPath(poll.id)} className="md-poll-row">
                    <span className="md-poll-name">{poll.name}</span>
                    <span className="md-poll-meta">
                      <span className={poll.open ? "md-state is-live" : "md-state"}>
                        {poll.open ? "Live" : "Final"}
                      </span>
                      {poll.contestantCount} {poll.contestantCount === 1 ? "Contestant" : "Contestants"} ·{" "}
                      {started(poll.createdAt)}
                    </span>
                    <ChevronRight aria-hidden size={20} className="md-poll-go" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <SignOut />
        </div>
      </div>
    </>
  );
}

function SignOut() {
  return (
    <form action={signOut}>
      <button type="submit" className="md-quiet">
        Sign out
      </button>
    </form>
  );
}

/** "Nov 28", in the club's time zone. */
function started(at: string): string {
  return new Date(at).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/Toronto" });
}
