"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { slotResponsesQuery } from "@/components/booking-buddy/slots";
import type { SlotResponses } from "@/lib/booking-buddy/actions/slots";
import {
  groupChatMessage,
  type GroupChatGame,
} from "@/lib/booking-buddy/group-chat-message";

/** Everything the message needs except the live tally and the link. */
export type GroupChatGameDetails = Omit<
  GroupChatGame,
  "yes" | "maybe" | "slotLinkUrl"
>;

/**
 * "Copy for group chat" (BB-4). On a phone it opens the share sheet, so the
 * message goes straight into WhatsApp; anywhere else it copies to the
 * clipboard. The tally reads the same Responses cache as the buttons above
 * it, so changing your own answer changes what gets copied.
 *
 * The message is also shown underneath: the organizer sees what the chat will
 * see, and can select it by hand if the clipboard is blocked.
 */
export function GroupChatCopy({
  slotId,
  initialResponses,
  game,
  slotLinkUrl,
}: {
  slotId: string;
  initialResponses: SlotResponses;
  game: GroupChatGameDetails;
  slotLinkUrl: string;
}) {
  const { data } = useQuery(slotResponsesQuery(slotId, initialResponses));
  const [copied, setCopied] = useState(false);

  const responses = data?.responses ?? initialResponses.responses;
  const message = groupChatMessage({
    ...game,
    yes: responses.filter((r) => r.answer === "yes").length,
    maybe: responses.filter((r) => r.answer === "maybe").length,
    slotLinkUrl,
  });

  async function send() {
    // Desktop browsers have a share sheet too, but nobody's group chat lives
    // there; a touch screen is the signal that WhatsApp is one tap away.
    if (
      typeof navigator.share === "function" &&
      window.matchMedia("(pointer: coarse)").matches
    ) {
      try {
        await navigator.share({ text: message });
        return;
      } catch (error) {
        // Closing the sheet is a choice, not a failure.
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
      }
    }
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be denied; the message is selectable below.
    }
  }

  return (
    <div className="flex flex-col items-start gap-3">
      {/* Ink, not orange: the page's one commit pin is the answer above. */}
      <Button
        type="button"
        onClick={send}
        aria-live="polite"
        className="bg-foreground text-(--card) hover:bg-foreground/90"
      >
        {copied ? "Copied. Paste it in your group chat." : "Copy for group chat"}
      </Button>
      <figure
        className="w-full rounded-md border border-dashed border-border bg-muted/40 p-3 font-mono text-xs whitespace-pre-line text-muted-foreground select-all"
        aria-label="Group chat message"
      >
        {message}
      </figure>
    </div>
  );
}
