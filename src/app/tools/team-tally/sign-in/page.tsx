import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { TeamTallySignInForm } from "@/components/team-tally/sign-in-form";
import { TtAppBar } from "@/components/team-tally/tt-head";
import { pageMetadata } from "@/lib/metadata";
import { getOptionalOrganizer } from "@/lib/team-tally/dal";
import { readGoogleSignInClientId } from "@/lib/team-tally/env";
import { TEAM_TALLY_SIGN_IN_PATH, safeRedirectTarget } from "@/lib/team-tally/routes";

export const metadata: Metadata = pageMetadata({
  title: "Sign in to Team Tally",
  description: "Sign in to build your team night and get its brief.",
  path: TEAM_TALLY_SIGN_IN_PATH,
});

export default async function TeamTallySignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  const target = safeRedirectTarget(next);

  if (await getOptionalOrganizer()) {
    redirect(target);
  }

  return (
    <div className="flex w-full flex-1 flex-col">
      <TtAppBar />
      <section className="tt-wrap pt-8 pb-20 sm:pt-12 sm:pb-28">
        <div className="mx-auto grid max-w-md gap-5 [&>*]:min-w-0">
          <h1 className="tt-title text-[clamp(2.25rem,6vw,3rem)]">Sign in to Team Tally</h1>
          <p className="tt-lead text-[1.0625rem]">
            For organizers. Captains score from the link in the brief, no account needed.
          </p>
          <div className="tt-sheet tt-section-body mt-3">
            <TeamTallySignInForm next={target} error={error} googleClientId={readGoogleSignInClientId()} />
          </div>
        </div>
      </section>
    </div>
  );
}
