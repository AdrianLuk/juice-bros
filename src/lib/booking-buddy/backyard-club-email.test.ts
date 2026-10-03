import assert from "node:assert/strict";
import test from "node:test";

import { BACKYARD_CLUB_SENDER, parseBackyardClubEmail } from "./backyard-club-email.ts";
import { buildBookingEmailSearchCriteria, parseBookingEmail } from "./booking-email.ts";
import { COURTRESERVE_SENDER } from "./courtreserve-email.ts";

/**
 * Backyard Club's real template, as three captured emails decoded it
 * (quoted-printable undone, the way a mailbox adapter hands the HTML over).
 * The recipient's name is a placeholder, the zero-width preheader padding is
 * cut, and the per-recipient unsubscribe token is replaced, since this repo
 * is public. Everything else, footer included, is verbatim: the footer's
 * opening hours are a second time range the parser has to ignore.
 */
function backyardEmailHtml(eyebrow: string, preheader: string, contentHtml: string): string {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
</head>
<body style="margin:0;padding:0;background:#f4f5f0;">
  <div style="display:none;max-height:0;max-width:0;overflow:hidden;mso-hide:all;">${preheader}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f0;padding:28px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;background:#fff8e7;border:1px solid #e8dcc8;">
          <tr>
            <td style="background:#1c3828;padding:18px 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align:middle;"><img src="https://www.thebkydclub.com/favicon.png" width="34" height="32" alt="Backyard Club" style="display:block;border:0;"/></td>
                  <td style="vertical-align:middle;padding-left:11px;"><span style="font-family:'Playfair Display',Georgia,'Times New Roman',serif;font-style:italic;font-size:20px;color:#adc5ad;">Backyard Club</span></td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="font-family:'Lora',Georgia,'Times New Roman',serif;color:#2e332f;font-size:15px;line-height:1.6;padding:28px 32px 10px;">
              <p style="margin:0 0 10px;font-family:'Lora',Georgia,'Times New Roman',serif;font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:#1e4d35;">${eyebrow}</p>
              <h1 style="margin:0 0 14px;font-family:'Playfair Display',Georgia,'Times New Roman',serif;font-size:26px;font-weight:700;color:#1c3828;">Hi Player,</h1>
              <div style="width:36px;height:2px;background:#1e4d35;margin:0 0 20px;"></div>
              ${contentHtml}
            </td>
          </tr>
          <tr>
            <td style="background:#1c3828;padding:20px 32px 18px;">
              <p style="margin:0 0 4px;font-family:'Lora',Georgia,'Times New Roman',serif;font-size:10px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:#c9a84c;">Visit</p>
              <p style="margin:0 0 12px;font-family:'Lora',Georgia,'Times New Roman',serif;font-size:13px;"><a href="https://www.google.com/maps/search/?api=1&query=Backyard%20Club%201800%20Steeles%20Ave.%20W.%2C%20Vaughan%2C%20ON" style="color:rgba(255,255,255,0.82);text-decoration:underline;">1800 Steeles Ave. W., Vaughan, ON</a></p>
              <p style="margin:0 0 4px;font-family:'Lora',Georgia,'Times New Roman',serif;font-size:10px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:#c9a84c;">Hours</p>
              <p style="margin:0 0 12px;font-family:'Lora',Georgia,'Times New Roman',serif;font-size:13px;color:rgba(255,255,255,0.82);">Every day &middot; 8:00 AM – 10:00 PM</p>
              <p style="margin:0 0 4px;font-family:'Lora',Georgia,'Times New Roman',serif;font-size:10px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:#c9a84c;">Call</p>
              <p style="margin:0 0 12px;font-family:'Lora',Georgia,'Times New Roman',serif;font-size:13px;color:rgba(255,255,255,0.82);">Front desk &middot; <a href="tel:+16478085860" style="color:rgba(255,255,255,0.82);text-decoration:underline;">(647) 808-5860</a></p>
              <p style="margin:0 0 4px;font-family:'Lora',Georgia,'Times New Roman',serif;font-size:10px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:#c9a84c;">Online</p>
              <p style="margin:0 0 8px;font-family:'Lora',Georgia,'Times New Roman',serif;font-size:13px;"><a href="https://www.thebkydclub.com" style="color:rgba(255,255,255,0.82);text-decoration:underline;">thebkydclub.com</a></p>
              <div style="height:1px;background:rgba(255,255,255,0.16);margin:10px 0 12px;"></div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td class="bkyd-foot-brand" style="vertical-align:middle;"><span style="font-family:'Playfair Display',Georgia,'Times New Roman',serif;font-style:italic;font-size:14px;color:#adc5ad;">Backyard Club</span></td>
                  <td class="bkyd-foot-unsub" align="right" style="vertical-align:middle;text-align:right;font-family:'Lora',Georgia,'Times New Roman',serif;font-size:11px;color:rgba(255,255,255,0.55);">Don't want these emails? <a href="https://www.thebkydclub.com/unsubscribe?token=REDACTED" style="color:rgba(255,255,255,0.82);text-decoration:underline;">Unsubscribe</a>.</td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

const YOURE_IN_EMAIL = {
  subject: "You're in — Advanced Open Play 4.0+, Sep 23 11:00 AM",
  html: backyardEmailHtml(
    "You&#39;re in",
    "See you on the court!",
    `<p style="margin:0 0 14px;">You've joined <strong>Advanced Open Play 4.0+</strong>:</p>
<div style="background:#ffffef;border:1px solid #e8dcc8;padding:16px 18px;margin:0 0 18px;"><p style="margin:0 0 4px;">Wednesday, September 23, 2026</p><p style="margin:0 0 4px;">11:00 AM – 2:00 PM</p><p style="margin:0 0 0;">Courts 6, 7, 8, 9</p></div>
<p style="margin:0 0 10px;">See you at Backyard Club!</p>
<p style="margin:0;color:#839179;font-size:13px;">Plans change? Cancel at least 24 hours before start for a full refund.</p>`,
  ),
};

const UPDATED_EMAIL = {
  subject: "Updated — Advanced Open Play 4.0+, Sep 23 11:00 AM",
  html: backyardEmailHtml(
    "Schedule change",
    "New details for Advanced Open Play 4.0+ — you&#39;re still signed up.",
    `<p style="margin:0 0 14px;">The details for <strong>Advanced Open Play 4.0+</strong> have changed. Here's where things stand now:</p>
<div style="background:#ffffef;border:1px solid #e8dcc8;padding:16px 18px;margin:0 0 18px;"><p style="margin:0 0 4px;">Wednesday, September 23, 2026</p><p style="margin:0 0 4px;">11:00 AM – 2:00 PM</p><p style="margin:0 0 0;">Courts 6, 7, 8, 9, 10, 11, 12</p></div>
<p style="margin:0 0 18px;">You're still signed up — no action needed.</p>`,
  ),
};

const HOURLY_BOOKING_EMAIL = {
  subject: "Your booking is confirmed — Court 5, Oct 1 1:00 PM",
  html: backyardEmailHtml(
    "Booking confirmed",
    "See you on the court!",
    `<p style="margin:0 0 14px;">Your hourly booking is confirmed:</p>
<div style="background:#ffffef;border:1px solid #e8dcc8;padding:16px 18px;margin:0 0 18px;"><p style="margin:0 0 4px;"><strong>Court 5</strong></p><p style="margin:0 0 4px;">Thursday, October 1, 2026</p><p style="margin:0 0 0;">1:00 PM – 3:00 PM (2h)</p></div>
<p style="margin:0 0 10px;">See you at Backyard Club!</p>
<p style="margin:0;color:#839179;font-size:13px;">Plans change? Cancel at least 24 hours before start for a full refund.</p>`,
  ),
};

test("a real \"You're in\" email parses into a confirmation named after the event", () => {
  assert.deepEqual(parseBackyardClubEmail(YOURE_IN_EMAIL), {
    kind: "confirmation",
    confirmation: {
      facilityName: "Backyard Club",
      date: "2026-09-23",
      startTime: "11:00",
      endTime: "14:00",
      courtLabel: "Courts 6, 7, 8, 9",
      format: "doubles",
      name: "Advanced Open Play 4.0+",
      playerNames: [],
    },
  });
});

test("a real \"Updated\" email parses into an update carrying the event's new courts", () => {
  assert.deepEqual(parseBackyardClubEmail(UPDATED_EMAIL), {
    kind: "update",
    update: {
      facilityName: "Backyard Club",
      date: "2026-09-23",
      startTime: "11:00",
      endTime: "14:00",
      courtLabel: "Courts 6, 7, 8, 9, 10, 11, 12",
      format: "doubles",
      name: "Advanced Open Play 4.0+",
      playerNames: [],
    },
  });
});

test("a real hourly booking confirmation parses with its court read from the top of the box, not the time line", () => {
  assert.deepEqual(parseBackyardClubEmail(HOURLY_BOOKING_EMAIL), {
    kind: "confirmation",
    confirmation: {
      facilityName: "Backyard Club",
      date: "2026-10-01",
      startTime: "13:00",
      endTime: "15:00",
      courtLabel: "Court 5",
      format: "doubles",
      name: "Court booking",
      playerNames: [],
    },
  });
});

test("a typographic apostrophe in the subject still reads as a \"You're in\" email", () => {
  const result = parseBackyardClubEmail({ ...YOURE_IN_EMAIL, subject: "You’re in — Advanced Open Play 4.0+, Sep 23 11:00 AM" });
  assert.equal(result.kind, "confirmation");
});

test("a subject no template uses is not_a_booking, not a guess", () => {
  assert.deepEqual(parseBackyardClubEmail({ subject: "Your weekly Backyard Club update", html: "<p>News</p>" }), {
    kind: "not_a_booking",
  });
});

test("a recognised subject whose body has no date is unparseable", () => {
  const html = YOURE_IN_EMAIL.html.replace("Wednesday, September 23, 2026", "");
  assert.deepEqual(parseBackyardClubEmail({ ...YOURE_IN_EMAIL, html }), { kind: "unparseable" });
});

test("the footer's opening hours are never mistaken for the booking's time", () => {
  // The time line removed: the only time range left in the body is the
  // footer's "8:00 AM – 10:00 PM", which must not stand in for it.
  const html = YOURE_IN_EMAIL.html.replace("11:00 AM – 2:00 PM", "");
  assert.deepEqual(parseBackyardClubEmail({ ...YOURE_IN_EMAIL, html }), { kind: "unparseable" });
});

test("parseBookingEmail routes by the source the message was found under", () => {
  assert.equal(parseBookingEmail({ source: "backyard_club", ...HOURLY_BOOKING_EMAIL }).kind, "confirmation");
  // CourtReserve's parser can't read this template: same email, other source.
  assert.equal(parseBookingEmail({ source: "courtreserve", ...HOURLY_BOOKING_EMAIL }).kind, "unparseable");
});

test("each source searches its own sender over the same window", () => {
  const now = new Date("2026-10-02T12:00:00Z");
  const backyard = buildBookingEmailSearchCriteria("backyard_club", now);
  const courtReserve = buildBookingEmailSearchCriteria("courtreserve", now);

  assert.equal(backyard.sender, BACKYARD_CLUB_SENDER);
  assert.equal(courtReserve.sender, COURTRESERVE_SENDER);
  assert.equal(backyard.after.getTime(), courtReserve.after.getTime());
});
