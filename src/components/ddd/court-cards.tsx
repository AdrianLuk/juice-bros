import { courtBoard, placeMatchup } from "@/lib/ddd/courts";
import { dreambreakerSlots, seedTeams, slotStatuses, STATUS_LABEL, type SlotStatus } from "@/lib/ddd/dreambreakers";
import type { LinkEvent } from "@/lib/ddd/events";
import { GAME_LABEL, readLineup, type Lineup } from "@/lib/ddd/lineup";
import { doublesMatchups, forecast } from "@/lib/ddd/matchups";
import { pairPlayers } from "@/lib/ddd/spreads";
import { PairNames, Underdog } from "./pair";

/** One side of a doubles Game on a court card: its players and, once the forecast is set, its Goal. */
type Side = { names: string[]; goal: string | null; lower: boolean };

/** A doubles Game carries both Pairs with their Goals; a Dreambreaker just "Team v Team". */
type Card = { court: number; status: SlotStatus; title: string; pairs: [Side, Side] | null; line: string | null };

/**
 * Every court with what is on now and up next (#717), moving on as finals
 * land: the doubles once Round 2 is set, Round 1's Dreambreakers before.
 * A doubles Game shows each Pair's Goal, so a player checks it at a glance
 * before walking on.
 */
export function CourtCards({ event }: { event: LinkEvent }) {
  const teamIds = event.teams.map((team) => team.id);
  const teamOf = (id: string) => event.teams.find((team) => team.id === id)!;
  const seeds = seedTeams(teamIds, event.dreambreakers, event.tieOrder);
  const matchups = doublesMatchups(seeds, { spreads: event.spreads, games: event.games, calls: event.calls });

  let cards: Card[];
  if (matchups.length > 0) {
    cards = matchups.flatMap((m) => {
      const [a, b] = [teamOf(m.a), teamOf(m.b)];
      const lineups = [readLineup(a.players, a.lineup), readLineup(b.players, b.lineup)] as [Lineup | null, Lineup | null];
      return placeMatchup(m, lineups, event.courtPlans, event.courts.length).map((place) => {
        const spread = m.games.find((game) => game.game === place.game)?.spread ?? null;
        const side = (team: typeof a, letter: "a" | "b"): Side => {
          const lower = spread?.lower === letter;
          return { names: pairPlayers(team, place.game), goal: spread ? forecast(lower, spread.points).target : null, lower };
        };
        return {
          court: place.court,
          status: place.status,
          title: GAME_LABEL[place.game],
          pairs: [side(a, "a"), side(b, "b")] as [Side, Side],
          line: null,
        };
      });
    });
  } else {
    const slots = dreambreakerSlots(teamIds);
    const statuses = slotStatuses(slots, event.dreambreakers);
    cards = slots.map((slot, index) => ({
      court: slot.court,
      status: statuses[index],
      title: "Dreambreaker",
      pairs: null,
      line: `${teamOf(slot.teamA).name} v ${teamOf(slot.teamB).name}`,
    }));
  }
  if (cards.length === 0 || event.courts.length === 0) return null;

  return (
    <section className="ddd-stack" aria-labelledby="ddd-court-cards">
      <h2 id="ddd-court-cards" className="ddd-on-green ddd-band-head">
        Courts
      </h2>
      {/* With Goals a doubles card needs the full width of a phone, so the strip goes one court per row there. */}
      <ol className={matchups.length > 0 ? "ddd-court-cards ddd-court-cards-doubles" : "ddd-court-cards"}>
        {courtBoard(event.courts.length, cards).map((slot, index) => (
          <li key={event.courts[index]} className="ddd-slip ddd-court-card" aria-label={`Court ${event.courts[index]}`}>
            <p className="ddd-slip-head">Court {event.courts[index]}</p>
            <CardLine status="now" card={slot.now} />
            <CardLine status="next" card={slot.next} />
          </li>
        ))}
      </ol>
    </section>
  );
}

function CardLine({ status, card }: { status: "now" | "next"; card: Card | null }) {
  return (
    <div className={`ddd-court-line ddd-court-${status}`}>
      <p className="ddd-court-when">{STATUS_LABEL[status]}</p>
      {card ? (
        <>
          <p className="ddd-court-game">{card.title}</p>
          {card.pairs ? (
            <ul className="ddd-court-pairs">
              {card.pairs.map((side, index) => (
                <li key={index} className="ddd-court-pair">
                  <PairNames names={side.names} />
                  {side.goal ? (
                    <span className="ddd-court-goal">
                      <span>
                        Goal: <b>{side.goal}</b>
                      </span>
                      {side.lower ? <Underdog /> : null}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="ddd-court-sides">{card.line}</p>
          )}
        </>
      ) : (
        <p className="ddd-note">Free</p>
      )}
    </div>
  );
}
