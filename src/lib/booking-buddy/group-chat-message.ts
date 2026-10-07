/**
 * "Copy for group chat" (BB-4): a game as a block of plain text an organizer
 * pastes into WhatsApp. The crew already talks there, so the message meets
 * the chat instead of trying to replace it.
 *
 * Plain text only: no markdown (WhatsApp would bold a `*facility*`), no blank
 * lines, one fact per line, the Slot Link last so the chat turns it into a
 * tappable preview.
 *
 * Pure and relative-import-only, so `node --test` can load it.
 */

export type GroupChatGame = {
  /** `Slot.when`, e.g. "Tue, Oct 20, 2026 · 8:00 PM – 10:00 PM". */
  when: string;
  /** `Slot.facilityLabel`: the booked court's facility, else the Intended Org. */
  facilityLabel: string | null;
  /** One entry per attached court; `null` where no court number was noted. */
  courtLabels: (string | null)[];
  /** `Slot.repeatsLabel`, e.g. "Every Tuesday". */
  repeatsLabel: string | null;
  yes: number;
  maybe: number;
  slotLinkUrl: string;
};

export function groupChatMessage(game: GroupChatGame): string {
  const lines = [`Pickleball ${chatWhen(game.when)}`];
  if (game.repeatsLabel) {
    lines.push(game.repeatsLabel);
  }
  if (game.facilityLabel) {
    lines.push(`${game.facilityLabel}, ${courtsLine(game.courtLabels)}`);
  }
  lines.push(tallyLine(game.yes, game.maybe));
  lines.push(`In or out? ${game.slotLinkUrl}`);
  return lines.join("\n");
}

/** "Tue, Oct 20, 2026 · 8:00 PM – 10:00 PM" → "Tue, Oct 20, 8:00 PM – 10:00 PM". */
function chatWhen(when: string): string {
  return when.replace(/,\s*\d{4}/, "").replace(" · ", ", ");
}

function courtsLine(courtLabels: (string | null)[]): string {
  if (courtLabels.length === 0) {
    return "court not booked yet";
  }
  // One unlabelled court makes the numbers meaningless; say how many instead.
  if (courtLabels.some((label) => label === null)) {
    return courtLabels.length === 1
      ? "1 court"
      : `${courtLabels.length} courts`;
  }
  const labels = courtLabels as string[];
  return labels.length === 1
    ? `court ${labels[0]}`
    : `courts ${labels.slice(0, -1).join(", ")} and ${labels.at(-1)}`;
}

function tallyLine(yes: number, maybe: number): string {
  if (yes === 0 && maybe === 0) {
    return "Nobody's in yet";
  }
  return [yes > 0 && `${yes} in`, maybe > 0 && `${maybe} maybe`]
    .filter(Boolean)
    .join(", ");
}
