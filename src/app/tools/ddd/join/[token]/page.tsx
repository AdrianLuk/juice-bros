import { redirect } from "next/navigation";

import { DddBar } from "@/components/ddd/ddd-head";
import { DddSignIn, SignOut } from "@/components/ddd/sign-in";
import { joinAction } from "@/lib/ddd/actions/auth";
import { getVisitor } from "@/lib/ddd/dal";
import { DDD_ROOT, invitePath } from "@/lib/ddd/routes";

/**
 * An invite link (issue #711). Signed out: sign in with Google, which joins
 * the Organizer list on the way back. Already signed in: one tap to join.
 * An Organizer opening it goes straight to the DDDs and leaves it unused.
 */
export default async function JoinPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const [{ token }, { error }, visitor] = await Promise.all([params, searchParams, getVisitor()]);
  if (visitor.kind === "organizer") redirect(DDD_ROOT);

  // A signed-out visitor here lost their session: signing in again retries the invite.
  if (error === "used" && visitor.kind === "not-organizer") {
    return (
      <>
        <DddBar title="This invite is used up" />
        <main className="ddd-main">
          <div className="ddd-col ddd-slip ddd-notice">
            <p>Each invite link adds one Organizer and lasts 7 days. Ask an Organizer for a new one.</p>
            <SignOut />
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <DddBar title="You're invited to organize" />
      <main className="ddd-main">
        <div className="ddd-col ddd-slip ddd-notice">
          <p>Organizers set up every Dink Dine &amp; Drink and run it on the day.</p>
          {visitor.kind === "signed-out" ? (
            <DddSignIn next={invitePath(token)} failed={error === "google_unavailable"} />
          ) : (
            <>
              <form action={joinAction.bind(null, token)}>
                <button type="submit" className="ddd-btn ddd-btn-wide">
                  Join as {visitor.email ?? "this account"}
                </button>
              </form>
              <SignOut />
            </>
          )}
        </div>
      </main>
    </>
  );
}
