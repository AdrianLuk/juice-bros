# Visibility: independent grants, not a single ordered scale

`visibility_level` shipped in Phase 4 (#6) as a total order — `none < slots < calendar` — on the reasoning that `calendar` is simply "everything `slots` is, plus the owner's Availability Windows too", so a single ordered scale can represent every real level, and "most permissive of several Friend Groups" reduces to picking the highest rung.

#31 asked for a level that shows a friend the owner's open time *without* their Slots — the inverse slice of what `slots` already shows without open time. That value isn't more or less permissive than `slots`; it's a different thing `slots` doesn't include and doesn't get included by. A total order has no room for two values that are each partly, but not wholly, more open than the other.

**Decision**: Model Visibility as two independent boolean grants — "sees Slots" and "sees open time" — and keep `visibility_level` as the four combinations of those: `none`, `slots`, `open_time`, `calendar`. `calendar` is the top (both grants), `none` is the bottom (neither), and `slots`/`open_time` sit side by side, incomparable. "A friend in several Groups gets the most permissive of them" becomes "a friend in several Groups gets the union of what any of them grants" — the same rule in spirit (adding a Group can only expand what's visible, never retract it), computed as an OR over each grant rather than a max over a single scale.

## Consequences

- `resolveVisibility` (`src/lib/booking-buddy/visibility.ts`) no longer does `Math.max`-by-array-index; it reduces each Group's level to its two grants, ORs them, and maps the result back to a level. An explicit per-friend override still wins outright and skips this reduction entirely — that part of ADR 0003's precedence chain is unchanged.
- The SQL mirror of "at least calendar" (`has_calendar_visibility`, gating `availability_windows`'s read policy) was checking `= 'calendar'` because `calendar` used to be the unique top rung. It's renamed to `has_open_time_visibility` and now checks "grants open_time" (`in ('open_time', 'calendar')`) — the lattice equivalent of the same question. `has_slot_visibility` was already written as "at least slots" (`in ('slots', 'calendar')`) rather than an equality check, since `slots` was never the top of the old order either, so it needed no change.
- The visibility picker gains a fourth option; existing `none`/`slots`/`calendar` choices, their labels, and every row that was already set to one of them are unaffected — this only adds a value nothing could reach before, not a migration of existing data.

## Amended by [ADR 0021](0021-visibility-default-is-calendar.md)

The lattice is unchanged, but its floor is no longer fixed at `none`. A friend in no
Friend Group and with no override now sees whatever the owner's per-User
`default_friend_visibility` grants — `calendar` by default. "`none` is the bottom" still
describes the lattice; it is no longer the default a Connection lands on.
