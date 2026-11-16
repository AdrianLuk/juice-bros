import type { Metadata } from "next";

import { MyMixers } from "@/components/apps/match-mixer/my-mixers";
import { myMixers } from "@/lib/match-mixer/live-mixers";
import { createClient } from "@/lib/match-mixer/supabase/server";

export const metadata: Metadata = {
  title: "My Mixers · Match Mixer",
  robots: { index: false, follow: false },
};

/**
 * My Mixers (#691): every Live Mixer the signed-in organizer has taken live,
 * finished ones included, each with a way to open it and to run it again.
 * Signed out, it asks for sign-in and lists nothing.
 */
export default async function MyMixersPage() {
  const outcome = await myMixers(await createClient());
  return (
    <div className="flex w-full flex-1 flex-col">
      <MyMixers nights={outcome.ok ? outcome.value : null} problem={outcome.ok ? null : outcome.problem} />
    </div>
  );
}
