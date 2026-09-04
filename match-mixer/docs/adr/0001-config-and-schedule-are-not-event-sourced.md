# Config and Schedule are not event-sourced

Pickle Point Pal folds an append-only event log through a pure reducer, On Deck has `reduceSession`, and the Round Robin roadmap called for "event log from day one, even in RR-1". Match Mixer deliberately does not follow that pattern: the Config is plain mutable state and the Schedule is a pure function of it, because everything on screen is derivable from the Roster, court count, Round count and Seed, and there is nothing a log would record. Taken literally an event log here would have to record keystrokes in a textarea, and "undo" would undo one character.

The line is drawn at commitment: **events exist only above a Schedule that has been committed.** Nothing is committed in the generator-and-printout milestone, so the event list is empty. Lock, score entry and mid-session arrivals are the first things that cannot be expressed as Config, and that is where the log begins.

## Consequences

This is only safe because generation is deterministic. `generate` takes an explicit Seed that lives in the Config, so a Schedule can always be rebuilt from what produced it and never needs to be stored. The first event, when there is one, is the Schedule this milestone already produces; the reducer folds forward from there rather than replacing anything underneath it.

Do not "fix" this into an event log for consistency with the sibling apps. If a future feature genuinely needs history over Roster edits, that is a reason to reopen this deliberately — not a defect to be tidied up.
