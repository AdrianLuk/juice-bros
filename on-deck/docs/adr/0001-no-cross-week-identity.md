# No cross-week identity

On Deck identifies a Player by a first name plus last initial and a device token in `localStorage`, scoped entirely to one Session. No accounts, no phone numbers, no memory of anyone between weeks. Setup is two taps because that setup is the adoption gate for 50-60 casual drop-ins at a social, and every extra field costs real players. The consequence is that the app holds almost no personal data at rest: a closed Session keeps only its anonymous Session Summary, and the roster is discarded.

## Considered options

Collecting a **phone number** was the obvious alternative, and was in the design until its justification evaporated. Its only real job was cross-week memory (skip setup, remember your Skill Level). Once we decided regulars are happy to re-tap their level each week, nothing was left for it to do: the device token already keeps a Player in their thread when they reopen the page mid-Session, and a searchable name list already covers Volunteer lookup and telling two "Sarah K" apart. That left a weekly harvest of 60 strangers' phone numbers powering nothing, on a solo-maintained side project intended to be handed to other clubs.

**Full accounts** were rejected outright: a login wall on a walk-up social is adoption poison.

## When to revisit

Retention is the one genuinely valuable organizer stat that anonymous Session Summaries cannot produce - how many people came back, regulars versus new faces. If that question becomes something Vanessa actively wants answered, it is the trigger to reopen this, and the shape would be an explicit opt-in ("remember me next week") sold on that specific benefit, not a field collected on spec. The migration cost is small; do not pre-empt it.
