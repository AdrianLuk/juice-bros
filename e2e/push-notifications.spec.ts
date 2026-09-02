import { expect, test } from "./support/accounts.ts";
import { signIn } from "./support/sign-in.ts";

/**
 * Web push opt-in on the Settings page (issue #12).
 *
 * Deliberately scoped down, matching this repo's own testing decisions
 * ("UI/hooks: deliberately scoped down... the rest of the UI layer is
 * verified manually") and the precedent already set for #11/#36's own
 * external-service integrations (Resend email): actually subscribing calls
 * through to the browser's real push service (Chrome talks to Google's FCM),
 * which needs outbound network this suite can't assume and shouldn't depend
 * on for a deterministic result. What's covered here is what's true
 * regardless of network reachability: the control renders with the right
 * label and starts unchecked (no subscription exists yet for a fresh
 * browser context), and the unsupported-browser fallback renders when the
 * underlying APIs are missing. The full subscribe → save → persist round
 * trip was verified manually — see PROGRESS.md's Phase 8 notes.
 */

test("the push toggle renders, unchecked, when the browser supports it", async ({ page, accounts }) => {
  await signIn(page, accounts.amy.email, "/booking-buddy/settings");

  const pushToggle = page.getByLabel("Push me a reminder on this device");
  await expect(pushToggle).toBeVisible();
  await expect(pushToggle).not.toBeChecked();
});

test("an unsupported browser sees a fallback message instead of the toggle", async ({ page, accounts }) => {
  // Simulates Safari-without-PWA-install and any other browser missing the
  // Push API — deleting the constructor before any page script runs is the
  // same feature-detection branch the component itself checks.
  await page.addInitScript(() => {
    // @ts-expect-error -- deliberately removing a browser API for the test
    delete window.PushManager;
  });

  await signIn(page, accounts.amy.email, "/booking-buddy/settings");

  await expect(
    page.getByText("Push notifications aren't supported in this browser"),
  ).toBeVisible();
  await expect(page.getByLabel("Push me a reminder on this device")).toHaveCount(0);
});
