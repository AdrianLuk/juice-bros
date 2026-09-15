import type { SummaryRow } from "@/lib/on-deck/session/summary-format";

/**
 * The Session Summary, read (issue #469).
 *
 * Server-rendered with no client JS at all, which is a design decision rather
 * than an omission. Every distribution here is five rows, or eight, or four —
 * small enough that the honest form is a table with a bar in it, where the
 * value sits in its own column and can never be clipped by the bar it belongs
 * to. A hover tooltip would only reveal a number already printed beside the
 * mark, and a separate "table view" would duplicate what this already is.
 *
 * One mark colour throughout. The row label carries identity, so hue is free,
 * and spending it on a per-row ramp would double-encode bar length as colour —
 * the classic value-ramp-on-categories mistake. On the board that colour is
 * cool-white and deliberately *not* the brand orange: orange means LIVE on
 * every other On Deck screen, and a closed night has no live anything. See the
 * `.od-summary` block in globals.css.
 */

/** A headline number. Used where the number *is* the chart. */
export function StatTile({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="od-panel od-bo-tile">
      <dt className="od-stat-label">{label}</dt>
      <dd className="od-stat-value">{value}</dd>
      {note ? <p className="od-stat-note">{note}</p> : null}
    </div>
  );
}

/**
 * One distribution: a real `<table>` whose value column happens to carry a
 * bar. Screen readers get a table; everyone else gets a chart; neither is a
 * second rendering of the other.
 */
export function BarTable({
  caption,
  note,
  unit,
  rows,
}: {
  caption: string;
  note?: string;
  /** What one count means: "games", "players", "waits". */
  unit: string;
  rows: SummaryRow[];
}) {
  const empty = rows.every((row) => row.count === 0);

  return (
    <section className="od-panel od-bo-stage">
      <div className="flex flex-col gap-1.5">
        <h3 className="od-display text-lg text-arena-fg">{caption}</h3>
        {note ? <p className="od-bo-note">{note}</p> : null}
      </div>

      {empty ? (
        <p className="od-bo-note">Nothing to show. No {unit} were recorded.</p>
      ) : (
        <table className="od-bars">
          <caption className="sr-only">
            {caption}, by {unit}
          </caption>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label}>
                <th scope="row">{row.label}</th>
                <td>
                  <span className="od-bar-track" aria-hidden>
                    <span
                      className="od-bar"
                      style={{ width: `${row.percent}%` }}
                    />
                  </span>
                </td>
                <td className="od-bar-value">{row.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
