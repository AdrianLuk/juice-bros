import { courtBoard, placeMatchup } from "@/lib/ddd/courts";
import { dreambreakerSlots, seedTeams, slotStatuses, type SlotStatus } from "@/lib/ddd/dreambreakers";
import type { LinkEvent } from "@/lib/ddd/events";
import { GAME_LABEL, readLineup } from "@/lib/ddd/lineup";
import { doublesMatchups } from "@/lib/ddd/matchups";
import { pairOf } from "./matchups";

type Card = { court: number; status: SlotStatus; title: string; sides: [string, string] };

/**
 * Every court with what is on now and up next (#717), moving on as finals
 * land: the doubles once Round 2 is set, Round 1's Dreambreakers before.
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
      const lineups = [readLineup(a.players, a.lineup), readLineup(b.players, b.lineup)] as const;
      return placeMatchup(m, [lineups[0], lineups[1]], event.courtPlans, event.courts.length).map((place) => ({
        court: place.court,
        status: place.status,
        title: GAME_LABEL[place.game],
        sides: [pairOf(a, place.game), pairOf(b, place.game)] as [string, string],
      }));
    });
  } else {
    const slots = dreambreakerSlots(teamIds);
    const statuses = slotStatuses(slots, event.dreambreakers);
    cards = slots.map((slot, index) => ({
      court: slot.court,
      status: statuses[index],
      title: "Dreambreaker",
      sides: [teamOf(slot.teamA).name, teamOf(slot.teamB).name],
    }));
  }
  if (cards.length === 0 || event.courts.length === 0) return null;

  return (
    <section className="ddd-stack" aria-labelledby="ddd-court-cards">
      <h2 id="ddd-court-cards" className="ddd-on-green ddd-band-head">
        Courts
      </h2>
      <ol className="ddd-court-cards">
        {courtBoard(event.courts.length, cards).map((slot, index) => (
          <li key={event.courts[index]} className="ddd-slip ddd-court-card" aria-label={`Court ${event.courts[index]}`}>
            <p className="ddd-slip-head">Court {event.courts[index]}</p>
            <CardLine when="On now" card={slot.now} />
            <CardLine when="Up next" card={slot.next} />
          </li>
        ))}
      </ol>
    </section>
  );
}

function CardLine({ when, card }: { when: string; card: Card | null }) {
  return (
    <div className={when === "On now" ? "ddd-court-line ddd-court-now" : "ddd-court-line"}>
      <p className="ddd-court-when">{when}</p>
      {card ? (
        <>
          <p className="ddd-court-game">{card.title}</p>
          <p className="ddd-court-sides">
            {card.sides[0]} v {card.sides[1]}
          </p>
        </>
      ) : (
        <p className="ddd-note">Free</p>
      )}
    </div>
  );
}
