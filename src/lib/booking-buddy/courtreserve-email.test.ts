import assert from "node:assert/strict";
import test from "node:test";

import {
  COURTRESERVE_SEARCH_WINDOW_DAYS,
  COURTRESERVE_SENDER,
  buildCourtReserveSearchQuery,
  parseCourtReserveEmail,
} from "./courtreserve-email.ts";

/**
 * Mirrors CourtReserve's real template shape (confirmed against two real
 * captured emails, replacing the first version's best-guess `<td>`-row
 * reconstruction): a logo `<img alt>` for the facility name, and an
 * `<h4>` heading immediately followed by an `<h5>` value per field group.
 */
function section(heading: string, valueHtml: string): string {
  return `<h4>${heading}</h4><table><tr><td>&nbsp;</td></tr></table><h5>${valueHtml}</h5>`;
}

function confirmationHtml(
  fields: {
    facility?: string;
    format?: string;
    date?: string;
    time?: string;
    /** `null` omits the Court(s) section entirely, matching a facility that doesn't label its courts. */
    court?: string | null;
    /** `null` omits the Player(s) section entirely. */
    players?: string | null;
  } = {},
): string {
  const {
    facility = "PicklePlex Downsview",
    format = "Doubles",
    date = "Tuesday, 9-15-2026",
    time = "6:00 PM - 7:00 PM",
    court = "Court 3",
    players = "Amy Ace, Ben Backhand",
  } = fields;

  const detailsSection = section("Details", `${format}<br>${date}<br>${time}`);
  const playersSection = players !== null ? section("Player(s)", players) : "";
  const courtSection = court !== null ? section("Court(s)", court) : "";

  return `<html><body><img border="0" src="https://example.com/logo.jpg" alt="${facility}"><h1>Confirmation</h1>${detailsSection}${playersSection}${courtSection}</body></html>`;
}

function updateHtml(
  fields: {
    facility?: string;
    format?: string;
    date?: string;
    time?: string;
    /** `null` omits the trailing court line entirely, matching a facility that doesn't label its courts. */
    court?: string | null;
    /** `null` omits the Player(s) section entirely. */
    players?: string | null;
  } = {},
): string {
  const {
    facility = "PicklePlex Downsview",
    format = "Doubles",
    date = "Tuesday, 9-15-2026",
    time = "6:00 PM - 7:00 PM",
    court = "Court 3",
    players = "Amy Ace, Ben Backhand",
  } = fields;

  // Unlike confirmationHtml's Details block, an update's Reservation Details
  // value bundles the court label in as a trailing line, with no separate
  // Court(s) section — see courtreserve-email.ts's own header comment for why.
  const detailsValue = court !== null ? `${format}<br>${date}<br>${time}<br>${court}` : `${format}<br>${date}<br>${time}`;
  const detailsSection = section("Reservation Details", detailsValue);
  const playersSection = players !== null ? section("Player(s)", players) : "";

  return `<html><body><img border="0" src="https://example.com/logo.jpg" alt="${facility}"><h1>Reservation Update</h1>${detailsSection}${playersSection}</body></html>`;
}

/**
 * CourtReserve's second real template — "Registration Confirmation", sent
 * for program/tournament sign-ups (issue #96) — same `<h4>`/`<h5>` field-group
 * shape as `confirmationHtml`, but "Event" in place of "Details" and
 * "Registered Team(s)" (its own value "Team:"-prefixed) in place of "Player(s)".
 */
function registrationHtml(
  fields: {
    facility?: string;
    eventName?: string;
    date?: string;
    time?: string;
    /** `null` omits the Court(s) section entirely, matching a facility that doesn't label its courts. */
    court?: string | null;
    /** `null` omits the Registered Team(s) section entirely. */
    team?: string | null;
  } = {},
): string {
  const {
    facility = "PicklePlex Downsview",
    eventName = "Men's Partners Play 3.5 and up Tourney Style",
    date = "Friday, 8-21-2026",
    time = "2:00 PM - 4:00 PM",
    court = "Court 3",
    team = "Team: Daven Wong, Adrian Luk",
  } = fields;

  const eventSection = section("Event", `${eventName}<br>${date}<br>${time}`);
  const teamSection = team !== null ? section("Registered Team(s)", team) : "";
  const courtSection = court !== null ? section("Court(s)", court) : "";

  return `<html><body><img border="0" src="https://example.com/logo.jpg" alt="${facility}"><h1>Registration Confirmation</h1>${eventSection}${teamSection}${courtSection}</body></html>`;
}

function cancellationHtml(
  fields: {
    facility?: string;
    playerName?: string;
    format?: string;
    date?: string;
    time?: string;
  } = {},
): string {
  const {
    facility = "PicklePlex Downsview",
    playerName = "Amy Ace",
    format = "Doubles",
    date = "Tuesday, 9-15-2026",
    time = "6:00 PM - 7:00 PM",
  } = fields;

  const detailsSection = section("Cancellation Details", `${playerName}<br>${format}<br>${date}<br>${time}`);

  return `<html><body><img border="0" src="https://example.com/logo.jpg" alt="${facility}"><h1>Reservation Cancellation</h1>${detailsSection}</body></html>`;
}

test("a confirmation email parses into facility, date/time, court, format and players", () => {
  const result = parseCourtReserveEmail({
    subject: "Booking Confirmation for Tuesday, 2026-09-15 6:00 PM - 7:00 PM",
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
      name: "Doubles",
      playerNames: ["Amy Ace", "Ben Backhand"],
    },
  });
});

test("a singles confirmation is recognized as singles, not defaulted to doubles", () => {
  const result = parseCourtReserveEmail({
    subject: "Booking Confirmation for Tuesday, 2026-09-15 6:00 PM - 7:00 PM",
    html: confirmationHtml({ format: "Singles" }),
  });

  assert.equal(result.kind, "confirmation");
  assert.equal(result.kind === "confirmation" && result.confirmation.format, "singles");
});

test("an unrecognised or missing format falls back to doubles, the app's own default — never refused", () => {
  const result = parseCourtReserveEmail({
    subject: "Booking Confirmation for Tuesday, 2026-09-15 6:00 PM - 7:00 PM",
    html: confirmationHtml({ format: "Mixed Doubles" }),
  });

  assert.equal(result.kind === "confirmation" && result.confirmation.format, "doubles");
});

test("name carries the Details section's raw first line, not the normalized format value", () => {
  const result = parseCourtReserveEmail({
    subject: "Booking Confirmation for Tuesday, 2026-09-15 6:00 PM - 7:00 PM",
    html: confirmationHtml({ format: "Mixed Doubles" }),
  });

  assert.equal(result.kind === "confirmation" && result.confirmation.name, "Mixed Doubles");
});

test("a Player(s) name starting with the word \"Team\" is left untouched — the \"Team:\" label strip only ever applies to a Registration Confirmation's own Registered Team(s) section", () => {
  const result = parseCourtReserveEmail({
    subject: "Booking Confirmation for Tuesday, 2026-09-15 6:00 PM - 7:00 PM",
    html: confirmationHtml({ players: "Team Captain: Smith, Ben Backhand" }),
  });

  assert.deepEqual(
    result.kind === "confirmation" ? result.confirmation.playerNames : null,
    ["Team Captain: Smith", "Ben Backhand"],
  );
});

test("a facility that doesn't label its courts produces a null courtLabel, not an empty string", () => {
  const result = parseCourtReserveEmail({
    subject: "Booking Confirmation for Tuesday, 2026-09-15 6:00 PM - 7:00 PM",
    html: confirmationHtml({ court: null }),
  });

  assert.equal(result.kind === "confirmation" && result.confirmation.courtLabel, null);
});

test("no players listed produces an empty array, not a failure", () => {
  const result = parseCourtReserveEmail({
    subject: "Booking Confirmation for Tuesday, 2026-09-15 6:00 PM - 7:00 PM",
    html: confirmationHtml({ players: null }),
  });

  assert.deepEqual(result.kind === "confirmation" ? result.confirmation.playerNames : null, []);
});

test("a single-ended time (no range) still parses, with a null endTime", () => {
  const result = parseCourtReserveEmail({
    subject: "Booking Confirmation for Tuesday, 2026-09-15 6:00 PM - 7:00 PM",
    html: confirmationHtml({ time: "6:00 PM" }),
  });

  assert.equal(result.kind === "confirmation" && result.confirmation.startTime, "18:00");
  assert.equal(result.kind === "confirmation" && result.confirmation.endTime, null);
});

test("a dash with an unparseable end time is unparseable, not silently downgraded to no end time", () => {
  // A real end time was intended (there's a dash) — losing it silently would
  // be worse than refusing the whole email.
  const noMeridiem = parseCourtReserveEmail({
    subject: "Booking Confirmation for Tuesday, 2026-09-15 6:00 PM - 7:00 PM",
    html: confirmationHtml({ time: "6:00 PM - 7:00" }),
  });
  assert.deepEqual(noMeridiem, { kind: "unparseable" });

  const placeholder = parseCourtReserveEmail({
    subject: "Booking Confirmation for Tuesday, 2026-09-15 6:00 PM - 7:00 PM",
    html: confirmationHtml({ time: "6:00 PM - TBD" }),
  });
  assert.deepEqual(placeholder, { kind: "unparseable" });
});

test("an accented facility name (in the logo's alt text) decodes correctly, so exact-match Org lookup still has a chance", () => {
  const result = parseCourtReserveEmail({
    subject: "Booking Confirmation for Tuesday, 2026-09-15 6:00 PM - 7:00 PM",
    html: confirmationHtml({ facility: "Caf&eacute; Pickleball Club" }),
  });

  assert.equal(
    result.kind === "confirmation" ? result.confirmation.facilityName : null,
    "Café Pickleball Club",
  );
});

test("a cancellation email parses into facility/date/time — but never a court label, since CourtReserve's cancellation template has no Court(s) section at all", () => {
  const result = parseCourtReserveEmail({
    subject: "Reservation Cancellation Notice",
    html: cancellationHtml(),
  });

  assert.deepEqual(result, {
    kind: "cancellation",
    cancellation: {
      facilityName: "PicklePlex Downsview",
      date: "2026-09-15",
      startTime: "18:00",
      courtLabel: null,
    },
  });
});

test("an update email parses into facility, date/time, court (bundled, not a separate section), format and players", () => {
  const result = parseCourtReserveEmail({
    subject: "Reservation Update Notice",
    html: updateHtml(),
  });

  assert.deepEqual(result, {
    kind: "update",
    update: {
      facilityName: "PicklePlex Downsview",
      date: "2026-09-15",
      startTime: "18:00",
      endTime: "19:00",
      courtLabel: "Court 3",
      format: "doubles",
      name: "Doubles",
      playerNames: ["Amy Ace", "Ben Backhand"],
    },
  });
});

test("an update with no trailing court line produces a null courtLabel, not an empty string", () => {
  const result = parseCourtReserveEmail({
    subject: "Reservation Update Notice",
    html: updateHtml({ court: null }),
  });

  assert.equal(result.kind === "update" ? result.update.courtLabel : undefined, null);
});

test('"Reservation Update Notice" — CourtReserve\'s real subject — is recognized as an update, not confused with a confirmation or cancellation', () => {
  const result = parseCourtReserveEmail({
    subject: "Reservation Update Notice",
    html: updateHtml(),
  });

  assert.equal(result.kind, "update");
});

test("an update subject is still checked after the cancellation check, so a genuine cancellation subject is never misread as an update", () => {
  const result = parseCourtReserveEmail({
    subject: "Reservation Cancellation Notice",
    html: cancellationHtml(),
  });

  assert.equal(result.kind, "cancellation");
});

test("a Registration Confirmation parses into facility, date/time and court the same shape as a Booking Confirmation, with its Event name as both name and (defaulted) format", () => {
  const result = parseCourtReserveEmail({
    subject: "Registration Confirmation - Men's Partners Play 3.5 and up Tourney Style",
    html: registrationHtml(),
  });

  assert.deepEqual(result, {
    kind: "confirmation",
    confirmation: {
      facilityName: "PicklePlex Downsview",
      date: "2026-08-21",
      startTime: "14:00",
      endTime: "16:00",
      courtLabel: "Court 3",
      format: "doubles",
      name: "Men's Partners Play 3.5 and up Tourney Style",
      playerNames: ["Daven Wong", "Adrian Luk"],
    },
  });
});

test('a Registration Confirmation\'s "Registered Team(s)" value strips its leading "Team:" label before splitting into player names', () => {
  const result = parseCourtReserveEmail({
    subject: "Registration Confirmation - Men's Partners Play 3.5 and up Tourney Style",
    html: registrationHtml({ team: "Team: Amy Ace, Ben Backhand" }),
  });

  assert.deepEqual(
    result.kind === "confirmation" ? result.confirmation.playerNames : null,
    ["Amy Ace", "Ben Backhand"],
  );
});

test("a Registration Confirmation whose Event name is literally Singles/Doubles is still recognized as that format, not defaulted", () => {
  const result = parseCourtReserveEmail({
    subject: "Registration Confirmation - Singles Ladder",
    html: registrationHtml({ eventName: "Singles" }),
  });

  assert.equal(result.kind === "confirmation" && result.confirmation.format, "singles");
  assert.equal(result.kind === "confirmation" && result.confirmation.name, "Singles");
});

test('"Registration Confirmation - ..." is recognized as a confirmation even though its subject contains neither "reservation" nor "booking"', () => {
  const result = parseCourtReserveEmail({
    subject: "Registration Confirmation - Men's Partners Play 3.5 and up Tourney Style",
    html: registrationHtml(),
  });

  assert.equal(result.kind, "confirmation");
});

test("no team listed on a Registration Confirmation produces an empty playerNames array, not a failure", () => {
  const result = parseCourtReserveEmail({
    subject: "Registration Confirmation - Men's Partners Play 3.5 and up Tourney Style",
    html: registrationHtml({ team: null }),
  });

  assert.deepEqual(result.kind === "confirmation" ? result.confirmation.playerNames : null, []);
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

test("a confirmation-subject email with no recognisable fields fails as unparseable, never throws", () => {
  const result = parseCourtReserveEmail({
    subject: "Booking Confirmation for Tuesday, 2026-09-15 6:00 PM - 7:00 PM",
    html: "<html><body><p>Something went wrong rendering this email.</p></body></html>",
  });

  assert.deepEqual(result, { kind: "unparseable" });
});

test("a Details block with fewer than three <br>-separated lines is unparseable, not silently misaligned", () => {
  const html =
    '<html><body><img alt="PicklePlex Downsview">' +
    "<h4>Details</h4><table><tr><td>&nbsp;</td></tr></table><h5>Doubles<br>6:00 PM - 7:00 PM</h5>" +
    "</body></html>";

  const result = parseCourtReserveEmail({
    subject: "Booking Confirmation for Tuesday, 2026-09-15 6:00 PM - 7:00 PM",
    html,
  });

  assert.deepEqual(result, { kind: "unparseable" });
});

test("completely empty HTML never throws, whatever the subject claims", () => {
  assert.doesNotThrow(() => {
    parseCourtReserveEmail({ subject: "Booking Confirmation for Tuesday, 2026-09-15 6:00 PM - 7:00 PM", html: "" });
  });
  assert.doesNotThrow(() => {
    parseCourtReserveEmail({ subject: "", html: "" });
  });
});

test("garbage/malformed HTML never throws", () => {
  assert.doesNotThrow(() => {
    parseCourtReserveEmail({
      subject: "Booking Confirmation for Tuesday, 2026-09-15 6:00 PM - 7:00 PM",
      html: "<h4><h5>>>><<<<h4",
    });
  });
});

test("HTML entities in the facility name are decoded", () => {
  const result = parseCourtReserveEmail({
    subject: "Booking Confirmation for Tuesday, 2026-09-15 6:00 PM - 7:00 PM",
    html: confirmationHtml({ facility: "Smith &amp; Sons Tennis &amp; Pickleball Club" }),
  });

  assert.equal(
    result.kind === "confirmation" ? result.confirmation.facilityName : null,
    "Smith & Sons Tennis & Pickleball Club",
  );
});

test("numeric and typographic HTML entities decode too, not just the XML-ish basics", () => {
  const result = parseCourtReserveEmail({
    subject: "Booking Confirmation for Tuesday, 2026-09-15 6:00 PM - 7:00 PM",
    html: confirmationHtml({ facility: "O&#39;Malley&rsquo;s Courts &mdash; Downtown" }),
  });

  assert.equal(
    result.kind === "confirmation" ? result.confirmation.facilityName : null,
    "O'Malley’s Courts — Downtown",
  );
});

test("a confirmation subject that merely mentions a cancellation policy is not misread as a cancellation", () => {
  const result = parseCourtReserveEmail({
    subject: "Your Reservation is Confirmed - Please Review Our Cancellation Policy",
    html: confirmationHtml(),
  });

  assert.equal(result.kind, "confirmation");
});

test('a cancellation subject phrased as a noun ("Reservation Cancellation") is still recognized', () => {
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

test('CourtReserve\'s real subject wording ("Booking Confirmation for ...", not "Reservation Confirmation") is recognized as a confirmation', () => {
  // Regression: the first version's subject pattern required the word
  // "reservation" to appear, which a real captured confirmation subject
  // never contains — it would have silently fallen through to not_a_booking.
  const result = parseCourtReserveEmail({
    subject: "Booking Confirmation for Friday, 2026-08-21 2:00 PM - 4:00 PM",
    html: confirmationHtml(),
  });

  assert.equal(result.kind, "confirmation");
});

test("<br>-separated player names are read as separate players, not concatenated", () => {
  const result = parseCourtReserveEmail({
    subject: "Booking Confirmation for Tuesday, 2026-09-15 6:00 PM - 7:00 PM",
    html: confirmationHtml({ players: "Amy Ace<br>Ben Backhand" }),
  });

  assert.deepEqual(
    result.kind === "confirmation" ? result.confirmation.playerNames : null,
    ["Amy Ace", "Ben Backhand"],
  );
});

test('a time range written with "to" instead of a dash still parses', () => {
  const result = parseCourtReserveEmail({
    subject: "Booking Confirmation for Tuesday, 2026-09-15 6:00 PM - 7:00 PM",
    html: confirmationHtml({ time: "6:00 PM to 7:00 PM" }),
  });

  assert.equal(result.kind === "confirmation" && result.confirmation.startTime, "18:00");
  assert.equal(result.kind === "confirmation" && result.confirmation.endTime, "19:00");
});

test("an uppercase-accented entity (&Eacute;) decodes to its own uppercase character, not the lowercase one", () => {
  const result = parseCourtReserveEmail({
    subject: "Booking Confirmation for Tuesday, 2026-09-15 6:00 PM - 7:00 PM",
    html: confirmationHtml({ facility: "&Eacute;cole Pickleball Club" }),
  });

  assert.equal(
    result.kind === "confirmation" ? result.confirmation.facilityName : null,
    "École Pickleball Club",
  );
});

test("an out-of-range minute (e.g. :75) is refused, not accepted as a valid clock time", () => {
  const result = parseCourtReserveEmail({
    subject: "Booking Confirmation for Tuesday, 2026-09-15 6:00 PM - 7:00 PM",
    html: confirmationHtml({ time: "6:75 PM - 7:00 PM" }),
  });

  assert.deepEqual(result, { kind: "unparseable" });
});

// --- Real-fixture regression tests -----------------------------------------
//
// The HTML below is two real CourtReserve emails (a confirmation and a
// cancellation), captured via Gmail's "Show original" and decoded from
// quoted-printable — not a reconstruction. The facility name and player
// names have been swapped for the same placeholders the rest of this file
// uses (this repo is public); everything else, including the nested
// doctype/html wrapper, the divider tables between each heading and its
// value, the footer, and the tracking-pixel image, is byte-for-byte what
// CourtReserve actually sends. These are what caught the first version's
// `<td>`-row assumption and its "reservation"-only subject pattern being
// wrong for a real email.

const REAL_CONFIRMATION_SUBJECT = "Booking Confirmation for Friday, 2026-08-21 2:00 PM - 4:00 PM";

const REAL_CONFIRMATION_HTML = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">  <html xmlns="http://www.w3.org/1999/xhtml">  <head>      <meta http-equiv="Content-Type" content="text/html; charset=utf-8">      <meta name="viewport" content="width=device-width, initial-scale=1.0">      <link href="https://app.courtreserve.com/fonts/axiforma/stylesheet.css" rel="stylesheet">  </head>  <body style="margin: 0px; padding: 0px; background-color: #EEEEEE;">      <table cellpadding="0" cellspacing="0" border="0" width="100%" class="body" style="width: 100%;">          <tbody>              <tr>                  <td align="center" valign="top" style="vertical-align: top; line-height: 1; padding: clamp(12px, calc(100vw - 1060px), 60px);">                      <span style="display: inline-block; font-size: 0px; line-height: 0; vertical-align: top; max-width: 600px; background-color: white; width: 100%; padding-top: 16px;">                          <img border="0" src="https://tgcstorage.blob.core.windows.net/court-reserve-17681/86bd6b34-42c5-4cc2-82d7-a4d8ab6d8a7e.jpg" alt="PicklePlex Downsview " height='100' style="margin: 0px; padding: 0px; max-width: 100%; border: none; vertical-align: top; max-width: 420px;max-height:100px;object-fit:contain;">                      </span>                      <span style=" background-color: white;">                          <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">
<html xmlns="http://www.w3.org/1999/xhtml"><head></head><body style="font-family: Inter, Axiforma, Roboto, 'Google Sans', Helvetica, Arial, sans-serif; margin: 0px; padding: 0px; background-color: #eeeeee;"><div style="background-color: #eeeeee;"><table cellpadding="0" cellspacing="0" border="0" width="100%" max-width="600px" margin="auto" class="body" style="width: 100%; max-width: 600px; margin: auto;"><tbody><tr><td align="center" valign="top" style="vertical-align:top;line-height:1;padding:0px 0px"><table cellpadding="0" cellspacing="0" border="0" width="100%" max-width="600px" margin="auto" class="main container" style="width: 100%; max-width: 600px; margin: auto;"><tr><td align="left" valign="top" bgcolor="#ffffff" style="vertical-align: top; line-height: 1; padding: 32px 0px 10px; background-color: #ffffff;"><table cellpadding="0" cellspacing="0" border="0" width="100%" max-width="600px" margin="auto" class="block" style="width: 100%; max-width: 600px; margin: auto;"><tr><td align="center" valign="top" bgcolor="#ffffff" style="vertical-align: top; line-height: 1; background-color: #ffffff;"><h1 class="h1" style="padding: 0px; margin: 0px; font-style: normal; font-family: Inter, Axiforma, Roboto, 'Google Sans', Helvetica, Arial, sans-serif; font-size: 28px; line-height: 36px; color: #111118; font-weight: bold;">Confirmation</h1><h3 class="h3" style="padding: 0px; margin: 4px 10px 7px; font-style: normal; font-family: Inter, Axiforma, Roboto, 'Google Sans', Helvetica, Arial, sans-serif; font-size: 14px; line-height: 20px; color: #111118; font-weight: normal;">Review the details of your booking below</h3></td></tr></table><table cellpadding="0" cellspacing="0" border="0" width="100%" max-width="600px" margin="auto" class="block" style="width: 100%; max-width: 600px; margin: auto;"><tr><td align="left" valign="top" style="vertical-align: top; line-height: 1; padding: 10px 0px;"><table cellpadding="0" cellspacing="0" border="0" width="100%" max-width="600px" margin="auto" class="divider" style="width: 100%; max-width: 600px; margin: auto;"><tr><td align="left" valign="top" bgcolor="#e0e0e0" style="vertical-align: top; line-height: 1px; padding: 0px; font-size: 1px; background-color: #e0e0e0;">&nbsp;</td></tr></table></td></tr></table><table cellpadding="0" cellspacing="0" border="0" width="100%" max-width="600px" margin="auto" class="block" style="width: 100%; max-width: 600px; margin: auto;"><tr><td align="left" valign="top" style="vertical-align: top; line-height: 1; padding: 0px;"><h5 class="h5" align="center" style="padding: 0px; margin: 6px 0px; font-style: normal; font-family: Inter, Axiforma, Roboto, 'Google Sans', Helvetica, Arial, sans-serif; font-size: 14px; line-height: 21px; color: #111118; font-weight: 400;">        </h5></td></tr></table><table cellpadding="0" cellspacing="0" border="0" width="100%" max-width="600px" margin="auto" class="block" style="width: 100%; max-width: 600px; margin: auto;"><tr><td align="left" valign="top" style="vertical-align: top; line-height: 1; padding: 10px 20px 0px;"><h4 class="h4" align="left" style="padding: 0px; margin: 0px 0px 4px; font-style: normal; font-family: Inter, Axiforma, Roboto, 'Google Sans', Helvetica, Arial, sans-serif; font-size: 14px; line-height: 21px; color: #111118; font-weight: 700;">Details</h4><table cellpadding="0" cellspacing="0" border="0" width="100%" max-width="600px" margin="auto" class="divider" style="width: 100%; max-width: 600px; margin: auto;"><tr><td align="left" valign="top" bgcolor="#e0e0e0" style="vertical-align: top; line-height: 1px; padding: 0px; font-size: 1px; background-color: #e0e0e0;">&nbsp;</td></tr></table><h5 class="h5" align="left" style="padding: 0px; margin: 12px 0px 6px; font-style: normal; font-family: Inter, Axiforma, Roboto, 'Google Sans', Helvetica, Arial, sans-serif; font-size: 14px; line-height: 21px; color: #111118; font-weight: 400;">Singles<br>Friday, 8-21-2026<br>2:00 PM - 4:00 PM</h5></td></tr></table><table cellpadding="0" cellspacing="0" border="0" class="block" style="display: table; width: 100%;"><tr><td align="left" valign="top" style="vertical-align: top; line-height: 1; padding: 10px 20px 0px;"><h4 class="h4" align="left" style="padding: 0px; margin: 0px 0px 4px; font-style: normal; font-family: Inter, Axiforma, Roboto, 'Google Sans', Helvetica, Arial, sans-serif; font-size: 14px; line-height: 21px; color: #111118; font-weight: 700;">Player(s)</h4><table cellpadding="0" cellspacing="0" border="0" width="100%" max-width="600px" margin="auto" class="divider" style="width: 100%; max-width: 600px; margin: auto;"><tr><td align="left" valign="top" bgcolor="#e0e0e0" style="vertical-align: top; line-height: 1px; padding: 0px; font-size: 1px; background-color: #e0e0e0;">&nbsp;</td></tr></table><h5 class="h5" align="left" style="padding: 0px; margin: 12px 0px 6px; font-style: normal; font-family: Inter, Axiforma, Roboto, 'Google Sans', Helvetica, Arial, sans-serif; font-size: 14px; line-height: 21px; color: #111118; font-weight: 400;">Amy Ace, Ben Backhand</h5></td></tr></table><table cellpadding="0" cellspacing="0" border="0" class="block" style="display: table; width: 100%;"><tr><td align="left" valign="top" style="vertical-align: top; line-height: 1; padding: 10px 20px 0px;"><h4 class="h4" align="left" style="padding: 0px; margin: 0px 0px 4px; font-style: normal; font-family: Inter, Axiforma, Roboto, 'Google Sans', Helvetica, Arial, sans-serif; font-size: 14px; line-height: 21px; color: #111118; font-weight: 700;">Court(s)</h4><table cellpadding="0" cellspacing="0" border="0" width="100%" max-width="600px" margin="auto" class="divider" style="width: 100%; max-width: 600px; margin: auto;"><tr><td align="left" valign="top" bgcolor="#e0e0e0" style="vertical-align: top; line-height: 1px; padding: 0px; font-size: 1px; background-color: #e0e0e0;">&nbsp;</td></tr></table><h5 class="h5" align="left" style="padding: 0px; margin: 12px 0px 6px; font-style: normal; font-family: Inter, Axiforma, Roboto, 'Google Sans', Helvetica, Arial, sans-serif; font-size: 14px; line-height: 21px; color: #111118; font-weight: 400;">Court #6 - Hard</h5></td></tr></table></td></tr></table></td></tr></tbody></table></div></body></html>                      </span>                      <table cellpadding="0" cellspacing="0" border="0" class="footer container" style="width: 100%; max-width: 600px; border-collapse: separate;">                          <tr>                              <td align="left" valign="top" bgcolor="#2960e9" style="vertical-align: top; line-height: 1; background-color: #2960e9; padding: 20px">                                  <table cellpadding="0" cellspacing="0" border="0" width="100%" class="block" style="width: 100%;">                                      <tr>                                          <td align="center" valign="top" style="vertical-align: top; line-height: 1;">                                              <p style="padding: 0px; margin: 0px; color: #fbf9f9; font-size: 20px; line-height: 18px; font-weight: 700;">                                                  PicklePlex Downsview                                               </p>                                              <p style="padding: 0px; padding-top: 16px; margin: 0px; color: #fbf9f9; font-size: 12px; line-height: 18px; ">                                                  <span>© 2026 All Rights Reserved</span>                                                  <a href="https://app.courtreserve.com/Account/MyProfile?page=notifications">Notification Preferences</a>                                              </p>                                          </td>                                      </tr>                                  </table>                              </td>                          </tr>                      </table>                  </td>              </tr>          </tbody>      </table>  <img src="https://u2196282.ct.sendgrid.net/wf/open?upn=example-tracking-token" alt="" width="1" height="1" border="0" style="height:1px !important;width:1px !important;"/></body>  </html>`;

const REAL_CANCELLATION_SUBJECT = "Reservation Cancellation Notice";

const REAL_CANCELLATION_HTML = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">  <html xmlns="http://www.w3.org/1999/xhtml">  <head>      <meta http-equiv="Content-Type" content="text/html; charset=utf-8">      <meta name="viewport" content="width=device-width, initial-scale=1.0">      <link href="https://app.courtreserve.com/fonts/axiforma/stylesheet.css" rel="stylesheet">  </head>  <body style="margin: 0px; padding: 0px; background-color: #EEEEEE;">      <table cellpadding="0" cellspacing="0" border="0" width="100%" class="body" style="width: 100%;">          <tbody>              <tr>                  <td align="center" valign="top" style="vertical-align: top; line-height: 1; padding: clamp(12px, calc(100vw - 1060px), 60px);">                      <span style="display: inline-block; font-size: 0px; line-height: 0; vertical-align: top; max-width: 600px; background-color: white; width: 100%; padding-top: 16px;">                          <img border="0" src="https://tgcstorage.blob.core.windows.net/court-reserve-17681/86bd6b34-42c5-4cc2-82d7-a4d8ab6d8a7e.jpg" alt="PicklePlex Downsview " height='100' style="margin: 0px; padding: 0px; max-width: 100%; border: none; vertical-align: top; max-width: 420px;max-height:100px;object-fit:contain;">                      </span>                      <span style=" background-color: white;">                          <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">
<html xmlns="http://www.w3.org/1999/xhtml"><head></head><body style="font-family: Inter, Axiforma, Roboto, Google Sans, Helvetica, Arial, sans-serif; margin: 0px; padding: 0px; background-color: #eeeeee;"><div style="background-color: #eeeeee;"><table cellpadding="0" cellspacing="0" border="0" width="100%" max-width="600px" margin="auto" style="width: 100%; max-width: 600px; margin: auto;" class="body"><tbody><tr><td align="center" valign="top" style="vertical-align:top;line-height:1;padding:0px 0px"><table cellpadding="0" cellspacing="0" border="0" width="100%" max-width="600px" margin="auto" style="width: 100%; max-width: 600px; margin: auto;" class="main container"><tr><td align="left" valign="top" style="vertical-align: top; line-height: 1; padding: 32px 0px 10px; background-color: #ffffff;" bgcolor="#ffffff"><table cellpadding="0" cellspacing="0" border="0" width="100%" max-width="600px" margin="auto" style="width: 100%; max-width: 600px; margin: auto;" class="block"><tr><td align="center" valign="top" style="vertical-align: top; line-height: 1; background-color: #ffffff;" bgcolor="#ffffff"><h1 class="h1" style="padding: 0px; margin: 0px; font-style: normal; font-family: Inter, Axiforma, Roboto, Google Sans, Helvetica, Arial, sans-serif; font-size: 28px; line-height: 36px; color: #111118; font-weight: bold;">Reservation Cancellation</h1><h3 class="h3" style="padding: 0px; margin: 4px 10px 7px; font-style: normal; font-family: Inter, Axiforma, Roboto, Google Sans, Helvetica, Arial, sans-serif; font-size: 14px; line-height: 20px; color: #111118; font-weight: normal;">This&nbsp;Reservation has been cancelled</h3></td></tr></table><table cellpadding="0" cellspacing="0" border="0" width="100%" max-width="600px" margin="auto" style="width: 100%; max-width: 600px; margin: auto;" class="block"><tr><td align="left" valign="top" style="vertical-align: top; line-height: 1; padding: 10px 0px;"><table cellpadding="0" cellspacing="0" border="0" width="100%" max-width="600px" margin="auto" style="width: 100%; max-width: 600px; margin: auto;" class="divider"><tr><td align="left" valign="top" style="vertical-align: top; line-height: 1px; padding: 0px; font-size: 1px; background-color: #e0e0e0;" bgcolor="#e0e0e0">&nbsp;</td></tr></table></td></tr></table><table cellpadding="0" cellspacing="0" border="0" width="100%" max-width="600px" margin="auto" style="width: 100%; max-width: 600px; margin: auto;" class="block"><tr><td align="left" valign="top" style="vertical-align: top; line-height: 1; padding: 0px;"><h5 class="h5" style="padding: 0px; margin: 6px 0px; font-style: normal; font-family: Inter, Axiforma, Roboto, Google Sans, Helvetica, Arial, sans-serif; font-size: 14px; line-height: 21px; color: #111118; font-weight: 400;" align="center">        </h5></td></tr></table><table cellpadding="0" cellspacing="0" border="0" width="100%" max-width="600px" margin="auto" style="width: 100%; max-width: 600px; margin: auto;" class="block"><tr><td align="left" valign="top" style="vertical-align: top; line-height: 1; padding: 10px 20px 0px;"><h4 class="h4" style="padding: 0px; margin: 0px 0px 4px; font-style: normal; font-family: Inter, Axiforma, Roboto, Google Sans, Helvetica, Arial, sans-serif; font-size: 14px; line-height: 21px; color: #111118; font-weight: 700;" align="left">Cancellation Details</h4><table cellpadding="0" cellspacing="0" border="0" width="100%" max-width="600px" margin="auto" style="width: 100%; max-width: 600px; margin: auto;" class="divider"><tr><td align="left" valign="top" style="vertical-align: top; line-height: 1px; padding: 0px; font-size: 1px; background-color: #e0e0e0;" bgcolor="#e0e0e0">&nbsp;</td></tr></table><h5 class="h5" style="padding: 0px; margin: 12px 0px 6px; font-style: normal; font-family: Inter, Axiforma, Roboto, Google Sans, Helvetica, Arial, sans-serif; font-size: 14px; line-height: 21px; color: #111118; font-weight: 400;" align="left">Amy&nbsp;Ace<br>Singles<br>Friday, 8-21-2026<br>2:00 PM - 4:00 PM</h5></td></tr></table></td></tr></table></td></tr></tbody></table></div></body></html>                      </span>                      <table cellpadding="0" cellspacing="0" border="0" class="footer container" style="width: 100%; max-width: 600px; border-collapse: separate;">                          <tr>                              <td align="left" valign="top" bgcolor="#2960e9" style="vertical-align: top; line-height: 1; background-color: #2960e9; padding: 20px">                                  <table cellpadding="0" cellspacing="0" border="0" width="100%" class="block" style="width: 100%;">                                      <tr>                                          <td align="center" valign="top" style="vertical-align: top; line-height: 1;">                                              <p style="padding: 0px; margin: 0px; color: #fbf9f9; font-size: 20px; line-height: 18px; font-weight: 700;">                                                  PicklePlex Downsview                                               </p>                                              <p style="padding: 0px; padding-top: 16px; margin: 0px; color: #fbf9f9; font-size: 12px; line-height: 18px; ">                                                  <span>© 2026 All Rights Reserved</span>                                                  <a href="https://mobileapp.courtreserve.com/Online/MyProfile/MyProfile/17681?page=notifications">Notification Preferences</a>                                              </p>                                          </td>                                      </tr>                                  </table>                              </td>                          </tr>                      </table>                  </td>              </tr>          </tbody>      </table>  <img src="https://u2196282.ct.sendgrid.net/wf/open?upn=example-tracking-token" alt="" width="1" height="1" border="0" style="height:1px !important;width:1px !important;"/></body>  </html>`;

const REAL_UPDATE_SUBJECT = "Reservation Update Notice";

// Captured via Gmail's "Show original" from a real "Reservation Update
// Notice" — CourtReserve's own resend after a logged reservation's details
// changed (here: Singles -> Doubles, two players added). Confirms the design
// difference from a confirmation email documented in courtreserve-email.ts's
// own header: "Reservation Details" (not "Details") bundles the court label
// in as a fourth `<br>`-joined line, with no separate Court(s) section at
// all — the confirmation template's own boilerplate <style> block is trimmed
// here as noise, same as the other two real fixtures above.
const REAL_UPDATE_HTML = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">  <html xmlns="http://www.w3.org/1999/xhtml">  <head>      <meta http-equiv="Content-Type" content="text/html; charset=utf-8">      <meta name="viewport" content="width=device-width, initial-scale=1.0">      <link href="https://app.courtreserve.com/fonts/axiforma/stylesheet.css" rel="stylesheet">        </head>  <body style="margin: 0px; padding: 0px; background-color: #EEEEEE;">      <table cellpadding="0" cellspacing="0" border="0" width="100%" class="body" style="width: 100%;">          <tbody>              <tr>                  <td align="center" valign="top" style="vertical-align: top; line-height: 1; padding: clamp(12px, calc(100vw - 1060px), 60px);">                      <span style="display: inline-block; font-size: 0px; line-height: 0; vertical-align: top; max-width: 600px; background-color: white; width: 100%; padding-top: 16px;">                          <img border="0" src="https://tgcstorage.blob.core.windows.net/court-reserve-17681/86bd6b34-42c5-4cc2-82d7-a4d8ab6d8a7e.jpg" alt="PicklePlex Downsview " height='100' style="margin: 0px; padding: 0px; max-width: 100%; border: none; vertical-align: top; max-width: 420px;max-height:100px;object-fit:contain;">                      </span>                      <span style=" background-color: white;">                          <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd"><html xmlns="http://www.w3.org/1999/xhtml"><head></head><body style="font-family: Inter, Axiforma, Roboto, 'Google Sans', Helvetica, Arial, sans-serif; margin: 0px; padding: 0px; background-color: #eeeeee;"><div style="background-color: #eeeeee;"><table cellpadding="0" cellspacing="0" border="0" width="100%" max-width="600px" margin="auto" class="body" style="width: 100%; max-width: 600px; margin: auto;"><tbody><tr><td align="center" valign="top" style="vertical-align:top;line-height:1;padding:0px 0px"><table cellpadding="0" cellspacing="0" border="0" width="100%" max-width="600px" margin="auto" class="main container" style="width: 100%; max-width: 600px; margin: auto;"><tr><td align="left" valign="top" bgcolor="#ffffff" style="vertical-align: top; line-height: 1; padding: 32px 0px 10px; background-color: #ffffff;"><table cellpadding="0" cellspacing="0" border="0" width="100%" max-width="600px" margin="auto" class="block" style="width: 100%; max-width: 600px; margin: auto;"><tr><td align="center" valign="top" bgcolor="#ffffff" style="vertical-align: top; line-height: 1; background-color: #ffffff;"><h1 class="h1" style="padding: 0px; margin: 0px; font-style: normal; font-family: Inter, Axiforma, Roboto, 'Google Sans', Helvetica, Arial, sans-serif; font-size: 28px; line-height: 36px; color: #111118; font-weight: bold;">Reservation Update</h1><h3 class="h3" style="padding: 0px; margin: 4px 10px 7px; font-style: normal; font-family: Inter, Axiforma, Roboto, 'Google Sans', Helvetica, Arial, sans-serif; font-size: 14px; line-height: 20px; color: #111118; font-weight: normal;">Review the details of your&nbsp;Reservation below</h3></td></tr></table><table cellpadding="0" cellspacing="0" border="0" width="100%" max-width="600px" margin="auto" class="block" style="width: 100%; max-width: 600px; margin: auto;"><tr><td align="left" valign="top" style="vertical-align: top; line-height: 1; padding: 10px 0px;"><table cellpadding="0" cellspacing="0" border="0" width="100%" max-width="600px" margin="auto" class="divider" style="width: 100%; max-width: 600px; margin: auto;"><tr><td align="left" valign="top" bgcolor="#e0e0e0" style="vertical-align: top; line-height: 1px; padding: 0px; font-size: 1px; background-color: #e0e0e0;">&nbsp;</td></tr></table></td></tr></table><table cellpadding="0" cellspacing="0" border="0" class="block" style="display: table; width: 100%;"><tr><td align="left" valign="top" style="vertical-align: top; line-height: 1; padding: 0px 20px;"><h5 class="h5" align="center" style="padding: 0px; margin: 6px 0px; font-style: normal; font-family: Inter, Axiforma, Roboto, 'Google Sans', Helvetica, Arial, sans-serif; font-size: 14px; line-height: 21px; color: #111118; font-weight: 400;"></h5></td></tr></table><table cellpadding="0" cellspacing="0" border="0" width="100%" max-width="600px" margin="auto" class="block" style="width: 100%; max-width: 600px; margin: auto;"><tr><td align="left" valign="top" style="vertical-align: top; line-height: 1; padding: 10px 20px 0px;"><h4 class="h4" align="left" style="padding: 0px; margin: 0px 0px 4px; font-style: normal; font-family: Inter, Axiforma, Roboto, 'Google Sans', Helvetica, Arial, sans-serif; font-size: 14px; line-height: 21px; color: #111118; font-weight: 700;">Reservation Details</h4><table cellpadding="0" cellspacing="0" border="0" width="100%" max-width="600px" margin="auto" class="divider" style="width: 100%; max-width: 600px; margin: auto;"><tr><td align="left" valign="top" bgcolor="#e0e0e0" style="vertical-align: top; line-height: 1px; padding: 0px; font-size: 1px; background-color: #e0e0e0;">&nbsp;</td></tr></table><h5 class="h5" align="left" style="padding: 0px; margin: 12px 0px 6px; font-style: normal; font-family: Inter, Axiforma, Roboto, 'Google Sans', Helvetica, Arial, sans-serif; font-size: 14px; line-height: 21px; color: #111118; font-weight: 400;">Doubles<br>Tuesday, 8-18-2026<br>12:00 PM - 2:00 PM<br>Court #9 - Hard</h5></td></tr></table><table cellpadding="0" cellspacing="0" border="0" class="block" style="display: table; width: 100%;"><tr><td align="left" valign="top" style="vertical-align: top; line-height: 1; padding: 10px 20px 0px;"><h4 class="h4" align="left" style="padding: 0px; margin: 0px 0px 4px; font-style: normal; font-family: Inter, Axiforma, Roboto, 'Google Sans', Helvetica, Arial, sans-serif; font-size: 14px; line-height: 21px; color: #111118; font-weight: 700;">Player(s)</h4><table cellpadding="0" cellspacing="0" border="0" width="100%" max-width="600px" margin="auto" class="divider" style="width: 100%; max-width: 600px; margin: auto;"><tr><td align="left" valign="top" bgcolor="#e0e0e0" style="vertical-align: top; line-height: 1px; padding: 0px; font-size: 1px; background-color: #e0e0e0;">&nbsp;</td></tr></table><h5 class="h5" align="left" style="padding: 0px; margin: 12px 0px 6px; font-style: normal; font-family: Inter, Axiforma, Roboto, 'Google Sans', Helvetica, Arial, sans-serif; font-size: 14px; line-height: 21px; color: #111118; font-weight: 400;">Amy Ace<br>Ben Backhand<br>Cara Crosscourt<br>Dave Dink</h5></td></tr></table><table cellpadding="0" cellspacing="0" border="0" class="block" style="display: table; width: 100%;"><tr><td align="left" valign="top" style="vertical-align: top; line-height: 1; padding: 0px 20px;"><h5 class="h5" align="center" style="padding: 0px; margin: 6px 0px; font-style: normal; font-family: Inter, Axiforma, Roboto, 'Google Sans', Helvetica, Arial, sans-serif; font-size: 14px; line-height: 21px; color: #111118; font-weight: 400;"></h5></td></tr></table></td></tr></table></td></tr></tbody></table></div></body></html>                      </span>                      <table cellpadding="0" cellspacing="0" border="0" class="footer container" style="width: 100%; max-width: 600px; border-collapse: separate;">                          <tr>                              <td align="left" valign="top" bgcolor="#2960e9" style="vertical-align: top; line-height: 1; background-color: #2960e9; padding: 20px">                                  <table cellpadding="0" cellspacing="0" border="0" width="100%" class="block" style="width: 100%;">                                      <tr>                                          <td align="center" valign="top" style="vertical-align: top; line-height: 1;">                                              <p style="padding: 0px; margin: 0px; color: #fbf9f9; font-size: 20px; line-height: 18px; font-weight: 700; font-family: Inter, Axiforma, Roboto, 'Google Sans', Helvetica, Arial, sans-serif;">                                                  PicklePlex Downsview                                               </p>                                              <footercr>                                                  <div class="social" style="padding-top: 16px; justify-content: center; display: inline-flex; color: #fbf9f9 ">                                                      <span>                                                          <a href="example.com" target="_blank" style="text-decoration: none; margin-right: 6px;margin-left: 6px">                                                              <img style="max-width: 36px" src="https://app.courtreserve.com/Content/Images/email/globe_white.png">                                                          </a>                                                      </span>                                                                                                                                                                                                                                                                            </div>                                              </footercr>                                              <span style="background-color: #fbf9f9; height: 1px; width: 100%; margin-top: 16px; width: 70%; display: block;"></span>                                                <p style="padding: 0px; padding-top: 16px; margin: 0px; color: #fbf9f9; font-size: 12px; line-height: 18px; ">                                                  <span style="font-family: Inter, Axiforma, Roboto, 'Google Sans', Helvetica, Arial, sans-serif;color: #fbf9f9 ">© 2026 All Rights Reserved</span>                                                  <a href="https://mobileapp.courtreserve.com/Online/MyProfile/MyProfile/17681?page=notifications" style="text-decoration: underline; font-size: 10px; font-weight: 400; padding-top: 4px; color: #fbf9f9; display: block; font-family: Inter, Axiforma, Roboto, 'Google Sans', Helvetica, Arial, sans-serif;">Notification Preferences</a>                                              </p>                                          </td>                                      </tr>                                  </table>                              </td>                          </tr>                      </table>                  </td>              </tr>          </tbody>      </table>  <img src="https://u2196282.ct.sendgrid.net/wf/open?upn=example-tracking-token" alt="" width="1" height="1" border="0" style="height:1px !important;width:1px !important;border-width:0 !important;margin-top:0 !important;margin-bottom:0 !important;margin-right:0 !important;margin-left:0 !important;padding-top:0 !important;padding-bottom:0 !important;padding-right:0 !important;padding-left:0 !important;"/></body>  </html>`;

test("a real captured confirmation email (facility/player names replaced with placeholders) parses correctly, including its nested doctype/html wrapper and footer", () => {
  const result = parseCourtReserveEmail({ subject: REAL_CONFIRMATION_SUBJECT, html: REAL_CONFIRMATION_HTML });

  assert.deepEqual(result, {
    kind: "confirmation",
    confirmation: {
      facilityName: "PicklePlex Downsview",
      date: "2026-08-21",
      startTime: "14:00",
      endTime: "16:00",
      courtLabel: "Court #6 - Hard",
      format: "singles",
      name: "Singles",
      playerNames: ["Amy Ace", "Ben Backhand"],
    },
  });
});

test("a real captured cancellation email (facility/player name replaced with placeholders) parses correctly, with a null courtLabel since the real template has no Court(s) section", () => {
  const result = parseCourtReserveEmail({ subject: REAL_CANCELLATION_SUBJECT, html: REAL_CANCELLATION_HTML });

  assert.deepEqual(result, {
    kind: "cancellation",
    cancellation: {
      facilityName: "PicklePlex Downsview",
      date: "2026-08-21",
      startTime: "14:00",
      courtLabel: null,
    },
  });
});

test("a real captured update email (facility/player names replaced with placeholders) parses correctly, with the court label read off the bundled fourth line, not a separate section", () => {
  const result = parseCourtReserveEmail({ subject: REAL_UPDATE_SUBJECT, html: REAL_UPDATE_HTML });

  assert.deepEqual(result, {
    kind: "update",
    update: {
      facilityName: "PicklePlex Downsview",
      date: "2026-08-18",
      startTime: "12:00",
      endTime: "14:00",
      courtLabel: "Court #9 - Hard",
      format: "doubles",
      name: "Doubles",
      playerNames: ["Amy Ace", "Ben Backhand", "Cara Crosscourt", "Dave Dink"],
    },
  });
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
