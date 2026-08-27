import { expect, test, type Locator, type Page } from "@playwright/test";

import { GUEST_RSVP_SOFT_THRESHOLD } from "../src/lib/booking-buddy/slot-links.ts";
import { AMY, signIn } from "./support/sign-in.ts";
import { deleteSlots } from "./support/slot-cleanup.ts";
import { guestRsvpLogForSlotLink, slotLinkIdForToken } from "./support/guest-rsvp-log.ts";
import { selectDuration } from "./support/places.ts";

/**
 * Issue #13's 10.2: confirm the Guest-abuse soft-threshold logging (7.6) is
 * actually wired into the real `guestRespondViaLink` path, not only proven by
 * `slot-links.test.ts` (which only covers the pure parsing/message helpers)
 * and `slot_links.test.sql` (which only covers the RLS boundary — it can't
 * exercise `service_role` business logic at all, since `service_role`
 * bypasses RLS by Supabase's own platform guarantee). Nothing before this
 * spec drove a real repeated RSVP through the real dev server and checked
 * `guest_rsvp_log.flagged` on the far side.
 *
 * A fixed `x-forwarded-for` on the Guest browser context stands in for a real
 * repeat visitor — `clientIp` (guest-rsvp.ts) reads that header exactly the
 * way a reverse proxy in front of the deployed app would set it.
 */

const TEST_GUEST_IP = "198.51.100.42"; // TEST-NET-2 (RFC 5737) — reserved for documentation/examples, never a real client.

function row(page: Page, text: string): Locator {
  return page.getByRole("listitem").filter({ hasText: text });
}

async function createSlot(
  page: Page,
  slot: { date: string; start: string; end: string; label: string },
): Promise<string> {
  await page.goto("/booking-buddy/slots");
  await page.getByLabel("Date").fill(slot.date);
  await page.getByLabel("Start").selectOption(slot.start);
  await selectDuration(page, slot.start, slot.end);
  await page.getByRole("button", { name: "Post game" }).click();

  await row(page, slot.label).getByRole("link").click();
  await page.waitForURL(/\/booking-buddy\/slots\/[0-9a-f-]+$/);
  return page.url().split("/").pop()!;
}

test.beforeEach(async ({ page }) => {
  await signIn(page, AMY, "/booking-buddy/slots");
});

test("repeated guest RSVPs from the same IP past the soft threshold are flagged in guest_rsvp_log, not blocked", async ({
  page,
  browser,
}) => {
  const slotId = await createSlot(page, {
    date: "2031-04-06",
    start: "20:00",
    end: "21:00",
    label: "Apr 6, 2031",
  });

  try {
    await page.getByRole("button", { name: "Create invite link" }).click();
    const linkInput = page.getByLabel("Invite link");
    await expect(linkInput).toBeVisible();
    const url = await linkInput.inputValue();
    const token = url.split("/").pop()!;

    const guestContext = await browser.newContext({
      extraHTTPHeaders: { "x-forwarded-for": TEST_GUEST_IP },
    });

    try {
      // One request past the threshold gets flagged; the ones at or below it
      // don't (GUEST_RSVP_SOFT_THRESHOLD counts *prior* attempts from this IP
      // against this link).
      const attempts = GUEST_RSVP_SOFT_THRESHOLD + 1;
      for (let i = 1; i <= attempts; i++) {
        const guestPage = await guestContext.newPage();
        await guestPage.goto(url);
        await guestPage.getByLabel("Your name").fill(`Repeat Guest ${i}`);
        await guestPage.getByRole("button", { name: "Yes" }).click();
        await expect(guestPage.getByText("Thanks. Your RSVP is in.")).toBeVisible();
        await guestPage.close();
      }

      // Every attempt succeeded — the soft threshold logs and flags, it never
      // blocks the RSVP itself (CLAUDE.md's Guest RSVP abuse-handling call).
      await page.reload();
      for (let i = 1; i <= attempts; i++) {
        await expect(
          page.locator("li").filter({ hasText: `Repeat Guest ${i}` }).filter({ hasText: "Yes" }),
        ).toBeVisible();
      }

      const slotLinkId = await slotLinkIdForToken(token);
      const logRows = await guestRsvpLogForSlotLink(slotLinkId);

      expect(logRows).toHaveLength(attempts);
      expect(logRows.every((entry) => entry.ip === TEST_GUEST_IP)).toBe(true);

      const flags = logRows.map((entry) => entry.flagged);
      // First GUEST_RSVP_SOFT_THRESHOLD attempts are under the threshold.
      expect(flags.slice(0, GUEST_RSVP_SOFT_THRESHOLD)).toEqual(
        new Array(GUEST_RSVP_SOFT_THRESHOLD).fill(false),
      );
      // Everything past it is flagged — logged, not blocked.
      expect(flags.slice(GUEST_RSVP_SOFT_THRESHOLD)).toEqual(
        new Array(attempts - GUEST_RSVP_SOFT_THRESHOLD).fill(true),
      );
    } finally {
      await guestContext.close();
    }
  } finally {
    await deleteSlots([slotId]);
  }
});
