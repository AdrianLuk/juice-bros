/** A Team Event's `YYYY-MM-DD` date as the Organizer reads it: "Tue, Oct 13, 2026". */
export function eventDateLabel(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Today's date at the club, `YYYY-MM-DD`. The club Team Tally was built for is in Toronto. */
export function clubToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto" }).format(now);
}
