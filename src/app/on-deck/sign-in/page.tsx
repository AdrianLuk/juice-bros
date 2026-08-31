import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { pageMetadata } from "@/lib/metadata";
import { PageHeading } from "@/components/typography/page-heading";
import { OnDeckSignInForm } from "@/components/on-deck/sign-in-form";
import { getOptionalOrganizer } from "@/lib/on-deck/dal";
import { safeRedirectTarget } from "@/lib/on-deck/routes";

export const metadata: Metadata = pageMetadata({
  title: "Sign in to On Deck",
  description: "Sign in to start tonight's session and run the floor.",
  path: "/on-deck/sign-in",
});

export default async function OnDeckSignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  const target = safeRedirectTarget(next);

  // Already signed in? Don't make them sign in again.
  const organizer = await getOptionalOrganizer();
  if (organizer) {
    redirect(target);
  }

  return (
    <div className="flex w-full flex-1 flex-col">
      <section className="w-full px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-md">
          <PageHeading
            eyebrow="On Deck"
            title="Sign in"
            description="For Organizers. Players join by scanning the sign at the venue, no account needed."
          />

          <div className="mt-8 rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
            <OnDeckSignInForm next={target} error={error} />
          </div>
        </div>
      </section>
    </div>
  );
}
