import { DddBar } from "@/components/ddd/ddd-head";
import { DddForm } from "@/components/ddd/ddd-form";
import { verifyOrganizer } from "@/lib/ddd/dal";
import { createClient } from "@/lib/ddd/supabase/server";
import { listVenues } from "@/lib/ddd/venues";

/** Create a DDD: name, date, both venues and the courts. Organizers only. */
export default async function NewDddPage() {
  await verifyOrganizer();
  const venues = await listVenues(await createClient());

  return (
    <>
      <DddBar title="New DDD" />
      <main className="ddd-main">
        <div className="ddd-col">
          <DddForm venues={venues} />
        </div>
      </main>
    </>
  );
}
