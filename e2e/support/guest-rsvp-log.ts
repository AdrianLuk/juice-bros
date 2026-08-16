/** Local Docker stack only — Supabase's published demo keys, same as slot-cleanup.ts. */
const LOCAL_SUPABASE_API_URL = "http://127.0.0.1:54321";
const LOCAL_SUPABASE_SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

function serviceRoleHeaders(): Record<string, string> {
  return {
    apikey: LOCAL_SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${LOCAL_SUPABASE_SERVICE_ROLE_KEY}`,
  };
}

/**
 * `guest_rsvp_log` and `slot_links` are both `service_role`-only (issue #10) —
 * nothing in the app reads either through a User's own session, so verifying
 * the abuse-detection sweep (issue #13's 10.2) has to go direct against
 * PostgREST with the service-role key, the same posture `deleteCachedPlaces`
 * already established for reading/writing a service_role-only table from a
 * test.
 */
export async function slotLinkIdForToken(token: string): Promise<string> {
  const url = new URL(`${LOCAL_SUPABASE_API_URL}/rest/v1/slot_links`);
  url.searchParams.set("token", `eq.${token}`);
  url.searchParams.set("select", "id");

  const res = await fetch(url, { headers: serviceRoleHeaders() });
  if (!res.ok) {
    throw new Error(`reading slot_links for token ${token} failed: ${res.status} ${await res.text()}`);
  }

  const rows = (await res.json()) as { id: string }[];
  if (rows.length === 0) {
    throw new Error(`no slot_links row for token ${token}`);
  }
  return rows[0].id;
}

export type GuestRsvpLogRow = {
  guest_name: string;
  ip: string | null;
  flagged: boolean;
  created_at: string;
};

export async function guestRsvpLogForSlotLink(slotLinkId: string): Promise<GuestRsvpLogRow[]> {
  const url = new URL(`${LOCAL_SUPABASE_API_URL}/rest/v1/guest_rsvp_log`);
  url.searchParams.set("slot_link_id", `eq.${slotLinkId}`);
  url.searchParams.set("select", "guest_name,ip,flagged,created_at");
  url.searchParams.set("order", "created_at.asc");

  const res = await fetch(url, { headers: serviceRoleHeaders() });
  if (!res.ok) {
    throw new Error(`reading guest_rsvp_log for slot link ${slotLinkId} failed: ${res.status} ${await res.text()}`);
  }

  return res.json();
}
