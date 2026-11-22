"use client";

import { useState, type FormEvent } from "react";

import {
  clearDreambreaker,
  saveDreambreaker,
  setRotation,
  setTieOrder,
  type LiveReader,
  type LiveWriter,
} from "@/lib/ddd/actions/live";
import {
  dreambreakerSlots,
  finalBetween,
  resultBetween,
  POINTS_PER_CHANGE,
  rotationOf,
  seedRuleLabel,
  seedTeams,
  slotStatuses,
  STATUS_LABEL,
  type DreambreakerSlot,
  type Seed,
  type SlotStatus,
} from "@/lib/ddd/dreambreakers";
import type { DreambreakerFinal, LinkEvent } from "@/lib/ddd/events";
import type { StoredTeam } from "@/lib/ddd/roster";
import { CourtCards } from "./court-cards";
import { Doubles } from "./matchups";
import { RosterTeams } from "./roster-teams";
import { useDddLive } from "./use-ddd-live";
import { useWrite } from "./use-write";

type Mode ="public" | "score" | "organizer";

/**
 * Round 1 on a live screen (#715): the Seeding as finals land, and the six
 * Dreambreakers with their courts, Rotations and scores. The Score Link and
 * an Organizer enter finals; an Organizer also clears them, reorders a
 * Rotation and makes the call on a tie nothing else breaks. `showRoster`
 * adds the 4 Teams under it, and `showDoubles` Round 2 and the Playoff
 * (#716) over it, for the links: one live read feeds the whole screen.
 */
export function RoundOne({
  reader,
  initial,
  showRoster = false,
  showDoubles = false,
}: {
  reader: LiveReader;
  initial: LinkEvent;
  showRoster?: boolean;
  showDoubles?: boolean;
}) {
  const { event, refresh } = useDddLive(reader, initial);
  const mode: Mode = reader.kind;
  const writer: LiveWriter | null =
    reader.kind === "score" ? { kind: "score", token: reader.token } : reader.kind === "organizer" ? { kind: "organizer" } : null;

  const teamIds = event.teams.map((team) => team.id);
  const slots = dreambreakerSlots(teamIds);
  const results = event.dreambreakers;
  const seeds = seedTeams(teamIds, results, event.tieOrder);
  const statuses = slotStatuses(slots, results);
  const teamOf = (id: string) => event.teams.find((team) => team.id === id)!;

  return (
    <div className="ddd-stack-lg">
      {slots.length === 0 ? (
        <p className="ddd-slip ddd-notice">Round 1 starts once the roster has its 4 Teams.</p>
      ) : (
        <>
          {showDoubles ? <CourtCards event={event} /> : null}
          {showDoubles ? <Doubles event={event} writer={writer} onSaved={refresh} /> : null}
          <SeedingSlip seeds={seeds} teamOf={teamOf} mode={mode} eventId={event.id} onSaved={refresh} />
          <section className="ddd-stack" aria-labelledby="ddd-dreambreakers">
            <h2 id="ddd-dreambreakers" className="ddd-on-green ddd-band-head">
              Dreambreakers
            </h2>
            <ol className="ddd-db-list">
              {slots.map((slot, index) => (
                <li key={`${slot.teamA}-${slot.teamB}`}>
                  <DreambreakerCard
                    slot={slot}
                    status={statuses[index]}
                    court={event.courts[slot.court] ?? String(slot.court + 1)}
                    a={teamOf(slot.teamA)}
                    b={teamOf(slot.teamB)}
                    final={finalBetween(results, slot.teamA, slot.teamB)}
                    editedBy={resultBetween(results, slot.teamA, slot.teamB)?.editedBy ?? null}
                    writer={writer}
                    onSaved={refresh}
                  />
                </li>
              ))}
            </ol>
          </section>
          {mode === "organizer" ? <RotationsSlip teams={event.teams} onSaved={refresh} /> : null}
        </>
      )}
      {showRoster ? <RosterTeams teams={event.teams} /> : null}
    </div>
  );
}

function signed(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

function SeedingSlip({
  seeds,
  teamOf,
  mode,
  eventId,
  onSaved,
}: {
  seeds: Seed[];
  teamOf: (id: string) => StoredTeam;
  mode: Mode;
  eventId: string;
  onSaved: () => void;
}) {
  const { pending, problem, run } = useWrite(onSaved);
  const open = seeds.some((seed) => seed.decidedBy === "unresolved");

  function putAhead(index: number) {
    const order = seeds.map((seed) => seed.teamId);
    [order[index - 1], order[index]] = [order[index], order[index - 1]];
    run(() => setTieOrder(eventId, order));
  }

  return (
    <section className="ddd-slip ddd-section" aria-labelledby="ddd-seeding">
      <h2 id="ddd-seeding" className="ddd-slip-head">
        Seeding
      </h2>
      {open && mode !== "organizer" ? <p className="ddd-problem">A tie nothing else breaks: an Organizer picks.</p> : null}
      <ol className="ddd-seeds">
        {seeds.map((seed, index) => {
          const team = teamOf(seed.teamId);
          const canCall = mode === "organizer" && (seed.decidedBy === "unresolved" || seed.decidedBy === "organizer");
          return (
            <li key={seed.teamId} className="ddd-seed" aria-label={`Seed ${seed.position}: ${team.name}`}>
              <span className="ddd-seed-n">{seed.position}</span>
              <div className="ddd-seed-body">
                <p className="ddd-seed-name">{team.name}</p>
                <p className="ddd-note">
                  {seed.wins}-{seed.played - seed.wins} · {signed(seed.pointDiff)} · {seed.points} pts
                </p>
                {seed.decidedBy ? (
                  <p className={seed.decidedBy === "unresolved" ? "ddd-problem ddd-seed-rule" : "ddd-seed-rule"}>
                    {seedRuleLabel(seed.decidedBy)}
                  </p>
                ) : null}
                {canCall ? (
                  <button type="button" className="ddd-quiet" disabled={pending} onClick={() => putAhead(index)}>
                    Put {team.name} ahead of {teamOf(seeds[index - 1].teamId).name}
                  </button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
      <p role="alert" className="ddd-problem empty:hidden">
        {problem}
      </p>
    </section>
  );
}

function Rotation({ team }: { team: StoredTeam }) {
  return (
    <div className="ddd-rotation">
      <p className="ddd-rotation-head">{team.name}</p>
      <ol>
        {rotationOf(team.players).map((player) => (
          <li key={player.id}>{player.name}</li>
        ))}
      </ol>
    </div>
  );
}

function DreambreakerCard({
  slot,
  status,
  court,
  a,
  b,
  final,
  editedBy,
  writer,
  onSaved,
}: {
  slot: DreambreakerSlot;
  status: SlotStatus;
  court: string;
  a: StoredTeam;
  b: StoredTeam;
  final: [number, number] | null;
  editedBy: DreambreakerFinal["editedBy"] | null;
  writer: LiveWriter | null;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const { pending, problem, run } = useWrite(onSaved);
  const showForm = writer !== null && (final === null || editing);

  function submit(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    const data = new FormData(formEvent.currentTarget);
    const scoreA = Number(data.get("scoreA"));
    const scoreB = Number(data.get("scoreB"));
    run(() => saveDreambreaker(writer!, slot.teamA, slot.teamB, scoreA, scoreB), () => setEditing(false));
  }

  return (
    <article className={`ddd-slip ddd-db-card ddd-db-${status}`} aria-label={`${a.name} v ${b.name}`}>
      <p className="ddd-db-status">
        <span>{STATUS_LABEL[status]}</span>
        <span className="ddd-db-court">Court {court}</span>
      </p>
      <div className="ddd-db-score">
        <p className={final && final[0] > final[1] ? "ddd-db-won" : undefined}>
          <span className="ddd-db-team">{a.name}</span>
          <span className="ddd-db-points">{final ? final[0] : ""}</span>
        </p>
        <p className={final && final[1] > final[0] ? "ddd-db-won" : undefined}>
          <span className="ddd-db-team">{b.name}</span>
          <span className="ddd-db-points">{final ? final[1] : ""}</span>
        </p>
      </div>
      {final ? (
        <p className="ddd-note">Last entered by {editedBy === "organizer" ? "an Organizer" : "the Score Link"}.</p>
      ) : (
        <details className="ddd-rotations">
          <summary>Rotation: one change every {POINTS_PER_CHANGE} points</summary>
          <div className="ddd-rotation-pair">
            <Rotation team={a} />
            <Rotation team={b} />
          </div>
        </details>
      )}

      {showForm ? (
        <form className="ddd-db-form" onSubmit={submit} aria-label={`Final score, ${a.name} v ${b.name}`}>
          <div className="ddd-field">
            <label htmlFor={`${slot.teamA}-${slot.teamB}-a`}>{a.name} points</label>
            <input
              id={`${slot.teamA}-${slot.teamB}-a`}
              name="scoreA"
              type="number"
              inputMode="numeric"
              min={0}
              max={21}
              required
              defaultValue={final?.[0]}
            />
          </div>
          <div className="ddd-field">
            <label htmlFor={`${slot.teamA}-${slot.teamB}-b`}>{b.name} points</label>
            <input
              id={`${slot.teamA}-${slot.teamB}-b`}
              name="scoreB"
              type="number"
              inputMode="numeric"
              min={0}
              max={21}
              required
              defaultValue={final?.[1]}
            />
          </div>
          <div className="ddd-actions">
            <button type="submit" className="ddd-btn" disabled={pending}>
              {pending ? "Saving…" : "Save final"}
            </button>
            {editing ? (
              <button type="button" className="ddd-quiet" onClick={() => setEditing(false)}>
                Cancel
              </button>
            ) : null}
          </div>
        </form>
      ) : null}

      {writer && final && !editing ? (
        <div className="ddd-actions">
          <button type="button" className="ddd-quiet" onClick={() => setEditing(true)}>
            Correct the score
          </button>
          {writer.kind === "organizer" ? (
            <button
              type="button"
              className="ddd-quiet"
              disabled={pending}
              onClick={() => run(() => clearDreambreaker(slot.teamA, slot.teamB))}
            >
              Clear it
            </button>
          ) : null}
        </div>
      ) : null}
      <p role="alert" className="ddd-problem empty:hidden">
        {problem}
      </p>
    </article>
  );
}

/** An Organizer's Rotations: move a player up a place. */
function RotationsSlip({ teams, onSaved }: { teams: StoredTeam[]; onSaved: () => void }) {
  const { pending, problem, run } = useWrite(onSaved);

  function moveUp(team: StoredTeam, index: number) {
    const order = rotationOf(team.players).map((player) => player.id);
    [order[index - 1], order[index]] = [order[index], order[index - 1]];
    run(() => setRotation(team.id, order));
  }

  return (
    <section className="ddd-slip ddd-section" aria-labelledby="ddd-rotations">
      <h2 id="ddd-rotations" className="ddd-slip-head">
        Rotations
      </h2>
      <p className="ddd-note">
        Players by DUPR, highest first, one change every {POINTS_PER_CHANGE} points. Guidance for the court, not a rule.
      </p>
      {teams.map((team) => (
        <div key={team.id} className="ddd-rotation-edit" aria-label={`${team.name} Rotation`} role="group">
          <p className="ddd-rotation-head">{team.name}</p>
          <ol>
            {rotationOf(team.players).map((player, index) => (
              <li key={player.id}>
                <span>{player.name}</span>
                {index > 0 ? (
                  <button
                    type="button"
                    className="ddd-quiet"
                    disabled={pending}
                    aria-label={`Move ${player.name} up`}
                    onClick={() => moveUp(team, index)}
                  >
                    Move up
                  </button>
                ) : null}
              </li>
            ))}
          </ol>
        </div>
      ))}
      <p role="alert" className="ddd-problem empty:hidden">
        {problem}
      </p>
    </section>
  );
}
