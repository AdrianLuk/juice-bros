import type { GuestPoll } from "@/lib/mic-drop/polls";
import { cn } from "@/lib/utils";

/**
 * The coral field that opens a Poll's screens: its name, whether it's live,
 * and how many phones are in. While the connection is down it says
 * "Reconnecting…" instead, so stale counts never pass as live (issue #670).
 */
export function PollField({
  poll,
  reconnecting,
  liveLabel,
  finalLabel,
}: {
  poll: GuestPoll;
  reconnecting: boolean;
  liveLabel: string;
  finalLabel: string;
}) {
  return (
    <header className={cn("md-field", !poll.open && "is-final")}>
      <div className="md-col">
        <h1>{poll.name}</h1>
        <div className="md-field-meta">
          <span role="status" className={cn("md-live", reconnecting && "is-stale")}>
            {reconnecting ? "Reconnecting…" : poll.open ? liveLabel : finalLabel}
          </span>
          <span>
            {poll.phonesIn} {poll.phonesIn === 1 ? "phone" : "phones"} in
          </span>
        </div>
      </div>
    </header>
  );
}
