import { expect, type Locator, type Page } from "@playwright/test";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Months between two `{year, monthIndex}` points — positive when `to` is later. */
function monthDelta(
  from: { year: number; monthIndex: number },
  to: { year: number; monthIndex: number },
): number {
  return (to.year - from.year) * 12 + (to.monthIndex - from.monthIndex);
}

/**
 * Picks `iso` (a `YYYY-MM-DD` string) in the Booking / Game **Date** field.
 *
 * That field is a calendar popover now (issue #364), not a native
 * `<input type="date">`, so `getByLabel("Date").fill(iso)` no longer reaches
 * it. This opens the trigger, walks the month grid to the target month with
 * react-day-picker's own keyboard nav (PageUp/PageDown for months, with Shift
 * for years — far fewer hops than the chevrons for a date years out), then
 * clicks the day. The day match is on RDP's `aria-label` (date-fns `PPPP`,
 * e.g. `"Wednesday, September 16th, 2026"`, sometimes prefixed `"Today, "` or
 * suffixed `", selected"`).
 *
 * `scope` is a `Page` for the inline forms (Post a game) or a dialog `Locator`
 * for the ones in a modal (Log booking, quick-add, Edit booking) — the trigger
 * is looked up inside it; the popover itself is portalled to `<body>`.
 */
export async function pickDate(scope: Page | Locator, iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  const want = { year, monthIndex: month - 1 };

  const page: Page = "goto" in scope ? scope : scope.page();

  await scope.getByRole("button", { name: "Date" }).click();
  const calendar = page.locator('[data-slot="popover-content"]');
  await calendar.waitFor();

  // RDP's roving tabindex: exactly one day button is `tabindex="0"`. Focus it
  // so the Page/Down keys land on the grid.
  await calendar.locator('.rdp-day_button[tabindex="0"]').focus();

  const caption = calendar.locator(".rdp-month_caption");
  for (let guard = 0; guard < 40; guard += 1) {
    const [shownMonth, shownYear] = (
      (await caption.textContent()) ?? ""
    ).trim().split(" ");
    const shown = {
      year: Number(shownYear),
      monthIndex: MONTHS.indexOf(shownMonth),
    };
    const delta = monthDelta(shown, want);
    if (delta === 0) break;

    await page.keyboard.press(
      Math.abs(delta) >= 12
        ? delta > 0
          ? "Shift+PageDown"
          : "Shift+PageUp"
        : delta > 0
          ? "PageDown"
          : "PageUp",
    );
  }

  await calendar
    .getByRole("button", { name: new RegExp(`\\b${day}(st|nd|rd|th), ${year}\\b`) })
    .click();
  await expect(calendar).toBeHidden();
}

/** Asserts the Booking / Game **Date** field (`scope`, a Page or dialog Locator) currently holds `iso`. */
export async function expectDate(scope: Page | Locator, iso: string) {
  await expect(scope.locator('input[name="date"]')).toHaveValue(iso);
}
