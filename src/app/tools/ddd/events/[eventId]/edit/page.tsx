import { notFound } from "next/navigation";

import { DddHead } from "@/components/ddd/ddd-head";
import { DddForm } from "@/components/ddd/ddd-form";
import { verifyOrganizer } from "@/lib/ddd/dal";
import { getEvent } from "@/lib/ddd/events";
import { dddPath } from "@/lib/ddd/routes";
import { createClient } from "@/lib/ddd/supabase/server";
import { listVenues } from "@/lib/ddd/venues";

/** Change a DDD's setup. Any Organizer, on any DDD. */
export default async function EditDddPage({ params }: { params: Promise<{ eventId: string }> }) {
  await verifyOrganizer();
  const { eventId } = await params;
  const supabase = await createClient();
  const [event, venues] = await Promise.all([getEvent(supabase, eventId), listVenues(supabase)]);
  if (!event) notFound();

  return (
    <>
      <DddHead event={event} back={{ href: dddPath(event.id), label: "Back to the DDD" }} />
      <main className="ddd-main">
        <div className="ddd-col">
          <DddForm venues={venues} event={event} />
        </div>
      </main>
    </>
  );
}
