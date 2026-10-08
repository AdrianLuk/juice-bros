import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { TeamTallySignInForm } from "@/components/team-tally/sign-in-form";
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
      <section className="bx-measure pt-12 pb-20 sm:pt-16 sm:pb-28">
        <div className="mx-auto max-w-md">
          <h1 className="bx-display text-[clamp(2rem,5vw,2.75rem)]">Sign in to Team Tally</h1>
          <p className="mt-4 text-[1.0625rem] leading-relaxed text-(--bx-muted)">
            For organizers. Captains score from the link in the brief, no account needed.
          </p>
          <div className="bx-panel mt-8 p-6 sm:p-8">
            <TeamTallySignInForm next={target} error={error} googleClientId={readGoogleSignInClientId()} />
          </div>
        </div>
      </section>
    </div>
  );
}
