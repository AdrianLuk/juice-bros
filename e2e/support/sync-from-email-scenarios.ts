import { type Page } from "@playwright/test";

import { expect, test, type Accounts } from "./accounts.ts";

import { signIn } from "./sign-in.ts";
import { addPlace, deleteBooking, logBooking, placeName, removePlace, row } from "./places.ts";

/**
 * The full "Sync from Email" scenario set (issues #64/#65/#88/#91), factored
 * out of `email-sync.spec.ts` so the Gmail and Outlook provider suites run
 * the *same* journeys against their own mock (spec #280 — "behaves
 * identically to the Gmail path"). Each suite supplies a `SyncProviderFixture`
 * naming its connect/reconnect copy and its test User; everything else — the
 * CourtReserve fixture emails, the review-screen assertions, the confirm /
 * dismiss / apply flows — is shared here.
 *
 * The provider mock's lifecycle (start/stop/reset) stays with the calling
 * spec file, since the mock instance is provider-specific; this module only
 * reads it back through `getMock()`.
 */

/** One fixture inbox message — the shape both `GmailMock` and `MicrosoftMock` seed from. */
export type SyncMailMessage = {
  id: string;
  subject: string;
  html: string;
  receivedAt?: number;
};

export type SyncMock = {
  reset(): void;
  registerAccount(account: { email: string; accessToken: string; refreshToken: string }): void;
  registerMessages(messages: SyncMailMessage[]): void;
  registerTokenFailure(reason: "unreachable" | "invalid_grant"): void;
};

export type SyncProviderFixture = {
  /** "Gmail" / "Outlook" — names the describe block and disambiguates output. */
  label: string;
  /**
   * The seeded local account this suite signs in as, resolved per worker
   * (Gmail → every worker's allowlisted Ben; Outlook → any).
   */
  resolveUser: (accounts: Accounts) => string;
  account: { email: string; accessToken: string; refreshToken: string };
  /** "Connect Gmail" / "Connect Outlook". */
  connectButtonName: string;
  /** "Reconnect Gmail" / "Reconnect Outlook". */
  reconnectButtonName: string;
  /** The Bookings-page reconnect prompt, verbatim. */
  reconnectPromptText: string;
  /** The Settings-page expired-link line (a substring is enough). */
  settingsExpiredText: string;
  getMock: () => SyncMock;
};

/**
 * CourtReserve's real template shape (see courtreserve-email.ts's own header
 * comment) — an `<img alt>` logo for the facility name, and an `<h4>` heading
 * immediately followed by an `<h5>` value per field group. A fixed future
 * date well past the suite's own "today" so the past-date filter never has to
 * be timing-sensitive.
 */
export function confirmationEmail(fields: {
  id: string;
  facility: string;
  court?: string;
  players?: string;
  receivedAt?: number;
}): SyncMailMessage {
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
 * CourtReserve's real cancellation template (issue #65) — a "Cancellation
 * Details" heading bundling the player's own name in front of the same
 * format/date/time lines, and no Court(s) section at all.
 */
export function cancellationEmail(fields: {
  id: string;
  facility: string;
  receivedAt?: number;
}): SyncMailMessage {
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
 * "Reservation Details" heading whose value bundles the court label in as a
 * fourth `<br>`-joined line, with no separate Court(s) section.
 */
export function updateEmail(fields: {
  id: string;
  facility: string;
  format?: string;
  court?: string;
  players?: string;
  receivedAt?: number;
}): SyncMailMessage {
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

export function messageId() {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Declares the shared "Sync from Email" describe block for one provider. Call
 * once per provider spec, after that spec has wired up its own mock's
 * start/stop/reset hooks.
 */
export function defineSyncFromEmailScenarios(fixture: SyncProviderFixture) {
  const { connectButtonName } = fixture;

  test.describe(`Sync from Email (${fixture.label})`, () => {
    /** Connects the provider's mailbox on Settings, then seeds the fixture inbox. */
    async function connectAndSeed(page: Page, messages: SyncMailMessage[]) {
      fixture.getMock().registerAccount(fixture.account);
      await page.goto("/booking-buddy/settings");
      await page.getByRole("button", { name: connectButtonName }).click();
      await page.waitForURL((url) => url.searchParams.get("mailbox_connected") === "1");
      fixture.getMock().registerMessages(messages);
    }

    test.afterEach(async ({ page }) => {
      // Disconnect the mailbox so the next test's connect step starts clean —
      // same discipline `email-sync.spec.ts` uses. Wait for a real-page
      // marker first (issue #279).
      await page.goto("/booking-buddy/settings");
      await expect(page.getByRole("heading", { name: "Sync from Email" })).toBeVisible();
      const disconnect = page.getByRole("button", { name: "Disconnect" });
      if (await disconnect.isVisible()) {
        await disconnect.click();
        await expect(page.getByRole("button", { name: connectButtonName })).toBeVisible();
      }

      // Sweep any facilities the scenario left behind.
      await page.goto("/booking-buddy/orgs");
      await expect(page.getByRole("heading", { name: "Your facilities" })).toBeVisible();
      const strays = row(page, "Playwright");
      for (let left = await strays.count(); left > 0; left--) {
        await strays.first().getByRole("button", { name: "Remove" }).click();
        await page.getByRole("button", { name: "Remove facility" }).click();
        await expect(strays).toHaveCount(left - 1);
      }
    });

    test("syncing shows a candidate for a matched facility, and confirming it creates a real Booking", async ({
      page,
      accounts,
    }) => {
      const facility = placeName();
      await signIn(page, fixture.resolveUser(accounts), "/booking-buddy/orgs");
      await addPlace(page, facility);

      await connectAndSeed(page, [confirmationEmail({ id: messageId(), facility })]);

      await page.goto("/booking-buddy/bookings");
      await page.getByRole("button", { name: "Sync from Email" }).click();

      const card = page
        .getByRole("listitem")
        .filter({ has: page.getByRole("button", { name: "Confirm" }) });
      await expect(card).toBeVisible();
      await expect(card).toContainText(facility);
      await expect(card.getByLabel("Facility", { exact: true })).not.toHaveValue("");

      await card.getByRole("button", { name: "Confirm" }).click();
      await expect(page.getByText("No new bookings found.")).toBeVisible({ timeout: 15_000 });
      await expect(card).toHaveCount(0);

      await expect(row(page, "Court 3")).toContainText(facility);

      await removePlace(page, facility);
    });

    test("dismissing a candidate means a second sync never shows it again", async ({ page, accounts }) => {
      const facility = placeName();
      await signIn(page, fixture.resolveUser(accounts), "/booking-buddy/orgs");
      await addPlace(page, facility);

      await connectAndSeed(page, [confirmationEmail({ id: messageId(), facility })]);

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

    test("deleting a confirmed Booking lets its email be re-imported on the next sync (#286)", async ({
      page,
      accounts,
    }) => {
      const facility = placeName();
      await signIn(page, fixture.resolveUser(accounts), "/booking-buddy/orgs");
      await addPlace(page, facility);

      await connectAndSeed(page, [confirmationEmail({ id: messageId(), facility })]);

      const importCard = page
        .getByRole("listitem")
        .filter({ has: page.getByRole("button", { name: "Confirm" }) });

      // Import the confirmation into a real Booking.
      await page.goto("/booking-buddy/bookings");
      await page.getByRole("button", { name: "Sync from Email" }).click();
      await expect(importCard).toBeVisible();
      await importCard.getByRole("button", { name: "Confirm" }).click();
      await expect(page.getByText("No new bookings found.")).toBeVisible({ timeout: 15_000 });
      await expect(row(page, "Court 3")).toContainText(facility);

      // Deleting that Booking from the UI cascades its ledger row away, so the
      // next sync re-offers the email — the realistic path here is recovery
      // (an accidental delete), and a deliberate delete just Dismisses it once.
      await deleteBooking(page, "Court 3");
      await page.getByRole("button", { name: "Sync from Email" }).click();
      await expect(importCard).toBeVisible();
      await expect(importCard).toContainText(facility);

      await removePlace(page, facility);
    });

    test("a confirm/cancel/confirm/cancel/confirm chain for the same slot nets to a single candidate", async ({
      page,
      accounts,
    }) => {
      const facility = placeName();
      await signIn(page, fixture.resolveUser(accounts), "/booking-buddy/orgs");
      await addPlace(page, facility);

      await connectAndSeed(page, [
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

      await expect(page.getByRole("listitem").filter({ hasText: facility })).toHaveCount(1);

      const card = page
        .getByRole("listitem")
        .filter({ has: page.getByRole("button", { name: "Confirm" }) });
      await expect(card).toBeVisible();
      await expect(card).toContainText("Alice Tsang, Sam Wong, Adrian Luk, Janice Kwan, Calvin Yu");
      await expect(page.getByText("No matching booking found", { exact: false })).toHaveCount(0);

      await card.getByRole("button", { name: "Confirm" }).click();
      await expect(page.getByText("No new bookings found.")).toBeVisible({ timeout: 15_000 });
      await expect(row(page, "Court 3")).toContainText(facility);

      await removePlace(page, facility);
    });

    test("a cancellation matching a logged Booking confirms into removing that Booking", async ({
      page,
      accounts,
    }) => {
      const facility = placeName();
      await signIn(page, fixture.resolveUser(accounts), "/booking-buddy/orgs");
      await addPlace(page, facility);
      await logBooking(page, {
        place: facility,
        court: "3",
        date: "2027-03-15",
        start: "18:00",
        end: "19:00",
      });
      await expect(row(page, "Court 3")).toContainText(facility);

      await connectAndSeed(page, [cancellationEmail({ id: messageId(), facility })]);

      await page.goto("/booking-buddy/bookings");
      await page.getByRole("button", { name: "Sync from Email" }).click();

      const card = page
        .getByRole("listitem")
        .filter({ has: page.getByRole("button", { name: "Remove booking" }) });
      await expect(card).toBeVisible();
      await expect(card).toContainText("Cancelled. Matches a Booking you logged.");

      await card.getByRole("button", { name: "Remove booking" }).click();
      await expect(page.getByText("No new bookings found.")).toBeVisible({ timeout: 15_000 });
      await expect(row(page, "Court 3")).toHaveCount(0);

      await removePlace(page, facility);
    });

    test("an unmatched cancellation shows a distinct notice, dismissable once", async ({ page, accounts }) => {
      const facility = placeName();
      await signIn(page, fixture.resolveUser(accounts), "/booking-buddy/orgs");
      await addPlace(page, facility);

      await connectAndSeed(page, [cancellationEmail({ id: messageId(), facility })]);

      await page.goto("/booking-buddy/bookings");
      await page.getByRole("button", { name: "Sync from Email" }).click();

      const card = page.getByRole("listitem").filter({ hasText: facility });
      await expect(card).toBeVisible();
      await expect(card).toContainText("No matching booking found. Your records may be out of sync.");
      await expect(card.getByRole("button", { name: "Remove booking" })).toHaveCount(0);

      await card.getByRole("button", { name: "Dismiss" }).click();
      await expect(card).toHaveCount(0);

      await page.getByRole("button", { name: "Sync from Email" }).click();
      await expect(page.getByText("No new bookings found.")).toBeVisible();
      await expect(page.getByRole("listitem").filter({ hasText: facility })).toHaveCount(0);

      await removePlace(page, facility);
    });

    test("a Reservation Update Notice netted against its in-batch confirmation shows one candidate", async ({
      page,
      accounts,
    }) => {
      const facility = placeName();
      await signIn(page, fixture.resolveUser(accounts), "/booking-buddy/orgs");
      await addPlace(page, facility);

      await connectAndSeed(page, [
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

      await expect(page.getByRole("listitem").filter({ hasText: facility })).toHaveCount(1);

      const card = page
        .getByRole("listitem")
        .filter({ has: page.getByRole("button", { name: "Confirm" }) });
      await expect(card).toBeVisible();
      await expect(card).toContainText("Amy Ace, Ben Backhand, Cara Crosscourt");

      await card.getByRole("button", { name: "Confirm" }).click();
      await expect(page.getByText("No new bookings found.")).toBeVisible({ timeout: 15_000 });
      await expect(row(page, "Court 3")).toContainText("Doubles");

      await removePlace(page, facility);
    });

    test("a Reservation Update Notice matching a logged Booking applies in place", async ({ page, accounts }) => {
      const facility = placeName();
      await signIn(page, fixture.resolveUser(accounts), "/booking-buddy/orgs");
      await addPlace(page, facility);
      await logBooking(page, {
        place: facility,
        court: "3",
        date: "2027-03-15",
        start: "18:00",
        end: "19:00",
        format: "Singles",
      });
      await expect(row(page, "Court 3")).toContainText("Singles");

      await connectAndSeed(page, [
        updateEmail({
          id: messageId(),
          facility,
          format: "Doubles",
          court: "Court 5",
          players: "Amy Ace, Ben Backhand",
        }),
      ]);

      await page.goto("/booking-buddy/bookings");
      await page.getByRole("button", { name: "Sync from Email" }).click();

      const card = page
        .getByRole("listitem")
        .filter({ has: page.getByRole("button", { name: "Apply update" }) });
      await expect(card).toBeVisible();
      await expect(card).toContainText("Updates a booking you logged.");

      await card.getByRole("button", { name: "Apply update" }).click();
      await expect(page.getByText("No new bookings found.")).toBeVisible({ timeout: 15_000 });

      await expect(page.getByRole("listitem").filter({ hasText: facility })).toHaveCount(1);
      await expect(row(page, "Court 5")).toContainText("Doubles");
      await expect(row(page, "Court 3")).toHaveCount(0);

      await removePlace(page, facility);
    });

    test("a stale Mailbox Link shows a reconnect prompt naming the provider, and flips to expired", async ({
      page,
      accounts,
    }) => {
      const facility = placeName();
      await signIn(page, fixture.resolveUser(accounts), "/booking-buddy/orgs");
      await addPlace(page, facility);

      await connectAndSeed(page, []);
      // The link is still active — the provider's own refresh grant is what fails now.
      fixture.getMock().registerTokenFailure("invalid_grant");

      await page.goto("/booking-buddy/bookings");
      await page.getByRole("button", { name: "Sync from Email" }).click();

      await expect(page.getByText(fixture.reconnectPromptText)).toBeVisible();
      await expect(page.getByRole("button", { name: fixture.reconnectButtonName })).toBeVisible();

      await page.goto("/booking-buddy/settings");
      await expect(page.getByText(fixture.settingsExpiredText)).toBeVisible();

      await removePlace(page, facility);
    });
  });
}
