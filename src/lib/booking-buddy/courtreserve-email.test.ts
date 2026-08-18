import assert from "node:assert/strict";
import test from "node:test";

import {
  COURTRESERVE_SEARCH_WINDOW_DAYS,
  COURTRESERVE_SENDER,
  buildCourtReserveSearchQuery,
  parseCourtReserveEmail,
} from "./courtreserve-email.ts";

function confirmationHtml(overrides: Partial<Record<string, string>> = {}): string {
  const fields: Record<string, string> = {
    Facility: "PicklePlex Downsview",
    Date: "September 15, 2026",
    Time: "6:00 PM - 7:00 PM",
    Court: "Court 3",
    Type: "Doubles",
    Players: "Amy Ace, Ben Backhand",
    ...overrides,
  };

  const rows = Object.entries(fields)
    .filter(([, value]) => value !== undefined)
    .map(([label, value]) => `<tr><td>${label}:</td><td>${value}</td></tr>`)
    .join("\n");

  return `<html><body><h1>Reservation Confirmed</h1><table>${rows}</table></body></html>`;
}

function cancellationHtml(overrides: Partial<Record<string, string>> = {}): string {
  const fields: Record<string, string> = {
    Facility: "PicklePlex Downsview",
    Date: "September 15, 2026",
    Time: "6:00 PM - 7:00 PM",
    Court: "Court 3",
    ...overrides,
  };

  const rows = Object.entries(fields)
    .filter(([, value]) => value !== undefined)
    .map(([label, value]) => `<tr><td>${label}:</td><td>${value}</td></tr>`)
    .join("\n");

  return `<html><body><h1>Reservation Cancelled</h1><table>${rows}</table></body></html>`;
}

test("a confirmation email parses into facility, date/time, court, format and players", () => {
  const result = parseCourtReserveEmail({
    subject: "Your Reservation is Confirmed",
    html: confirmationHtml(),
  });

  assert.deepEqual(result, {
    kind: "confirmation",
    confirmation: {
      facilityName: "PicklePlex Downsview",
      date: "2026-09-15",
      startTime: "18:00",
      endTime: "19:00",
      courtLabel: "Court 3",
      format: "doubles",
      playerNames: ["Amy Ace", "Ben Backhand"],
    },
  });
});

test("a singles confirmation is recognized as singles, not defaulted to doubles", () => {
  const result = parseCourtReserveEmail({
    subject: "Reservation Confirmation",
    html: confirmationHtml({ Type: "Singles" }),
  });

  assert.equal(result.kind, "confirmation");
  assert.equal(result.kind === "confirmation" && result.confirmation.format, "singles");
});

test("an unrecognised or missing format falls back to doubles, the app's own default — never refused", () => {
  const result = parseCourtReserveEmail({
    subject: "Your Reservation is Confirmed",
    html: confirmationHtml({ Type: "Mixed Doubles" }),
  });

  assert.equal(result.kind === "confirmation" && result.confirmation.format, "doubles");
});

test("a facility that doesn't label its courts produces a null courtLabel, not an empty string", () => {
  const html = confirmationHtml().replace(
    "<tr><td>Court:</td><td>Court 3</td></tr>",
    "",
  );
  const result = parseCourtReserveEmail({ subject: "Your Reservation is Confirmed", html });

  assert.equal(result.kind === "confirmation" && result.confirmation.courtLabel, null);
});

test("no players listed produces an empty array, not a failure", () => {
  const html = confirmationHtml().replace(
    "<tr><td>Players:</td><td>Amy Ace, Ben Backhand</td></tr>",
    "",
  );
  const result = parseCourtReserveEmail({ subject: "Your Reservation is Confirmed", html });

  assert.deepEqual(result.kind === "confirmation" ? result.confirmation.playerNames : null, []);
});

test("a single-ended time (no range) still parses, with a null endTime", () => {
  const result = parseCourtReserveEmail({
    subject: "Your Reservation is Confirmed",
    html: confirmationHtml({ Time: "6:00 PM" }),
  });

  assert.equal(result.kind === "confirmation" && result.confirmation.startTime, "18:00");
  assert.equal(result.kind === "confirmation" && result.confirmation.endTime, null);
});

test("a dash with an unparseable end time is unparseable, not silently downgraded to no end time", () => {
  // A real end time was intended (there's a dash) — losing it silently would
  // be worse than refusing the whole email.
  const noMeridiem = parseCourtReserveEmail({
    subject: "Your Reservation is Confirmed",
    html: confirmationHtml({ Time: "6:00 PM - 7:00" }),
  });
  assert.deepEqual(noMeridiem, { kind: "unparseable" });

  const placeholder = parseCourtReserveEmail({
    subject: "Your Reservation is Confirmed",
    html: confirmationHtml({ Time: "6:00 PM - TBD" }),
  });
  assert.deepEqual(placeholder, { kind: "unparseable" });
});

test("an accented facility name decodes correctly, so exact-match Org lookup still has a chance", () => {
  const result = parseCourtReserveEmail({
    subject: "Your Reservation is Confirmed",
    html: confirmationHtml({ Facility: "Caf&eacute; Pickleball Club" }),
  });

  assert.equal(
    result.kind === "confirmation" ? result.confirmation.facilityName : null,
    "Café Pickleball Club",
  );
});

test("a cancellation email parses into the same facility/date/time/court shape", () => {
  const result = parseCourtReserveEmail({
    subject: "Your Reservation has been Cancelled",
    html: cancellationHtml(),
  });

  assert.deepEqual(result, {
    kind: "cancellation",
    cancellation: {
      facilityName: "PicklePlex Downsview",
      date: "2026-09-15",
      startTime: "18:00",
      courtLabel: "Court 3",
    },
  });
});

test("a waitlist notice is recognized as not-a-booking, not mis-parsed as a confirmation", () => {
  const result = parseCourtReserveEmail({
    subject: "You've been added to the waitlist at PicklePlex Downsview",
    html: "<html><body><p>You're on the waitlist for Court 3 on September 15.</p></body></html>",
  });

  assert.deepEqual(result, { kind: "not_a_booking" });
});

test("a membership renewal notice is recognized as not-a-booking", () => {
  const result = parseCourtReserveEmail({
    subject: "Your CourtReserve Membership Renewal",
    html: "<html><body><p>Your annual membership renews on October 1.</p></body></html>",
  });

  assert.deepEqual(result, { kind: "not_a_booking" });
});

test("a confirmation-subject email with no recognisable table fails as unparseable, never throws", () => {
  const result = parseCourtReserveEmail({
    subject: "Your Reservation is Confirmed",
    html: "<html><body><p>Something went wrong rendering this email.</p></body></html>",
  });

  assert.deepEqual(result, { kind: "unparseable" });
});

test("a confirmation-subject email missing just the date field is unparseable", () => {
  const html = confirmationHtml().replace(
    "<tr><td>Date:</td><td>September 15, 2026</td></tr>",
    "",
  );
  const result = parseCourtReserveEmail({ subject: "Your Reservation is Confirmed", html });

  assert.deepEqual(result, { kind: "unparseable" });
});

test("completely empty HTML never throws, whatever the subject claims", () => {
  assert.doesNotThrow(() => {
    parseCourtReserveEmail({ subject: "Your Reservation is Confirmed", html: "" });
  });
  assert.doesNotThrow(() => {
    parseCourtReserveEmail({ subject: "", html: "" });
  });
});

test("garbage/malformed HTML never throws", () => {
  assert.doesNotThrow(() => {
    parseCourtReserveEmail({
      subject: "Your Reservation is Confirmed",
      html: "<table><tr><td>Facility<td>Broken<tr><Date>>>><<<",
    });
  });
});

test("HTML entities in a field value are decoded", () => {
  const result = parseCourtReserveEmail({
    subject: "Your Reservation is Confirmed",
    html: confirmationHtml({ Facility: "Smith &amp; Sons Tennis &amp; Pickleball Club" }),
  });

  assert.equal(
    result.kind === "confirmation" ? result.confirmation.facilityName : null,
    "Smith & Sons Tennis & Pickleball Club",
  );
});

test("numeric and typographic HTML entities decode too, not just the XML-ish basics", () => {
  const result = parseCourtReserveEmail({
    subject: "Your Reservation is Confirmed",
    html: confirmationHtml({ Facility: "O&#39;Malley&rsquo;s Courts &mdash; Downtown" }),
  });

  assert.equal(
    result.kind === "confirmation" ? result.confirmation.facilityName : null,
    "O'Malley’s Courts — Downtown",
  );
});

test("a field label wrapped in inline formatting (<strong>, a span) still parses", () => {
  const html =
    '<html><body><h1>Reservation Confirmed</h1><table>' +
    '<tr><td><strong>Facility:</strong></td><td>PicklePlex Downsview</td></tr>' +
    '<tr><td>Date:</td><td>September 15, 2026</td></tr>' +
    '<tr><td>Time:</td><td>6:00 PM - 7:00 PM</td></tr>' +
    "</table></body></html>";

  const result = parseCourtReserveEmail({ subject: "Your Reservation is Confirmed", html });

  assert.equal(
    result.kind === "confirmation" ? result.confirmation.facilityName : null,
    "PicklePlex Downsview",
  );
});

test("a confirmation subject that merely mentions a cancellation policy is not misread as a cancellation", () => {
  const result = parseCourtReserveEmail({
    subject: "Your Reservation is Confirmed - Please Review Our Cancellation Policy",
    html: confirmationHtml(),
  });

  assert.equal(result.kind, "confirmation");
});

test("a cancellation subject phrased as a noun (\"Reservation Cancellation\") is still recognized", () => {
  const result = parseCourtReserveEmail({
    subject: "Your Reservation Cancellation Confirmation",
    html: cancellationHtml(),
  });

  assert.equal(result.kind, "cancellation");
});

test("a confirmation subject that just mentions a policy to cancel isn't misread as a cancellation", () => {
  // Bare "cancel" (no "-ed"/"-ation") shows up in ordinary confirmation
  // hedge text ("you may cancel free of charge...") without the email being
  // a cancellation at all.
  const result = parseCourtReserveEmail({
    subject: "Your Reservation is Confirmed — You may cancel free of charge until 24 hours before",
    html: confirmationHtml(),
  });

  assert.equal(result.kind, "confirmation");
});

test("a row with a leading icon/spacer cell still resolves to its label and value, the row's last two cells", () => {
  const html =
    '<html><body><h1>Reservation Confirmed</h1><table>' +
    "<tr><td>🏓</td><td>Facility:</td><td>PicklePlex Downsview</td></tr>" +
    "<tr><td>Date:</td><td>September 15, 2026</td></tr>" +
    "<tr><td>Time:</td><td>6:00 PM - 7:00 PM</td></tr>" +
    "</table></body></html>";

  const result = parseCourtReserveEmail({ subject: "Your Reservation is Confirmed", html });

  assert.equal(
    result.kind === "confirmation" ? result.confirmation.facilityName : null,
    "PicklePlex Downsview",
  );
});

test("a lone, unpaired <td> earlier in the email doesn't corrupt a real field's label/value", () => {
  // A header banner or colspan notice row — common in real HTML email
  // templates — must not make the label/value capture backtrack across it.
  const html =
    '<html><body><h1>Reservation Confirmed</h1><table>' +
    "<tr><td>Thanks for booking with us!</td></tr>" +
    "<tr><td>Facility:</td><td>PicklePlex Downsview</td></tr>" +
    "<tr><td>Date:</td><td>September 15, 2026</td></tr>" +
    "<tr><td>Time:</td><td>6:00 PM - 7:00 PM</td></tr>" +
    "</table></body></html>";

  const result = parseCourtReserveEmail({ subject: "Your Reservation is Confirmed", html });

  assert.equal(
    result.kind === "confirmation" ? result.confirmation.facilityName : null,
    "PicklePlex Downsview",
  );
});

test("<br>-separated player names are read as separate players, not concatenated", () => {
  const result = parseCourtReserveEmail({
    subject: "Your Reservation is Confirmed",
    html: confirmationHtml({ Players: "Amy Ace<br>Ben Backhand" }),
  });

  assert.deepEqual(
    result.kind === "confirmation" ? result.confirmation.playerNames : null,
    ["Amy Ace", "Ben Backhand"],
  );
});

test('a time range written with "to" instead of a dash still parses', () => {
  const result = parseCourtReserveEmail({
    subject: "Your Reservation is Confirmed",
    html: confirmationHtml({ Time: "6:00 PM to 7:00 PM" }),
  });

  assert.equal(result.kind === "confirmation" && result.confirmation.startTime, "18:00");
  assert.equal(result.kind === "confirmation" && result.confirmation.endTime, "19:00");
});

test("an uppercase-accented entity (&Eacute;) decodes to its own uppercase character, not the lowercase one", () => {
  const result = parseCourtReserveEmail({
    subject: "Your Reservation is Confirmed",
    html: confirmationHtml({ Facility: "&Eacute;cole Pickleball Club" }),
  });

  assert.equal(
    result.kind === "confirmation" ? result.confirmation.facilityName : null,
    "École Pickleball Club",
  );
});

test("a label cell with a space before the colon still matches, not just an exact 'Label:'", () => {
  const html =
    '<html><body><h1>Reservation Confirmed</h1><table>' +
    "<tr><td><strong>Facility</strong> :</td><td>PicklePlex Downsview</td></tr>" +
    "<tr><td>Date:</td><td>September 15, 2026</td></tr>" +
    "<tr><td>Time:</td><td>6:00 PM - 7:00 PM</td></tr>" +
    "</table></body></html>";

  const result = parseCourtReserveEmail({ subject: "Your Reservation is Confirmed", html });

  assert.equal(
    result.kind === "confirmation" ? result.confirmation.facilityName : null,
    "PicklePlex Downsview",
  );
});

test("an out-of-range minute (e.g. :75) is refused, not accepted as a valid clock time", () => {
  const result = parseCourtReserveEmail({
    subject: "Your Reservation is Confirmed",
    html: confirmationHtml({ Time: "6:75 PM - 7:00 PM" }),
  });

  assert.deepEqual(result, { kind: "unparseable" });
});

test("the search query is scoped to CourtReserve's own sender", () => {
  const query = buildCourtReserveSearchQuery(new Date("2026-08-17T12:00:00Z"));
  assert.match(query, new RegExp(`from:${COURTRESERVE_SENDER.replace(".", "\\.")}`));
});

test("the search query's recency window is exactly the documented number of days", () => {
  const now = new Date("2026-08-17T12:00:00Z");
  const query = buildCourtReserveSearchQuery(now);

  const expected = new Date(now);
  expected.setDate(expected.getDate() - COURTRESERVE_SEARCH_WINDOW_DAYS);
  const year = expected.getFullYear();
  const month = String(expected.getMonth() + 1).padStart(2, "0");
  const day = String(expected.getDate()).padStart(2, "0");

  assert.match(query, new RegExp(`after:${year}/${month}/${day}$`));
});
