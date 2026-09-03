/**
 * Illustrative, static renders of real Booking Buddy surfaces for the landing
 * page — a Slot's responses, friends' shared availability, a week at a glance.
 * They reuse the app's own `bb-card` / list / block styling so a visitor sees
 * roughly what they'll get, but they are hand-authored examples, not live data.
 * Every state shown here is one the app actually produces.
 */

const HATCH =
  "repeating-linear-gradient(135deg, color-mix(in oklch, var(--muted-foreground) 22%, transparent) 0, color-mix(in oklch, var(--muted-foreground) 22%, transparent) 1px, transparent 1px, transparent 7px)";

const pill =
  "inline-flex h-7 items-center rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] font-medium";

/** A bare proposal — a time floated before any court is booked. */
export function SlotProposalPreview() {
  const responses: [string, string][] = [
    ["You", "Yes"],
    ["Adrian", "Yes"],
    ["Daven", "Yes"],
    ["Ben", "Maybe"],
  ];

  return (
    <div className="bb-card w-full max-w-sm p-5 text-left text-card-foreground ring-1 ring-black/5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-bb-body text-base font-semibold tracking-tight">
            Thursday, 8:00 PM
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Who&apos;s around?
          </p>
        </div>
        <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
          Proposal
        </span>
      </div>

      <p className="mt-4 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">3 in so far.</span> No
        court yet. Grab one and attach it to lock the game in.
      </p>

      <ul className="mt-3 divide-y divide-border/60 overflow-hidden rounded-lg bg-muted/30 text-sm">
        {responses.map(([name, answer]) => (
          <li
            key={name}
            className="flex items-center justify-between gap-4 px-4 py-2.5"
          >
            <span>{name}</span>
            <span className="text-muted-foreground">{answer}</span>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex gap-2" aria-hidden>
        <span className={`${pill} bg-primary text-primary-foreground`}>
          Yes
        </span>
        <span className={`${pill} border border-border bg-background`}>
          Maybe
        </span>
        <span className={`${pill} border border-border bg-background`}>No</span>
      </div>
    </div>
  );
}

/** A confirmed Slot filling up — the poll → capacity flow. */
export function SlotResponsesPreview() {
  const responses: [string, string][] = [
    ["You", "Yes"],
    ["Adrian", "Yes"],
    ["Ben", "Yes"],
    ["Daven", "Maybe"],
  ];

  return (
    <div className="bb-card w-full max-w-sm p-5 text-left text-card-foreground ring-1 ring-black/5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-bb-body text-base font-semibold tracking-tight">
            Saturday, 9:00 AM
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Pickleplex Downsview &middot; doubles
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
          Court booked
        </span>
      </div>

      <p className="mt-4 text-sm">
        <span className="font-medium">3 of 4 spots taken</span>
        <span className="text-muted-foreground"> &middot; 1 court</span>
      </p>

      <ul className="mt-3 divide-y divide-border/60 overflow-hidden rounded-lg bg-muted/30 text-sm">
        {responses.map(([name, answer]) => (
          <li
            key={name}
            className="flex items-center justify-between gap-4 px-4 py-2.5"
          >
            <span>{name}</span>
            <span className="text-muted-foreground">{answer}</span>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex gap-2" aria-hidden>
        <span className={`${pill} bg-primary text-primary-foreground`}>
          Yes
        </span>
        <span className={`${pill} border border-border bg-background`}>
          Maybe
        </span>
        <span className={`${pill} border border-border bg-background`}>No</span>
      </div>
    </div>
  );
}

/** Friends' shared looking-to-play / busy time for a few days. */
export function AvailabilityPreview() {
  const days = ["Thu", "Fri", "Sat", "Sun", "Mon"];
  const rows: { name: string; cells: (null | "looking" | "busy")[] }[] = [
    { name: "Adrian", cells: [null, null, "looking", "looking", null] },
    { name: "Ben", cells: ["busy", "busy", null, null, "looking"] },
    { name: "Daven", cells: [null, "looking", "looking", null, null] },
  ];

  return (
    <div className="bb-card w-full max-w-sm p-5 text-left text-card-foreground ring-1 ring-black/5">
      <p className="font-bb-body text-base font-semibold tracking-tight">
        This weekend
      </p>
      <div className="mt-4 grid grid-cols-[4.5rem_repeat(5,1fr)] gap-1.5 text-[11px]">
        <span />
        {days.map((day) => (
          <span
            key={day}
            className="text-center font-medium text-muted-foreground"
          >
            {day}
          </span>
        ))}

        {rows.map((row) => (
          <div key={row.name} className="contents">
            <span className="flex items-center text-xs text-muted-foreground">
              {row.name}
            </span>
            {row.cells.map((cell, i) => (
              <div
                key={days[i]}
                className={
                  "flex h-7 items-center justify-center rounded-sm border text-[10px] font-bold text-foreground/70 " +
                  (cell === "looking"
                    ? "border-dashed border-accent-foreground/25 bg-accent/25"
                    : cell === "busy"
                      ? "border-border bg-muted"
                      : "border-transparent")
                }
                style={cell === "busy" ? { backgroundImage: HATCH } : undefined}
              >
                {cell === "looking" ? "Looking" : cell === "busy" ? "Busy" : ""}
              </div>
            ))}
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        Adrian and Daven are both free Saturday.
      </p>
    </div>
  );
}

/** The overlap of a few friends' availability — the days a whole group can make. */
export function OverlapPreview() {
  const picked = ["You", "Adrian", "Daven", "Ben"];
  // A day split by someone's midday busy stretch shows a window either side,
  // each proposable on its own — mirrors the real result list.
  const days: { day: string; windows: string[] }[] = [
    { day: "Sat", windows: ["9:00 AM – 12:00 PM", "2:00 PM – 6:00 PM"] },
    { day: "Sun", windows: ["Any time"] },
    { day: "Wed", windows: ["6:00 PM – 10:00 PM"] },
  ];

  return (
    <div className="bb-card w-full max-w-sm p-5 text-left text-card-foreground ring-1 ring-black/5">
      <p className="font-bb-body text-base font-semibold tracking-tight">
        When you&apos;re all free
      </p>

      <div className="mt-3 flex flex-wrap gap-1.5" aria-hidden>
        {picked.map((name) => (
          <span
            key={name}
            className="inline-flex h-6 items-center rounded-full bg-accent/25 px-2.5 text-[11px] font-medium text-foreground/70"
          >
            {name}
          </span>
        ))}
      </div>

      <ul className="mt-4 flex flex-col gap-3 text-sm">
        {days.map((entry) => (
          <li key={entry.day} className="rounded-lg bg-muted/30 px-3.5 py-2.5">
            <p className="font-medium">{entry.day}</p>
            <ul className="mt-1 flex flex-col gap-1">
              {entry.windows.map((window) => (
                <li
                  key={window}
                  className="flex items-center justify-between gap-3"
                >
                  <span className="text-xs text-muted-foreground">
                    {window}
                  </span>
                  <span className="shrink-0 text-xs font-semibold text-primary">
                    Propose a game
                  </span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>

      <p className="mt-4 text-xs text-muted-foreground">
        Days nobody&apos;s booked and nobody&apos;s marked busy.
      </p>
    </div>
  );
}

/** A week at a glance: a booked game, a proposal without a court yet, busy time. */
export function WeekPreview() {
  const rows: {
    day: string;
    time: string;
    title: string;
    meta: string;
    kind: "game" | "proposed" | "busy";
  }[] = [
    {
      day: "Tue",
      time: "",
      title: "Busy",
      meta: "Out of town",
      kind: "busy",
    },
    {
      day: "Thu",
      time: "8:00 PM",
      title: "Proposed",
      meta: "Waiting on a court",
      kind: "proposed",
    },
    {
      day: "Sat",
      time: "9:00 AM",
      title: "Game at Pickleplex",
      meta: "Court booked · 3 of 4 in",
      kind: "game",
    },
  ];

  return (
    <div className="bb-card w-full max-w-sm p-5 text-left text-card-foreground ring-1 ring-black/5">
      <p className="font-bb-body text-base font-semibold tracking-tight">
        Your week
      </p>
      <ul className="mt-4 flex flex-col gap-2.5">
        {rows.map((row) => (
          <li key={row.day} className="flex items-start gap-3">
            <div className="w-11 shrink-0 pt-0.5 text-right">
              <p className="text-xs font-semibold text-muted-foreground">
                {row.day}
              </p>
              {row.time && (
                <p className="text-[11px] text-muted-foreground">{row.time}</p>
              )}
            </div>
            <span
              className={
                "mt-1 h-full w-1 shrink-0 self-stretch rounded-full " +
                (row.kind === "game"
                  ? "bg-primary"
                  : row.kind === "proposed"
                    ? "bg-primary/40"
                    : "bg-muted-foreground/40")
              }
              aria-hidden
            />
            <div
              className={
                "min-w-0 flex-1 rounded-md px-3 py-2 " +
                (row.kind === "game"
                  ? "bg-primary/10"
                  : row.kind === "proposed"
                    ? "border border-dashed border-primary/40"
                    : "bg-muted/50")
              }
              style={
                row.kind === "busy" ? { backgroundImage: HATCH } : undefined
              }
            >
              <p className="text-sm font-medium">{row.title}</p>
              <p className="text-xs text-muted-foreground">{row.meta}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
