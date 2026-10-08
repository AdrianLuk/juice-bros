# A Team Event is tables, not an event log

On Deck stores a Session as an append-only event log folded through a reducer and purged at close (On Deck ADR 0001), and it now has a codec for it (#611). Team Tally deliberately does not: a Team Event is plain rows (Team Event, Team, Player slot, Matchup, Game), each Game holds its two scores and who last edited it, and standings, Seeding and Final places are computed from those rows on read, never stored.

The data is small and corrected in place. A night is about fifty numbers, every correction is "that score is wrong, here is the right one", and the results page keeps them for good (no purge). An event log would buy a full edit history and Undo, at the cost of a fold, a codec and a purge policy for data that is meant to be read as records. "Who entered this?" is answered by the Game's last editor.

## Consequences

Nothing derived is stored, so a corrected opening score changes the opening standings immediately. Seeding is the exception that holds still: once Flights are placed they stay placed, and a later correction shows the Organizer that the standings moved rather than reshuffling Flights already playing.

If disputes ever need a history, add an audit table of score changes beside the Game rows. That is an addition, not a reason to turn the Team Event into an event log for consistency with On Deck.
