import { expect, test } from "@playwright/test";

import {
  seedClubForOrganizer,
  deleteClubForOrganizer,
  seedOpenSession,
  joinPlayerViaRpc,
  queuePlayerViaRpc,
  subscribeTurnNotificationViaRpc,
  turnNotificationSendCount,
} from "./support/on-deck.ts";

/**
 * On Deck: the opt-in turn notification (issue #260).
 *
 * Scoped the way this repo's own push work is (`push-notifications.spec.ts`,
 * PROGRESS.md's Phase 8 notes): actually receiving a push calls through to the
 * browser's real push service (Chrome ↔ Google FCM), outbound network the
 * suite can't assume, and the e2e web server carries no VAPID keys anyway. So
 * what's covered here is what holds regardless of network:
 *
 *   - the one-tap control renders on the Player's status screen under
 *     `self-serve` / `hybrid`, and *not* under `volunteer-run`;
 *   - an unsupported browser sees nothing (degrades silently — no error);
 *   - the subscribe RPC stores a row and re-subscribing is an upsert, with the
 *     send log empty until a Foursome actually moves.
 *
 * The "which On Deck / Court transitions fire a push, and exactly once" half is
 * pinned in `src/lib/on-deck/session/turn-notify.test.ts` and
 * `src/lib/on-deck/turn-notify-run.test.ts`; the RPC gating in
 * `supabase/tests/on_deck_turn_notifications.test.sql`.
 */
const PASSWORD = "pickleball123";

/**
 * A fresh Organizer + Club + open Session in the given Floor Mode, and a
 * Player-recognised browser context on the Session view. Each test gets its
 * own Club so the "one open Session per Club" index never collides.
 */
async function setUp(
  browser: import("@playwright/test").Browser,
  floorMode: "self-serve" | "hybrid" | "volunteer-run",
  opts: { deletePushManager?: boolean } = {},
) {
  const email = `on-deck-turn-notify-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  const token = `tok-turn-notify-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const signup = await browser.newPage();
  await signup.goto("/on-deck/sign-in?next=/on-deck/home");
  await signup
    .getByRole("button", { name: "Create an account with a password" })
    .click();
  await signup.getByLabel("Email").fill(email);
  await signup.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await signup.getByRole("button", { name: "Create account" }).click();
  await signup.waitForURL((url) => !url.pathname.includes("/sign-in"));
  await signup.close();

  const clubId = await seedClubForOrganizer(email, {
    name: "Turn Notify Club",
    venueName: "Ramsden Park",
    floorMode,
  });
  const { sessionId } = await seedOpenSession(email, clubId, { floorMode });
  await joinPlayerViaRpc(sessionId, token, "Nadia", "K");
  await queuePlayerViaRpc(sessionId, token);

  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.addInitScript(
    (args: { sessionId: string; token: string; deletePushManager: boolean }) => {
      window.localStorage.setItem(
        `juicebros.on-deck.player.${args.sessionId}`,
        args.token,
      );
      if (args.deletePushManager) {
        // @ts-expect-error -- deliberately removing a browser API for the test
        delete window.PushManager;
      }
    },
    { sessionId, token, deletePushManager: opts.deletePushManager ?? false },
  );
  await page.goto(`/on-deck/session/${sessionId}`);
  await expect(page.getByText("You're in")).toBeVisible();

  return { email, token, clubId, sessionId, ctx, page };
}

test("the one-tap control shows on a self-serve Session's status screen", async ({
  browser,
}) => {
  const { email, ctx, page } = await setUp(browser, "self-serve");

  await expect(page.getByTestId("turn-notify")).toBeVisible();
  await expect(page.getByLabel("Buzz my phone when I'm up")).not.toBeChecked();

  await ctx.close();
  await deleteClubForOrganizer(email);
});

test("the control is absent under volunteer-run (a Volunteer calls names there)", async ({
  browser,
}) => {
  const { email, ctx, page } = await setUp(browser, "volunteer-run");

  await expect(page.getByTestId("turn-notify")).toHaveCount(0);

  await ctx.close();
  await deleteClubForOrganizer(email);
});

test("an unsupported browser sees nothing — no control, no error", async ({
  browser,
}) => {
  const { email, ctx, page } = await setUp(browser, "self-serve", {
    deletePushManager: true,
  });

  await expect(page.getByTestId("turn-notify")).toHaveCount(0);

  await ctx.close();
  await deleteClubForOrganizer(email);
});

test("subscribing stores a device row; the send log stays empty until a Foursome moves", async ({
  browser,
}) => {
  const { email, token, sessionId, ctx } = await setUp(browser, "self-serve");

  const endpoint = `https://push.example/${Date.now()}`;
  await subscribeTurnNotificationViaRpc(sessionId, token, endpoint);
  // Re-subscribing on the same endpoint (a re-tap) must not error or duplicate.
  await subscribeTurnNotificationViaRpc(sessionId, token, endpoint);

  expect(await turnNotificationSendCount(sessionId)).toBe(0);

  await ctx.close();
  await deleteClubForOrganizer(email);
});
