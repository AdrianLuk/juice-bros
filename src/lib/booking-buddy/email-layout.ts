/**
 * The one branded layout every Booking Buddy email renders through (issue
 * #572). Callers hand it structured content, never HTML; it escapes every text
 * and URL it is given and returns the whole document.
 *
 * The app's cork-board world translated to what email clients actually
 * honour: a flat cork ground (the texture can't travel, no background images),
 * a kraft card, an Anton notice heading, Libre Franklin body, ink text, and
 * the single commit action as the one orange element (DESIGN.md's One Commit
 * Pin Rule). Table layout, inline styles, no images or SVG, so it reads the
 * same with images off and with the web fonts blocked.
 *
 * Pure string assembly with relative imports only, so it runs under
 * `node --test` (no path aliases there).
 */

import { escapeHtml, escapeHtmlText } from "./escape-html.ts";

/**
 * DESIGN.md's oklch tokens, converted to hex once for email clients that
 * don't parse oklch. Change a token there, change it here.
 */
const EMAIL_COLORS = {
  cork: "#b99575",
  corkEdge: "#694b39",
  kraft: "#f8efde",
  tape: "#f5ebcc",
  tapeInk: "#544437",
  ink: "#251a13",
  mutedInk: "#5f4f43",
  rule: "#c9bca9",
  commit: "#f26522",
  onCommit: "#ffffff",
} as const;

const NOTICE_FONT = "Anton,Impact,'Arial Narrow Bold','Arial Narrow',sans-serif";
const BODY_FONT = "'Libre Franklin',Helvetica,Arial,sans-serif";
const FONTS_HREF =
  "https://fonts.googleapis.com/css2?family=Anton&family=Libre+Franklin:wght@400;600;700&display=swap";

export type EmailAction = { label: string; url: string };

export type EmailContent = {
  /**
   * The notice line: what happened, or what the reader has to do. Shown in
   * the case it is written in, never uppercased, because it can carry a
   * person's name and handle or a facility's name.
   */
  heading: string;
  /** Set large under the heading, e.g. the game's date and time. */
  emphasis?: string;
  paragraphs: string[];
  /** The one orange button. */
  primaryAction: EmailAction;
  /** Quieter, ink-outlined actions beside it (e.g. Decline). */
  secondaryActions?: EmailAction[];
  /** A small line under the actions. */
  smallPrint?: string;
};

/** "commit" is the one orange button; "ink" is the quieter outlined one. */
type ButtonVariant = "commit" | "ink";

function button(action: EmailAction, variant: ButtonVariant): string {
  const { commit, onCommit, ink, kraft } = EMAIL_COLORS;
  const style =
    variant === "commit"
      ? `background-color:${commit};border:2px solid ${commit};color:${onCommit};`
      : `background-color:${kraft};border:2px solid ${ink};color:${ink};`;
  return `<a href="${escapeHtml(action.url)}" style="display:inline-block;${style}font-family:${NOTICE_FONT};font-size:16px;font-weight:400;line-height:20px;letter-spacing:1.5px;text-transform:uppercase;text-decoration:none;padding:13px 22px;border-radius:4px;margin:0 8px 8px 0;">${escapeHtmlText(action.label)}</a>`;
}

/** The full HTML document for one Booking Buddy email. */
export function renderEmailLayout(content: EmailContent): string {
  const { cork, corkEdge, kraft, tape, tapeInk, ink, mutedInk, rule } = EMAIL_COLORS;

  const emphasis = content.emphasis
    ? `<p style="margin:14px 0 0;color:${ink};font-family:${BODY_FONT};font-size:20px;line-height:28px;font-weight:700;">${escapeHtmlText(content.emphasis)}</p>`
    : "";

  const paragraphs = content.paragraphs
    .map(
      (text) =>
        `<p style="margin:14px 0 0;color:${ink};font-family:${BODY_FONT};font-size:16px;line-height:24px;">${escapeHtmlText(text)}</p>`,
    )
    .join("\n              ");

  const actions = [
    button(content.primaryAction, "commit"),
    ...(content.secondaryActions ?? []).map((action) => button(action, "ink")),
  ].join("");

  const smallPrint = content.smallPrint
    ? `<p style="margin:8px 0 0;color:${mutedInk};font-family:${BODY_FONT};font-size:13px;line-height:20px;">${escapeHtmlText(content.smallPrint)}</p>`
    : "";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light">
    <meta name="supported-color-schemes" content="light">
    <link href="${escapeHtml(FONTS_HREF)}" rel="stylesheet">
    <title>${escapeHtmlText(content.heading)}</title>
    <style>:root { color-scheme: light; supported-color-schemes: light; }</style>
  </head>
  <body style="margin:0;padding:0;background-color:${cork};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${cork}" style="background-color:${cork};">
      <tr>
        <td align="center" style="padding:28px 12px 40px;">
          <!--[if mso]><table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
            <tr>
              <td style="padding:0 0 12px;">
                <span style="display:inline-block;background-color:${tape};color:${tapeInk};font-family:${NOTICE_FONT};font-size:15px;line-height:20px;letter-spacing:1.5px;text-transform:uppercase;padding:5px 14px;">Booking Buddy</span>
              </td>
            </tr>
            <tr>
              <td bgcolor="${kraft}" style="background-color:${kraft};border:1px solid ${corkEdge};border-radius:4px;padding:28px 24px 24px;">
              <h1 style="margin:0;color:${ink};font-family:${NOTICE_FONT};font-size:32px;line-height:36px;font-weight:400;letter-spacing:0.5px;">${escapeHtmlText(content.heading)}</h1>
              ${emphasis}
              ${paragraphs}
              <div style="margin:24px 0 0;padding:20px 0 0;border-top:1px solid ${rule};">${actions}</div>
              ${smallPrint}
              </td>
            </tr>
          </table>
          <!--[if mso]></td></tr></table><![endif]-->
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
