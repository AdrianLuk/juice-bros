import { fillFoursome, selectFoursome } from "./match-me.ts";
import { median } from "./types.ts";
import type {
  CourtSlot,
  Group,
  OnDeckFoursome,
  RosterPlayer,
  SessionConfig,
  SessionEvent,
  SessionState,
  SkillLevel,
} from "./types.ts";

/** How many Foursomes On Deck holds ahead of a Court freeing — "Up next" and
 * "After that" (issue #245). */
const ON_DECK_DEPTH = 2;

/** A Foursome is playable — walks straight onto a Court — only when full. */
function isComplete(foursome: OnDeckFoursome): boolean {
  return foursome.players.length === 4;
}

/**
 * Trim, collapse inner whitespace, capitalise the first letter, cap at 40
 * chars. `on_deck_join_session` already caps the self-registration path; the
 * cap here also covers a walk-up added straight through `on_deck_volunteer_append`
 * (issue #249), so no event can put an unbounded name on the board.
 */
function cleanFirstName(raw: string): string {
  const s = raw.trim().replace(/\s+/g, " ").slice(0, 40);
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

/** The first letter of the input, upper-cased; "" if there is none. */
function cleanLastInitial(raw: string): string {
  const letter = raw.trim().match(/[a-z]/i);
  return letter ? letter[0].toUpperCase() : "";
}

/**
 * "First name + last initial", plus a numeric suffix when a Player with the
 * same name and initial has already joined — "Sarah K.", then "Sarah K. 2".
 * The comparison is case- and whitespace-insensitive so "sarah" and "Sarah"
 * collide.
 */
function displayNameFor(
  firstName: string,
  lastInitial: string,
  roster: RosterPlayer[],
): string {
  const base = `${firstName} ${lastInitial}.`;
  const priorSameName = roster.filter(
    (p) =>
      p.firstName.toLowerCase() === firstName.toLowerCase() &&
      p.lastInitial.toLowerCase() === lastInitial.toLowerCase(),
  ).length;
  return priorSameName === 0 ? base : `${base} ${priorSameName + 1}`;
}

/** All Groups keyed by member device token, for the fold's inner helpers. */
function groupByMember(state: SessionState): Map<string, Group> {
  const byMember = new Map<string, Group>();
  for (const group of state.groups) {
    for (const id of group.memberIds) byMember.set(id, group);
  }
  return byMember;
}

/**
 * Re-order the Queue longest-wait-first, treating each Queue Together Group
 * (issue #250) as one unit sitting at the **median** Wait Time of its members —
 * so recruiting a longer-waiting member never jumps the Group up the line, and
 * grouping never costs a member their own accrued wait (each entry keeps its
 * real `waitSince`; only the order changes).
 *
 * `Array.prototype.sort` is stable, so units — and the four Players coming off
 * a Court together, who share a `waitSince` — keep first-appearance order on a
 * key tie.
 */
function sortQueue(state: SessionState): void {
  const q = state.queue;
  const groupOf = groupByMember(state);
  const orderIndex = new Map(q.map((e, i) => [e, i] as const));

  type Unit = { key: number; entries: SessionState["queue"] };
  const units: Unit[] = [];
  const seen = new Set<string>();

  for (const entry of q) {
    const group = groupOf.get(entry.playerId);
    if (!group) {
      units.push({ key: entry.waitSince, entries: [entry] });
      continue;
    }
    if (seen.has(group.id)) continue;
    seen.add(group.id);
    const members = q
      .filter((e) => groupOf.get(e.playerId) === group)
      .sort(
        (a, b) =>
          a.waitSince - b.waitSince ||
          orderIndex.get(a)! - orderIndex.get(b)!,
      );
    units.push({ key: median(members.map((e) => e.waitSince)), entries: members });
  }

  units.sort((a, b) => a.key - b.key);
  state.queue = units.flatMap((u) => u.entries);
}

/** A Player's declared Skill Level, defaulting to intermediate for a token the
 * roster somehow lacks. */
function skillLookup(state: SessionState): (id: string) => SkillLevel {
  const byId = new Map<string, SkillLevel>(
    state.roster.map((p) => [p.id, p.skillLevel]),
  );
  return (id) => byId.get(id) ?? "intermediate";
}

/**
 * Run Match Me (`match-me.ts`, ADR 0004) over a list of waiting Players, already
 * in wait order: the longest-waiting anchors, the other three are the best
 * Skill / Variety fit from a window of the next-longest-waiting. `null` when
 * fewer than four are given.
 */
function pickFoursome(state: SessionState, waiting: string[]): string[] | null {
  return selectFoursome({
    queue: waiting,
    skillOf: skillLookup(state),
    completedGames: state.completedGames,
    seed: state.config.seed,
  });
}

/**
 * Form one Foursome from `available` (waiting Player ids in wait order), or
 * `null` when a clean one can't be made:
 *
 *   - **front unit is a Queue Together Group** (issue #250): its members are
 *     fixed and `fillFoursome` (targeting the members' average Skill Level,
 *     Variety suppressed between members) fills the open seats. If the pool
 *     can't fill it: `firstSlot` holds out for a full four, a later slot
 *     commits it partial.
 *   - **front unit is a solo**: the ordinary windowed Match Me over the solos
 *     (Group members are never cherry-picked into someone else's Foursome).
 *     `firstSlot` needs four solos.
 *   - if the preferred path can't produce a Foursome, the other is tried, so a
 *     Court is never left empty while there is a seatable Group *or* four solos
 *     waiting.
 */
function formFoursome(
  state: SessionState,
  available: readonly string[],
  firstSlot: boolean,
): { players: string[]; groupId: string | null } | null {
  if (available.length === 0) return null;
  const groupOf = groupByMember(state);

  const fromGroup = (group: SessionState["groups"][number]) => {
    const members = available.filter((id) => group.memberIds.includes(id));
    if (members.length === 0) return null;
    const pool = available.filter((id) => !group.memberIds.includes(id));
    let players: string[] | null =
      members.length >= 4
        ? members.slice(0, 4)
        : fillFoursome({
            fixed: members,
            pool,
            skillOf: skillLookup(state),
            completedGames: state.completedGames,
            seed: state.config.seed,
          });
    if (!players) {
      if (firstSlot) return null;
      players = [...members];
    }
    return { players, groupId: group.id };
  };

  const fromSolos = () => {
    const solos = available.filter((id) => !groupOf.get(id));
    if (solos.length === 0) return null;
    if (firstSlot && solos.length < 4) return null;
    return { players: pickFoursome(state, solos) ?? [...solos], groupId: null };
  };

  const frontGroup = groupOf.get(available[0]);
  if (frontGroup) return fromGroup(frontGroup) ?? fromSolos();

  const solo = fromSolos();
  if (solo) return solo;
  // Not enough solos for a clean four — seat a waiting Group instead of
  // leaving the Court empty.
  const groupHead = available.find((id) => groupOf.get(id));
  return groupHead ? fromGroup(groupOf.get(groupHead)!) : null;
}

/**
 * Seat a Foursome onto one freed Court. The committed "Up next" Foursome
 * (issue #245) walks straight on when it is complete and still entirely in the
 * Queue; otherwise `formFoursome` picks from the Queue directly (Group-aware —
 * a Group is seated whole and bound to the Court, never split across it and the
 * Queue). Fewer than four to seat either way: the Court stays empty until there
 * are.
 *
 * Only ever fills the Court named by a `COURT_FINISHED` event, one at a time,
 * so several finishing together fold sequentially with the Foursome removed
 * from the Queue before the next Court is filled.
 */
function seatCourt(state: SessionState, court: CourtSlot, at: number): void {
  // After Last Call (issue #255) no further Foursome is assigned — the Court
  // stays empty and the four who just came off wait out the night.
  if (state.lastCallAt !== null) return;

  const queuedIds = new Set(state.queue.map((e) => e.playerId));

  let foursome: string[] | null = null;
  let seatedGroupId: string | null = null;
  const lead = state.onDeck[0];
  if (lead && isComplete(lead) && lead.players.every((id) => queuedIds.has(id))) {
    foursome = lead.players;
    seatedGroupId = lead.groupId;
    state.onDeck.shift();
  } else {
    const formed = formFoursome(
      state,
      state.queue.map((e) => e.playerId),
      true,
    );
    if (formed) {
      foursome = formed.players;
      seatedGroupId = formed.groupId;
    }
  }
  if (!foursome) return;

  // A Group's Foursome walking on binds the Group to this Court (issue #250);
  // `COURT_FINISHED` for the Court is what dissolves the Group.
  if (seatedGroupId) {
    const group = state.groups.find((g) => g.id === seatedGroupId);
    if (group) group.courtNumber = court.number;
  }

  const seated = new Set(foursome);
  state.queue = state.queue.filter((e) => !seated.has(e.playerId));
  // Each seated Player's wait has now ended — bank it for the Session Summary's
  // wait-time distribution and longest wait (issue #255).
  for (const playerId of foursome) {
    const since = state.waitStartByPlayer[playerId];
    if (since !== undefined) {
      state.completedWaits.push(Math.max(0, at - since));
    }
  }
  court.foursome = foursome;
  court.since = at;
}

/**
 * Bring On Deck back up to `ON_DECK_DEPTH` committed Foursomes after any event
 * that changed the Queue (issue #245). The rules, in order:
 *
 *   1. **Never reshuffle.** An already-committed Foursome keeps its members;
 *      this function only drops Players who have left the Queue, tops up
 *      incomplete Foursomes, and forms new ones.
 *   2. **Top up in wait order.** An incomplete Foursome (short Queue when it
 *      formed) gains the next-longest-waiting unspoken-for Players until full.
 *   3. **Form the next Foursome.** From the Players not already spoken for by On
 *      Deck or a Court: if the longest-waiting unspoken-for unit is a Queue
 *      Together Group (issue #250), its members are fixed and Match Me only
 *      fills the open seats (`fillFoursome`, targeting the Group's average
 *      Skill Level, Variety suppressed between members); otherwise the ordinary
 *      windowed Match Me runs. The *first* Foursome only forms once it can be
 *      completed to four — a lone waiter, or an unfillable Group, is "in the
 *      Queue", not "on deck". A *second* Foursome may form partial.
 */
function refreshOnDeck(state: SessionState, at: number): void {
  // After Last Call (issue #255) no new On Deck Foursome forms. `LAST_CALL`
  // itself clears any already committed — nobody else walks on.
  if (state.lastCallAt !== null) return;

  const queuedIds = new Set(state.queue.map((e) => e.playerId));
  const groupOf = groupByMember(state);

  // 1. A committed Player who is no longer waiting (walked onto a Court) drops
  //    out; a Foursome emptied that way is gone. A `groupId` whose Group has
  //    since dissolved is cleared so nothing downstream chases it.
  for (const foursome of state.onDeck) {
    foursome.players = foursome.players.filter((id) => queuedIds.has(id));
    if (foursome.groupId && !state.groups.some((g) => g.id === foursome.groupId)) {
      foursome.groupId = null;
    }
  }
  state.onDeck = state.onDeck.filter((f) => f.players.length > 0);

  const spokenFor = new Set(state.onDeck.flatMap((f) => f.players));
  let available = state.queue
    .map((e) => e.playerId)
    .filter((id) => !spokenFor.has(id));

  const drop = (ids: readonly string[]): void => {
    const gone = new Set(ids);
    available = available.filter((id) => !gone.has(id));
  };

  // A Group is placed as a whole (rule 3), so it never tops up someone else's
  // Foursome and its members are never cherry-picked into a Match Me pick. The
  // exception: a Foursome that is itself this Group's tops up with its own
  // members first, then solos.
  const topUpEligible = (foursome: OnDeckFoursome, id: string): boolean => {
    const g = groupOf.get(id);
    return !g || g.id === foursome.groupId;
  };

  // 2. Top up incomplete Foursomes in wait order, "Up next" before "After
  //    that" — existing members (Group or not) are left in place.
  for (const foursome of state.onDeck) {
    while (foursome.players.length < 4) {
      const next = available.findIndex((id) => topUpEligible(foursome, id));
      if (next < 0) break;
      foursome.players.push(available.splice(next, 1)[0]);
    }
  }

  // 3. Form new Foursomes until On Deck is `ON_DECK_DEPTH` deep or nobody is
  //    left to commit — `formFoursome` handles the Group-vs-solo choice and is
  //    shared with `seatCourt` so a Court and On Deck agree.
  while (state.onDeck.length < ON_DECK_DEPTH && available.length > 0) {
    const formed = formFoursome(state, available, state.onDeck.length === 0);
    if (!formed) break;
    drop(formed.players);
    state.onDeck.push({
      players: formed.players,
      committedAt: at,
      groupId: formed.groupId,
    });
  }
}

/**
 * The pure fold. Takes the whole event array — not one event at a time —
 * because that is what makes replay (and therefore undo) trivial: undo is
 * dropping the last event and re-folding, never a compensating action.
 *
 * `reduceSession` must NEVER call `Date.now()`. It reads `at` off each event.
 * Whether anything has *elapsed* since is a question for the render layer,
 * which has a ticking clock. The moment this function reads the wall clock,
 * `reduceSession(config, events)` stops being reproducible and the
 * undo-parity guarantee goes with it.
 *
 * Match Me's selection tie-breaks derive from `config.seed`, never
 * `Math.random()`, for the same reason (see `match-me.ts`).
 *
 * A `COURT_FINISHED` on an already-empty Court carries no Game — it just seats
 * the next Foursome (the floor screen's "Send next four" on session start).
 * "Games played" for the Session Summary is therefore a count of
 * `COURT_FINISHED` events whose Court *was* occupied, derived in a later fold,
 * not a raw event count.
 */
export function reduceSession(
  config: SessionConfig,
  events: SessionEvent[],
): SessionState {
  const courts: CourtSlot[] = Array.from(
    { length: Math.max(0, config.courtCount) },
    (_, i) => ({ number: i + 1, foursome: [], since: null }),
  );

  const state: SessionState = {
    config,
    groupCap: config.groupCap,
    groups: [],
    startedAt: null,
    startedBy: null,
    lastCallAt: null,
    status: "pending",
    roster: [],
    queue: [],
    courts,
    onDeck: [],
    paused: [],
    waitStartByPlayer: {},
    completedGames: [],
    completedWaits: [],
  };

  /** Remember when a Player's current wait began — the no-show door reads this
   * to preserve the equity of a Player who was already off the Queue. */
  const beginWait = (playerId: string, at: number): void => {
    state.waitStartByPlayer[playerId] = at;
  };

  /** Wait Time (ms) a Player has accrued by `at`, floored at zero. Falls back
   * to zero for a Player the fold never saw queue. */
  const accruedWait = (playerId: string, at: number): number => {
    const since = state.waitStartByPlayer[playerId] ?? at;
    return Math.max(0, at - since);
  };

  /**
   * Put a rostered Player into the Queue at `at`: a no-op if they are already
   * waiting, on a Court, or paused. Shared by the `PLAYER_QUEUED` tap and a
   * walk-up's `queueOnJoin` (issue #249) so both enter the Queue identically —
   * same wait anchor, same On Deck top-up.
   */
  const enqueuePlayer = (playerId: string, at: number): void => {
    if (state.queue.some((e) => e.playerId === playerId)) return;
    if (state.courts.some((c) => c.foursome.includes(playerId))) return;
    if (state.paused.some((p) => p.playerId === playerId)) return;

    state.queue.push({ playerId, waitSince: at });
    beginWait(playerId, at);
    sortQueue(state);
    refreshOnDeck(state, at);
  };

  for (const event of events) {
    switch (event.type) {
      case "SESSION_STARTED": {
        // The log should only ever carry one, but a replayed duplicate must
        // not move the start time or reassign the Operator.
        if (state.status !== "pending") break;
        state.startedAt = event.at;
        state.startedBy = event.operator;
        state.status = "open";
        break;
      }

      case "PLAYER_JOINED": {
        // A Player can only join a running Session; a stray join before the
        // Session opens is ignored rather than folded.
        if (state.status !== "open") break;
        // Reopening the Club QR on the same device replays the same token —
        // that must not add a second roster entry (and must not overwrite the
        // first: the earliest join wins).
        if (state.roster.some((p) => p.id === event.token)) break;

        const firstName = cleanFirstName(event.firstName);
        const lastInitial = cleanLastInitial(event.lastInitial);
        state.roster.push({
          id: event.token,
          firstName,
          lastInitial,
          skillLevel: event.skillLevel,
          displayName: displayNameFor(firstName, lastInitial, state.roster),
          joinedAt: event.at,
        });

        // A walk-up added by an Operator (issue #249) is there to play now —
        // straight into the Queue, no separate PLAYER_QUEUED tap.
        if (event.queueOnJoin) enqueuePlayer(event.token, event.at);
        break;
      }

      case "PLAYER_SKILL_SET": {
        if (state.status !== "open") break;
        const target = state.roster.find((p) => p.id === event.token);
        if (!target) break;
        // Just the declared level changes — an in-progress Game, the Queue
        // order, and any committed On Deck Foursome are all untouched; the
        // corrected level is read by the next Match Me selection.
        target.skillLevel = event.skillLevel;
        break;
      }

      case "PLAYER_QUEUED": {
        if (state.status !== "open") break;
        // Unknown token — a stray queue tap is a no-op. The rest of the guards
        // (already waiting / on a Court / paused) and the wait-anchor + On Deck
        // top-up (issue #245) live in `enqueuePlayer`, shared with a walk-up's
        // `queueOnJoin` (issue #249). A queued Player waits for a
        // `COURT_FINISHED` — the fold never pulls them onto an empty Court —
        // so they reliably "join the Queue and see their position" (#243).
        if (!state.roster.some((p) => p.id === event.token)) break;
        enqueuePlayer(event.token, event.at);
        break;
      }

      case "COURT_FINISHED": {
        if (state.status !== "open") break;
        const court = state.courts.find((c) => c.number === event.court);
        if (!court) break;

        // A Queue Together Group bound to this Court dissolves the moment its
        // Game ends (issue #250) — its ex-members re-queue below as ordinary
        // solos.
        state.groups = state.groups.filter((g) => g.courtNumber !== event.court);

        // A real Game (an occupied Court) ending is the Variety history Match
        // Me scores against; an empty Court tapped done carries no Game.
        if (court.foursome.length > 0) {
          state.completedGames.push({
            players: [...court.foursome],
            court: court.number,
          });
        }

        // The four coming off re-queue automatically, Wait Time measured from
        // this event (CONTEXT: "or from the moment they last came off a Court,
        // whichever is later") — unless Last Call has been tapped (issue #255),
        // in which case their night is over: they leave the Court and are not
        // re-queued, so no surface shows them waiting for a Court that will
        // never be assigned.
        if (state.lastCallAt === null) {
          for (const playerId of court.foursome) {
            state.queue.push({ playerId, waitSince: event.at });
            beginWait(playerId, event.at);
          }
        }
        court.foursome = [];
        court.since = null;
        sortQueue(state);

        // ...then the "Up next" On Deck Foursome (or Match Me, if it is not
        // ready) walks onto the freed Court, and On Deck refills behind it.
        seatCourt(state, court, event.at);
        refreshOnDeck(state, event.at);
        break;
      }

      case "PLAYER_PAUSED": {
        if (state.status !== "open") break;
        const id = event.token;
        if (!state.roster.some((p) => p.id === id)) break;
        // Already paused, or present in neither the Queue nor a Court — nothing
        // to step out of. A replayed event is a no-op.
        if (state.paused.some((p) => p.playerId === id)) break;
        const onCourt = state.courts.some((c) => c.foursome.includes(id));
        const queued = state.queue.some((e) => e.playerId === id);
        if (!onCourt && !queued) break;
        // A Player can only remove *themselves* from the Queue — never walk off
        // a Court mid-Game. An Operator's "set aside" still can (someone who
        // clearly went home). This also settles the race where a Player taps
        // "leave" from the On Deck view just as their Foursome is seated.
        if (event.reason === "left" && onCourt) break;

        state.paused.push({
          playerId: id,
          accruedWaitMs: accruedWait(id, event.at),
          pausedAt: event.at,
          reason: event.reason,
        });

        // Leave the Queue and any Court. A Court left a player short stays that
        // way — the no-show door (FOURSOME_MEMBER_SWAPPED) is the one that pulls
        // a replacement in.
        state.queue = state.queue.filter((e) => e.playerId !== id);
        for (const c of state.courts) {
          if (c.foursome.includes(id)) {
            c.foursome = c.foursome.filter((x) => x !== id);
          }
        }

        // A paused Player leaves any Queue Together Group they were in (issue
        // #250). A still-waiting Group under two members dissolves — its lone
        // member re-sorts as a solo. A Group already on a Court keeps going
        // until its `COURT_FINISHED`.
        for (const g of state.groups) {
          g.memberIds = g.memberIds.filter((x) => x !== id);
        }
        state.groups = state.groups.filter(
          (g) => g.courtNumber !== null || g.memberIds.length >= 2,
        );
        sortQueue(state);
        refreshOnDeck(state, event.at);
        break;
      }

      case "PLAYER_REQUEUED": {
        if (state.status !== "open") break;
        const id = event.token;
        const paused = state.paused.find((p) => p.playerId === id);
        if (!paused) break;

        state.paused = state.paused.filter((p) => p.playerId !== id);
        // Resume from the equity they had — back-date `waitSince` so their
        // Queue position reflects the wait they had already banked.
        const waitSince = event.at - paused.accruedWaitMs;
        state.queue.push({ playerId: id, waitSince });
        beginWait(id, waitSince);
        sortQueue(state);
        refreshOnDeck(state, event.at);
        break;
      }

      case "FOURSOME_MEMBER_SWAPPED": {
        if (state.status !== "open") break;
        const court = state.courts.find((c) => c.number === event.court);
        if (!court) break;
        if (!court.foursome.includes(event.out)) break;
        if (event.in === event.out) break;
        // The replacement must be a waiting Player, free to be seated.
        if (!state.queue.some((e) => e.playerId === event.in)) break;
        if (state.courts.some((c) => c.foursome.includes(event.in))) break;
        if (state.paused.some((p) => p.playerId === event.in)) break;

        state.paused.push({
          playerId: event.out,
          accruedWaitMs: accruedWait(event.out, event.at),
          pausedAt: event.at,
          reason: "no-show",
        });

        // Swap the names on the Court; the Game's clock is untouched.
        court.foursome = court.foursome.map((x) =>
          x === event.out ? event.in : x,
        );
        state.queue = state.queue.filter((e) => e.playerId !== event.in);
        refreshOnDeck(state, event.at);
        break;
      }

      case "GROUP_FORMED": {
        if (state.status !== "open") break;
        const ids = [...new Set(event.memberTokens)];
        // 2 to the current live cap; every member rostered, currently waiting
        // in the Queue, and in no other Group. Any miss makes this a no-op —
        // `floor-ops` is what turns the same checks into a message for the
        // Operator or Player.
        if (ids.length < 2 || ids.length > state.groupCap) break;
        if (!ids.every((id) => state.roster.some((p) => p.id === id))) break;
        if (!ids.every((id) => state.queue.some((e) => e.playerId === id))) break;
        const grouped = new Set(state.groups.flatMap((g) => g.memberIds));
        if (ids.some((id) => grouped.has(id))) break;

        state.groups.push({
          id: event.groupId,
          memberIds: ids,
          formedAt: event.at,
          courtNumber: null,
        });
        // Forming a Group — Volunteer- or Player-formed (issue #251), the fold
        // reads them identically — is a deliberate act, not a passive Queue
        // change, so unlike a join it *does* rebuild On Deck from scratch, so
        // the Group's Foursome can take its rightful "Up next" slot (issue
        // #250). ADR 0007's "never reshuffle" still holds for the passive events
        // (a plain queue tap, a member leaving a Group); this is a deliberate
        // override, and the rebuild is deterministic (pure fold) so undo
        // re-forms it exactly.
        state.onDeck = [];
        sortQueue(state);
        refreshOnDeck(state, event.at);
        break;
      }

      case "GROUP_MEMBER_REMOVED": {
        if (state.status !== "open") break;
        const group = state.groups.find((g) => g.id === event.groupId);
        // Only a still-waiting Group (a Group already on a Court rides its Game
        // out); the token must be a current member.
        if (!group || group.courtNumber !== null) break;
        if (!group.memberIds.includes(event.token)) break;

        group.memberIds = group.memberIds.filter((id) => id !== event.token);
        // Under two members it is no longer a Group — its lone member re-sorts
        // as a solo. The leaver stays in the Queue either way.
        state.groups = state.groups.filter(
          (g) => g.courtNumber !== null || g.memberIds.length >= 2,
        );
        // A member leaving is a passive Player-triggered change, exactly like a
        // paused member dropping out of their Group — so it re-sorts and tops
        // up (`refreshOnDeck` clears a stale `groupId` off a committed
        // Foursome) but does NOT rebuild On Deck from scratch. ADR 0007: an
        // already-announced Foursome stays put. This matches the `PLAYER_PAUSED`
        // path below, not the deliberate `GROUP_FORMED` rebuild above.
        sortQueue(state);
        refreshOnDeck(state, event.at);
        break;
      }

      case "GROUP_DISSOLVED": {
        if (state.status !== "open") break;
        const group = state.groups.find((g) => g.id === event.groupId);
        // A Group already on a Court dissolves on its `COURT_FINISHED`, not here.
        if (!group || group.courtNumber !== null) break;
        state.groups = state.groups.filter((g) => g.id !== event.groupId);
        // Same as a member leaving: re-sort + top up, no full rebuild (ADR 0007).
        sortQueue(state);
        refreshOnDeck(state, event.at);
        break;
      }

      case "GROUP_CAP_CHANGED": {
        if (state.status !== "open") break;
        // The Club default is the ceiling and 2 the floor (a Volunteer only
        // adjusts within that). Existing larger Groups are untouched — only
        // later `GROUP_FORMED` events feel the new cap.
        if (!Number.isInteger(event.cap)) break;
        if (event.cap < 2 || event.cap > state.config.groupCap) break;
        state.groupCap = event.cap;
        break;
      }

      case "LAST_CALL": {
        if (state.status !== "open") break;
        // First Last Call wins — a replayed event must not move the time.
        if (state.lastCallAt !== null) break;
        state.lastCallAt = event.at;
        // No new Foursome forms and nobody already On Deck walks on — clear it
        // so "queued Players are told they're done". Games on Courts are
        // untouched and finish normally.
        state.onDeck = [];
        break;
      }

      case "SESSION_CLOSED": {
        if (state.status !== "open") break;
        state.status = "closed";
        break;
      }
    }
  }

  return state;
}
