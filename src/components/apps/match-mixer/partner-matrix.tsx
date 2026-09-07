import type {
  Roster,
  ScorerResult,
} from "@/components/apps/match-mixer/lib/engine/types";

/**
 * The proof. Each cell is a count of how many times that pair partnered, not a
 * filled/empty mark: a balanced schedule is sparse by design, so an empty cell
 * is expected and the failure signal is a cell above 1. The diagonal is inert
 * rather than missing, and gets a rule through it to say so.
 */
export function PartnerMatrix({
  roster,
  score,
}: {
  roster: Roster;
  score: ScorerResult;
}) {
  const n = roster.length;
  const numbers = Array.from({ length: n }, (_, i) => i);

  return (
    <section aria-labelledby="mm-matrix-heading" className="mt-12">
      <h2 id="mm-matrix-heading" className="mm-legend">
        Partner Matrix
      </h2>
      <p className="mm-note mt-2">
        How many times each pair played together.{" "}
        {score.repeatedPartnerPairs === 0
          ? "Every count is 1 or blank, so no pair repeats."
          : `${score.repeatedPartnerPairs} ${
              score.repeatedPartnerPairs === 1 ? "pair" : "pairs"
            } played together more than once, boxed below.`}
      </p>

      <div className="mm-scroll mt-5">
        <table className="mm-matrix">
          <caption className="sr-only">
            A grid of every pair of players, showing how many times they partnered.
            Players are numbered by their position in the roster.
          </caption>
          <thead>
            <tr>
              <th scope="col">
                <span className="sr-only">Player</span>
              </th>
              {numbers.map((j) => (
                <th key={j} scope="col">
                  <abbr title={roster[j].name}>{j + 1}</abbr>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {numbers.map((i) => (
              <tr key={i}>
                <th scope="row">
                  <span className="mm-matrix-index">{i + 1}</span>
                  <span className="mm-matrix-name">{roster[i].name}</span>
                </th>
                {numbers.map((j) => {
                  const count = score.partnerMatrix[i][j];
                  if (i === j) {
                    return (
                      <td key={j} className="mm-matrix-self">
                        <span className="sr-only">Same player</span>
                      </td>
                    );
                  }
                  return (
                    <td key={j} data-repeat={count > 1 ? "true" : undefined}>
                      {count > 0 ? count : ""}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
