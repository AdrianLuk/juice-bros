/**
 * DORMANT — nothing imports this, and nothing should without a decision.
 *
 * The Partner Matrix was Match Mixer's proof surface until #477 removed it: it
 * named a failure it could not locate (a cell reading 2 said a pair repeated
 * but not which Rounds they were in), and its verdict was already in the
 * summary line. Coverage in that line and the repeat marks in the grid took
 * over. Read the Retired entry in `match-mixer/CONTEXT.md` before reviving any
 * of this.
 *
 * It is kept here rather than left to `git` because PR #478 was squash-merged
 * and both branches were deleted, so the commits holding it are not ancestors
 * of master and are eventually prunable. This file and
 * `match-mixer/docs/retired-partner-matrix.css.md` are the only copies in the
 * tree.
 *
 * Being under `src` it is typechecked, which is the point of keeping the
 * source rather than a snapshot: if `ScorerResult` changes shape, the build
 * says so here instead of leaving a future revival to discover it. It is never
 * bundled — nothing imports it, so it never enters a module graph.
 *
 * **Reviving it takes three steps, not one.** The component alone renders
 * unstyled; its CSS left `globals.css` in the same commit.
 *
 * 1. Render it after `<ScheduleGrid>` in `match-mixer.tsx`, passing
 *    `roster={draw.config.roster}` and `score={draw.score}`.
 * 2. Paste the blocks in `match-mixer/docs/retired-partner-matrix.css.md`
 *    into `src/app/globals.css` at the homes that file marks. It is Markdown
 *    rather than a `.css` file on purpose: as a stylesheet Tailwind compiled it
 *    into every page without anything importing it (#480).
 * 3. Re-add the two rules that were folded into neighbours rather than removed
 *    whole. That file lists them; both go in the `@media print` block.
 *
 * Reviving it as-is also reopens what #477 closed. If it comes back it should
 * come back answering "which rounds", which is the thing it could never do.
 */

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
