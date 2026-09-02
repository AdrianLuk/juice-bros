/**
 * Seeds a local On Deck Organizer account and a Club, so the app can be
 * exercised by hand. Local Supabase stack only:
 *
 *   npm run seed:on-deck
 *
 * On Deck has no self-serve Club creation (spec #238 — the first Club is made
 * by hand), and RLS gives even the owner no INSERT on `on_deck_clubs`. So this
 * goes through the Auth admin API for the account and the service-role key for
 * the Club row, the same posture `e2e/support/on-deck.ts` takes.
 *
 * Idempotent — re-run it after `supabase db reset` (which wipes both tables)
 * or whenever you're not sure the Club is there. Prints the sign-in details
 * and the Club QR URL when it's done.
 *
 * What it does NOT do: start a Session. That's the one-tap "Start" button on
 * the Organizer home screen — the thing you're there to test.
 */

const API_URL = "http://127.0.0.1:54321";
/** Supabase's published local demo keys — safe to hard-code, local only. */
const SERVICE_ROLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const ORGANIZER_EMAIL = "on-deck-organizer@example.com";
const ORGANIZER_PASSWORD = "pickleball123";

const CLUB = {
  name: "TO Pickleball Club",
  venue_name: "Ramsden Park",
  court_count: 8,
  group_cap: 4,
  // hybrid exercises both the Volunteer Link and the Kiosk; switch to
  // 'self-serve' or 'volunteer-run' to test those in isolation.
  floor_mode: "hybrid",
};

if (!API_URL.includes("127.0.0.1")) {
  console.error("Refusing to run: this script is for the local stack only.");
  process.exit(1);
}

function serviceHeaders(): Record<string, string> {
  return {
    apikey: SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
  };
}

async function ensureOrganizer(): Promise<string> {
  const create = await fetch(`${API_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: serviceHeaders(),
    body: JSON.stringify({
      email: ORGANIZER_EMAIL,
      password: ORGANIZER_PASSWORD,
      email_confirm: true,
    }),
  });

  if (!create.ok) {
    const body = await create.text();
    if (!(create.status === 422 && body.includes("already been registered"))) {
      throw new Error(`creating the Organizer failed (${create.status}): ${body}`);
    }
  }

  // Look the id up either way — the create response and the list both carry it.
  const list = await fetch(
    `${API_URL}/auth/v1/admin/users?per_page=1000`,
    { headers: serviceHeaders() },
  );
  if (!list.ok) {
    throw new Error(`listing users failed: ${list.status} ${await list.text()}`);
  }
  const { users } = (await list.json()) as {
    users: { id: string; email: string }[];
  };
  const user = users.find((u) => u.email === ORGANIZER_EMAIL);
  if (!user) {
    throw new Error(`no auth user for ${ORGANIZER_EMAIL} after create`);
  }
  return user.id;
}

async function ensureClub(ownerId: string): Promise<string> {
  // One Club per owner (a partial unique index). Clear any existing one so a
  // re-run starts from the config above rather than silently keeping a stale
  // row.
  await fetch(`${API_URL}/rest/v1/on_deck_clubs?owner_id=eq.${ownerId}`, {
    method: "DELETE",
    headers: serviceHeaders(),
  });

  const res = await fetch(`${API_URL}/rest/v1/on_deck_clubs`, {
    method: "POST",
    headers: { ...serviceHeaders(), Prefer: "return=representation" },
    body: JSON.stringify({ owner_id: ownerId, ...CLUB }),
  });
  if (!res.ok) {
    throw new Error(`seeding the Club failed: ${res.status} ${await res.text()}`);
  }
  const [club] = (await res.json()) as { id: string }[];
  return club.id;
}

const ownerId = await ensureOrganizer();
const clubId = await ensureClub(ownerId);

console.log(`
On Deck local seed ready.

  Organizer sign-in   http://localhost:3000/on-deck/sign-in
    email             ${ORGANIZER_EMAIL}
    password          ${ORGANIZER_PASSWORD}

  Club                ${CLUB.name} @ ${CLUB.venue_name}
    courts            ${CLUB.court_count}
    floor mode        ${CLUB.floor_mode}
    Club QR / join    http://localhost:3000/on-deck/c/${clubId}

Next: sign in, tap Start on the home screen to open a Session, then open the
Club QR link in another browser (or an incognito window) to join as a Player.
`);
