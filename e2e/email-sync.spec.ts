import { expect, test } from "@playwright/test";

import { AMY, BEN, signIn } from "./support/sign-in.ts";
import { GmailMock, type MockGmailMessage } from "./support/gmail-mock.ts";
import { addPlace, logBooking, placeName, removePlace, row } from "./support/places.ts";

/**
 * Connect/disconnect Gmail (issue #62), and "Sync from Email" — the review
 * screen that turns a matched CourtReserve confirmation into a real Booking
 * (issue #64).
 *
 * `EMAIL_SYNC_ALLOWLIST` is fixed to `benbackhand` in `playwright.config.ts`,
 * so Ben stands in for an approved User throughout and Amy stands in for an
 * unapproved one — real allowlist config, not a per-test override, mirroring
 * how `GMAIL_API_BASE_URL` is fixed for the whole run rather than per test.
 */

/**
 * CourtReserve's real template shape (see courtreserve-email.ts's own header
 * comment) — an `<img alt>` logo for the facility name, and an `<h4>`
 * heading immediately followed by an `<h5>` value per field group. A fixed
 * future date well past this suite's own "today" so the past-date filter
 * never has to be timing-sensitive.
 */
function confirmationEmail(fields: {
  id: string;
  facility: string;
  court?: string;
  players?: string;
  receivedAt?: number;
}): MockGmailMessage {
  const { id, facility, court = "Court 3", players = "Amy Ace, Ben Backhand", receivedAt } = fields;
  return {
    id,
    receivedAt,
    subject: "Booking Confirmation for Monday, 2027-03-15 6:00 PM - 7:00 PM",
    html:
      `<html><body><img border="0" src="https://example.com/logo.jpg" alt="${facility}">` +
      `<h1>Confirmation</h1>` +
      `<h4>Details</h4><h5>Doubles<br>Monday, 3-15-2027<br>6:00 PM - 7:00 PM</h5>` +
      `<h4>Player(s)</h4><h5>${players}</h5>` +
      `<h4>Court(s)</h4><h5>${court}</h5>` +
      `</body></html>`,
  };
}

/**
 * CourtReserve's real cancellation template (issue #65) — an "Cancellation
 * Details" heading whose value bundles the player's own name in front of the
 * same format/date/time lines a confirmation's "Details" block carries, and
 * no Court(s) section at all (see courtreserve-email.ts's own header
 * comment) — `matchCancellationToBooking` deliberately doesn't key on court
 * for that reason.
 */
function cancellationEmail(fields: { id: string; facility: string; receivedAt?: number }): MockGmailMessage {
  const { id, facility, receivedAt } = fields;
  return {
    id,
    receivedAt,
    subject: "Reservation Cancellation Notice",
    html:
      `<html><body><img border="0" src="https://example.com/logo.jpg" alt="${facility}">` +
      `<h1>Reservation Cancellation</h1>` +
      `<h4>Cancellation Details</h4><h5>Amy Ace<br>Doubles<br>Monday, 3-15-2027<br>6:00 PM - 7:00 PM</h5>` +
      `</body></html>`,
  };
}

/**
 * CourtReserve's real Reservation Update template (issue #91) — a
 * "Reservation Details" heading (not "Details") whose value bundles the
 * court label in as a fourth `<br>`-joined line, with no separate Court(s)
 * section at all (see courtreserve-email.ts's own header comment).
 */
function updateEmail(fields: {
  id: string;
  facility: string;
  format?: string;
  court?: string;
  players?: string;
  receivedAt?: number;
}): MockGmailMessage {
  const {
    id,
    facility,
    format = "Doubles",
    court = "Court 3",
    players = "Amy Ace, Ben Backhand",
    receivedAt,
  } = fields;
  return {
    id,
    receivedAt,
    subject: "Reservation Update Notice",
    html:
      `<html><body><img border="0" src="https://example.com/logo.jpg" alt="${facility}">` +
      `<h1>Reservation Update</h1>` +
      `<h4>Reservation Details</h4><h5>${format}<br>Monday, 3-15-2027<br>6:00 PM - 7:00 PM<br>${court}</h5>` +
      `<h4>Player(s)</h4><h5>${players}</h5>` +
      `</body></html>`,
  };
}

function messageId() {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

let mock: GmailMock;

test.beforeAll(async () => {
  mock = new GmailMock();
  await mock.start();
});

test.afterAll(async () => {
  await mock.stop();
});

test.beforeEach(() => {
  mock.reset();
});

/** Leaves Ben disconnected for the next test/run, same discipline settings.spec.ts uses for Username. */
test.afterEach(async ({ page }) => {
  await page.goto("/booking-buddy/settings");
  const disconnect = page.getByRole("button", { name: "Disconnect" });
  if (await disconnect.isVisible().catch(() => false)) {
    await disconnect.click();
    await expect(page.getByRole("button", { name: "Connect Gmail" })).toBeVisible();
  }
});

test("a non-allowlisted User sees an invite-only note instead of the working section", async ({ page }) => {
  await signIn(page, AMY, "/booking-buddy/settings");

  await expect(page.getByRole("heading", { name: "Sync from Email" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Connect Gmail" })).toHaveCount(0);
  await expect(page.getByText("it's invite-only for now", { exact: false })).toBeVisible();
  await expect(page.getByRole("link", { name: "Request access" })).toHaveAttribute("href", "/contact");
});

test("an allowlisted User sees the section, with no Mailbox Link connected yet", async ({ page }) => {
  await signIn(page, BEN, "/booking-buddy/settings");

  await expect(page.getByRole("heading", { name: "Sync from Email" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Connect Gmail" })).toBeVisible();
});

test("connecting runs the real OAuth redirect and stores the Mailbox Link", async ({ page }) => {
  mock.registerAccount({
    email: "ben.pickleball@gmail.com",
    accessToken: "mock-access-token",
    refreshToken: "mock-refresh-token",
  });

  await signIn(page, BEN, "/booking-buddy/settings");
  await page.getByRole("button", { name: "Connect Gmail" }).click();

  await page.waitForURL((url) => url.searchParams.get("gmail_connected") === "1");
  await expect(page.getByText("Connected as ben.pickleball@gmail.com")).toBeVisible();

  // Not just the optimistic redirect state — it survives a fresh read.
  await page.reload();
  await expect(page.getByText("Connected as ben.pickleball@gmail.com")).toBeVisible();
  await expect(page.getByRole("button", { name: "Disconnect" })).toBeVisible();
});

test("disconnecting removes the Mailbox Link", async ({ page }) => {
  mock.registerAccount({
    email: "ben.pickleball@gmail.com",
    accessToken: "mock-access-token",
    refreshToken: "mock-refresh-token",
  });

  await signIn(page, BEN, "/booking-buddy/settings");
  await page.getByRole("button", { name: "Connect Gmail" }).click();
  await page.waitForURL((url) => url.searchParams.get("gmail_connected") === "1");

  await page.getByRole("button", { name: "Disconnect" }).click();
  await expect(page.getByRole("button", { name: "Connect Gmail" })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("button", { name: "Connect Gmail" })).toBeVisible();
  await expect(page.getByText("Connected as", { exact: false })).toHaveCount(0);
});

test("a failed token exchange reports it honestly, without creating a Mailbox Link", async ({ page }) => {
  mock.registerTokenFailure("unreachable");

  await signIn(page, BEN, "/booking-buddy/settings");
  await page.getByRole("button", { name: "Connect Gmail" }).click();

  await page.waitForURL((url) => url.searchParams.get("error") === "gmail_connect_failed");
  await expect(
    page.getByRole("alert").filter({ hasText: "Couldn't connect Gmail" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Connect Gmail" })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("button", { name: "Connect Gmail" })).toBeVisible();
});

/**
 * "Sync from Email" (issue #64) lives on the Bookings page, not Settings —
 * connecting still happens on Settings (above), so every test here starts
 * with that same connect step before moving to Bookings.
 */
test.describe("Sync from Email", () => {
  test.afterEach(async ({ page }) => {
    await page.goto("/booking-buddy/orgs");
    const strays = row(page, "Playwright");
    for (let left = await strays.count(); left > 0; left--) {
      await strays.first().getByRole("button", { name: "Remove" }).click();
      await page.getByRole("button", { name: "Remove facility" }).click();
      await expect(strays).toHaveCount(left - 1);
    }
  });

  test("syncing shows a fixture candidate for a matched facility, and confirming it creates a real Booking", async ({
    page,
  }) => {
    mock.registerAccount({
      email: "ben.pickleball@gmail.com",
      accessToken: "mock-access-token",
      refreshToken: "mock-refresh-token",
    });

    const facility = placeName();
    await signIn(page, BEN, "/booking-buddy/orgs");
    await addPlace(page, facility);

    await page.goto("/booking-buddy/settings");
    await page.getByRole("button", { name: "Connect Gmail" }).click();
    await page.waitForURL((url) => url.searchParams.get("gmail_connected") === "1");

    mock.registerMessages([confirmationEmail({ id: messageId(), facility })]);

    await page.goto("/booking-buddy/bookings");
    await page.getByRole("button", { name: "Sync from Email" }).click();

    // Scoped by its own "Confirm" button, not just the facility name — once
    // confirmed, the facility name also appears in the "Booked" list below,
    // which a plain text filter would otherwise still match.
    const card = page.getByRole("listitem").filter({ has: page.getByRole("button", { name: "Confirm" }) });
    await expect(card).toBeVisible();
    await expect(card).toContainText(facility);
    // The facility name matched an existing Org, so the picker is already
    // prefilled rather than left on the "Pick a facility" placeholder.
    // `exact` so this doesn't also catch the "Why isn't my facility in the
    // list?" hint button beside the label (#270).
    await expect(card.getByLabel("Facility", { exact: true })).not.toHaveValue("");

    await card.getByRole("button", { name: "Confirm" }).click();
    // insertValidatedBooking's own revalidatePath re-renders the server
    // half of this same page (the "Booked" list below), which can take a
    // moment longer than the default timeout under a cold dev-server compile.
    await expect(page.getByText("No new bookings found.")).toBeVisible({ timeout: 15_000 });
    await expect(card).toHaveCount(0);

    const booking = row(page, "Court 3");
    await expect(booking).toContainText(facility);

    await removePlace(page, facility);
  });

  test("dismissing a candidate means a second sync never shows it again", async ({ page }) => {
    mock.registerAccount({
      email: "ben.pickleball@gmail.com",
      accessToken: "mock-access-token",
      refreshToken: "mock-refresh-token",
    });

    const facility = placeName();
    await signIn(page, BEN, "/booking-buddy/orgs");
    await addPlace(page, facility);

    await page.goto("/booking-buddy/settings");
    await page.getByRole("button", { name: "Connect Gmail" }).click();
    await page.waitForURL((url) => url.searchParams.get("gmail_connected") === "1");

    mock.registerMessages([confirmationEmail({ id: messageId(), facility })]);

    await page.goto("/booking-buddy/bookings");
    await page.getByRole("button", { name: "Sync from Email" }).click();

    const card = page.getByRole("listitem").filter({ hasText: facility });
    await expect(card).toBeVisible();
    await card.getByRole("button", { name: "Dismiss" }).click();
    await expect(card).toHaveCount(0);

    await page.getByRole("button", { name: "Sync from Email" }).click();
    await expect(page.getByText("No new bookings found.")).toBeVisible();
    await expect(page.getByRole("listitem").filter({ hasText: facility })).toHaveCount(0);

    await removePlace(page, facility);
  });

  test("a confirm/cancel/confirm/cancel/confirm chain for the same slot nets down to a single candidate with the final player list (issue #88)", async ({
    page,
  }) => {
    mock.registerAccount({
      email: "ben.pickleball@gmail.com",
      accessToken: "mock-access-token",
      refreshToken: "mock-refresh-token",
    });

    const facility = placeName();
    await signIn(page, BEN, "/booking-buddy/orgs");
    await addPlace(page, facility);

    await page.goto("/booking-buddy/settings");
    await page.getByRole("button", { name: "Connect Gmail" }).click();
    await page.waitForURL((url) => url.searchParams.get("gmail_connected") === "1");

    // The real-world shape (issue #88): editing a reservation twice (e.g.
    // adding a player) resends a cancellation and a fresh confirmation each
    // time. `receivedAt` fixes the chronological order — deliberately not
    // the same as registration order below, so this also exercises that
    // reconciliation sorts by the email's own timestamp, not array order.
    mock.registerMessages([
      confirmationEmail({
        id: messageId(),
        facility,
        players: "Alice Tsang, Sam Wong, Adrian Luk, Janice Kwan, Calvin Yu",
        receivedAt: 5,
      }),
      cancellationEmail({ id: messageId(), facility, receivedAt: 2 }),
      confirmationEmail({
        id: messageId(),
        facility,
        players: "Alice Tsang, Adrian Luk, Sam Wong, Calvin Yu",
        receivedAt: 1,
      }),
      confirmationEmail({
        id: messageId(),
        facility,
        players: "Alice Tsang, Sam Wong, Adrian Luk, Calvin Yu",
        receivedAt: 3,
      }),
      cancellationEmail({ id: messageId(), facility, receivedAt: 4 }),
    ]);

    await page.goto("/booking-buddy/bookings");
    await page.getByRole("button", { name: "Sync from Email" }).click();

    // Exactly one candidate — the two earlier confirm/cancel pairs net away
    // entirely, not five separate cards (three confirms + two "no matching
    // booking found" notices).
    await expect(page.getByRole("listitem").filter({ hasText: facility })).toHaveCount(1);

    const card = page.getByRole("listitem").filter({ has: page.getByRole("button", { name: "Confirm" }) });
    await expect(card).toBeVisible();
    await expect(card).toContainText("Alice Tsang, Sam Wong, Adrian Luk, Janice Kwan, Calvin Yu");
    await expect(page.getByText("No matching booking found", { exact: false })).toHaveCount(0);

    await card.getByRole("button", { name: "Confirm" }).click();
    await expect(page.getByText("No new bookings found.")).toBeVisible({ timeout: 15_000 });

    const booking = row(page, "Court 3");
    await expect(booking).toContainText(facility);

    await removePlace(page, facility);
  });

  test("a cancellation matching a logged Booking appears as a candidate, and confirming it removes the Booking (issue #65)", async ({
    page,
  }) => {
    mock.registerAccount({
      email: "ben.pickleball@gmail.com",
      accessToken: "mock-access-token",
      refreshToken: "mock-refresh-token",
    });

    const facility = placeName();
    await signIn(page, BEN, "/booking-buddy/orgs");
    await addPlace(page, facility);
    await logBooking(page, { place: facility, court: "3", date: "2027-03-15", start: "18:00", end: "19:00" });
    await expect(row(page, "Court 3")).toContainText(facility);

    await page.goto("/booking-buddy/settings");
    await page.getByRole("button", { name: "Connect Gmail" }).click();
    await page.waitForURL((url) => url.searchParams.get("gmail_connected") === "1");

    mock.registerMessages([cancellationEmail({ id: messageId(), facility })]);

    await page.goto("/booking-buddy/bookings");
    await page.getByRole("button", { name: "Sync from Email" }).click();

    const card = page.getByRole("listitem").filter({ has: page.getByRole("button", { name: "Remove booking" }) });
    await expect(card).toBeVisible();
    await expect(card).toContainText(facility);
    await expect(card).toContainText("Cancelled. Matches a Booking you logged.");

    await card.getByRole("button", { name: "Remove booking" }).click();
    await expect(page.getByText("No new bookings found.")).toBeVisible({ timeout: 15_000 });
    await expect(card).toHaveCount(0);
    await expect(row(page, "Court 3")).toHaveCount(0);

    await removePlace(page, facility);
  });

  test("a cancellation with no matching Booking shows a distinct notice, and dismissing it means a second sync never shows it again (issue #65)", async ({
    page,
  }) => {
    mock.registerAccount({
      email: "ben.pickleball@gmail.com",
      accessToken: "mock-access-token",
      refreshToken: "mock-refresh-token",
    });

    // Bookings' own "Sync from Email" section is absent entirely for a
    // zero-Org User (bookings/page.tsx), so an Org has to exist even though
    // this test deliberately never logs a Booking under it — that's the
    // "no matching Booking" case under test. Matching keys on Org + date +
    // start time against *Bookings*, not Orgs, so having one here doesn't
    // turn this into a match.
    const facility = placeName();
    await signIn(page, BEN, "/booking-buddy/orgs");
    await addPlace(page, facility);

    await page.goto("/booking-buddy/settings");
    await page.getByRole("button", { name: "Connect Gmail" }).click();
    await page.waitForURL((url) => url.searchParams.get("gmail_connected") === "1");

    mock.registerMessages([cancellationEmail({ id: messageId(), facility })]);

    await page.goto("/booking-buddy/bookings");
    await page.getByRole("button", { name: "Sync from Email" }).click();

    const card = page.getByRole("listitem").filter({ hasText: facility });
    await expect(card).toBeVisible();
    await expect(card).toContainText("No matching booking found. Your records may be out of sync.");
    await expect(card.getByRole("button", { name: "Remove booking" })).toHaveCount(0);

    await card.getByRole("button", { name: "Dismiss" }).click();
    await expect(card).toHaveCount(0);
    await expect(page.getByText("No new bookings found.")).toBeVisible();

    await page.getByRole("button", { name: "Sync from Email" }).click();
    await expect(page.getByText("No new bookings found.")).toBeVisible();
    await expect(page.getByRole("listitem").filter({ hasText: facility })).toHaveCount(0);

    await removePlace(page, facility);
  });

  test("a Reservation Update Notice netted against its own in-batch confirmation shows one candidate carrying the update's own format/court/players (issue #91)", async ({
    page,
  }) => {
    mock.registerAccount({
      email: "ben.pickleball@gmail.com",
      accessToken: "mock-access-token",
      refreshToken: "mock-refresh-token",
    });

    const facility = placeName();
    await signIn(page, BEN, "/booking-buddy/orgs");
    await addPlace(page, facility);

    await page.goto("/booking-buddy/settings");
    await page.getByRole("button", { name: "Connect Gmail" }).click();
    await page.waitForURL((url) => url.searchParams.get("gmail_connected") === "1");

    mock.registerMessages([
      confirmationEmail({ id: messageId(), facility, players: "Amy Ace, Ben Backhand", receivedAt: 1 }),
      updateEmail({
        id: messageId(),
        facility,
        format: "Doubles",
        players: "Amy Ace, Ben Backhand, Cara Crosscourt",
        receivedAt: 2,
      }),
    ]);

    await page.goto("/booking-buddy/bookings");
    await page.getByRole("button", { name: "Sync from Email" }).click();

    // Exactly one candidate — the original confirmation nets away entirely,
    // not a separate "no matching booking found" update notice alongside it.
    await expect(page.getByRole("listitem").filter({ hasText: facility })).toHaveCount(1);

    const card = page.getByRole("listitem").filter({ has: page.getByRole("button", { name: "Confirm" }) });
    await expect(card).toBeVisible();
    await expect(card).toContainText("Amy Ace, Ben Backhand, Cara Crosscourt");
    await expect(page.getByText("No matching booking found", { exact: false })).toHaveCount(0);

    await card.getByRole("button", { name: "Confirm" }).click();
    await expect(page.getByText("No new bookings found.")).toBeVisible({ timeout: 15_000 });

    const booking = row(page, "Court 3");
    await expect(booking).toContainText(facility);
    await expect(booking).toContainText("Doubles");

    await removePlace(page, facility);
  });

  test("a Reservation Update Notice matching a logged Booking appears as a candidate, and applying it updates that Booking's format/court in place (issue #91)", async ({
    page,
  }) => {
    mock.registerAccount({
      email: "ben.pickleball@gmail.com",
      accessToken: "mock-access-token",
      refreshToken: "mock-refresh-token",
    });

    const facility = placeName();
    await signIn(page, BEN, "/booking-buddy/orgs");
    await addPlace(page, facility);
    await logBooking(page, {
      place: facility,
      court: "3",
      date: "2027-03-15",
      start: "18:00",
      end: "19:00",
      format: "Singles",
    });
    await expect(row(page, "Court 3")).toContainText(facility);
    await expect(row(page, "Court 3")).toContainText("Singles");

    await page.goto("/booking-buddy/settings");
    await page.getByRole("button", { name: "Connect Gmail" }).click();
    await page.waitForURL((url) => url.searchParams.get("gmail_connected") === "1");

    // No in-batch confirmation this time — the same shape as a User syncing,
    // confirming right away, and only getting the Update Notice on a later
    // sync once the reservation was edited. A different court too, not just
    // format — proving `matchUpdateToBooking` really doesn't key on court
    // (issue #91's own reason for excluding it from the match): a genuine
    // court change still has to reach the Booking row, not just format.
    mock.registerMessages([
      updateEmail({ id: messageId(), facility, format: "Doubles", court: "Court 5", players: "Amy Ace, Ben Backhand" }),
    ]);

    await page.goto("/booking-buddy/bookings");
    await page.getByRole("button", { name: "Sync from Email" }).click();

    const card = page.getByRole("listitem").filter({ has: page.getByRole("button", { name: "Apply update" }) });
    await expect(card).toBeVisible();
    await expect(card).toContainText(facility);
    await expect(card).toContainText("Updates a booking you logged.");

    await card.getByRole("button", { name: "Apply update" }).click();
    await expect(page.getByText("No new bookings found.")).toBeVisible({ timeout: 15_000 });
    await expect(card).toHaveCount(0);

    // Same Booking, edited in place — not a second row alongside the original.
    await expect(page.getByRole("listitem").filter({ hasText: facility })).toHaveCount(1);
    await expect(row(page, "Court 5")).toContainText("Doubles");
    await expect(row(page, "Court 3")).toHaveCount(0);

    await removePlace(page, facility);
  });

  test("a Reservation Update Notice with no matching Booking shows a distinct notice, and dismissing it means a second sync never shows it again (issue #91)", async ({
    page,
  }) => {
    mock.registerAccount({
      email: "ben.pickleball@gmail.com",
      accessToken: "mock-access-token",
      refreshToken: "mock-refresh-token",
    });

    // Same reasoning as the cancellation "no matching Booking" test above —
    // an Org has to exist for Bookings' own "Sync from Email" section to
    // render at all, even though this test deliberately never logs a
    // Booking under it.
    const facility = placeName();
    await signIn(page, BEN, "/booking-buddy/orgs");
    await addPlace(page, facility);

    await page.goto("/booking-buddy/settings");
    await page.getByRole("button", { name: "Connect Gmail" }).click();
    await page.waitForURL((url) => url.searchParams.get("gmail_connected") === "1");

    mock.registerMessages([updateEmail({ id: messageId(), facility })]);

    await page.goto("/booking-buddy/bookings");
    await page.getByRole("button", { name: "Sync from Email" }).click();

    const card = page.getByRole("listitem").filter({ hasText: facility });
    await expect(card).toBeVisible();
    await expect(card).toContainText("No matching booking found. Your records may be out of sync.");
    await expect(card.getByRole("button", { name: "Apply update" })).toHaveCount(0);

    await card.getByRole("button", { name: "Dismiss" }).click();
    await expect(card).toHaveCount(0);
    await expect(page.getByText("No new bookings found.")).toBeVisible();

    await page.getByRole("button", { name: "Sync from Email" }).click();
    await expect(page.getByText("No new bookings found.")).toBeVisible();
    await expect(page.getByRole("listitem").filter({ hasText: facility })).toHaveCount(0);

    await removePlace(page, facility);
  });

  test("an expired Mailbox Link shows a reconnect prompt instead of a raw error when syncing", async ({
    page,
  }) => {
    mock.registerAccount({
      email: "ben.pickleball@gmail.com",
      accessToken: "mock-access-token",
      refreshToken: "mock-refresh-token",
    });

    // Bookings' own "Sync from Email" section is absent entirely for a
    // zero-Org User (bookings/page.tsx) — an Org has to exist for the
    // "Sync from Email" button this test clicks to render at all.
    const facility = placeName();
    await signIn(page, BEN, "/booking-buddy/orgs");
    await addPlace(page, facility);

    await page.goto("/booking-buddy/settings");
    await page.getByRole("button", { name: "Connect Gmail" }).click();
    await page.waitForURL((url) => url.searchParams.get("gmail_connected") === "1");

    // The Mailbox Link is still connected/active — Google's refresh grant
    // itself is what fails now, exactly ADR-0009's 7-day Testing-mode expiry.
    mock.registerTokenFailure("invalid_grant");

    await page.goto("/booking-buddy/bookings");
    await page.getByRole("button", { name: "Sync from Email" }).click();

    await expect(
      page.getByText("Google needs you to reconnect Gmail before syncing again."),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Reconnect Gmail" })).toBeVisible();

    // The Mailbox Link's own status flips to expired, same as Settings
    // already renders for a link that expired between visits.
    await page.goto("/booking-buddy/settings");
    await expect(page.getByText("Google needs you to reconnect")).toBeVisible();

    await removePlace(page, facility);
  });
});
