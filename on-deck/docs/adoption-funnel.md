# Reading the adoption funnel

On Deck emits six custom Vercel Analytics events between a stranger opening the demo and
that stranger closing their first night (issue #524). There is no dashboard and no table
of our own — the read is done by hand in the Vercel Analytics console. This doc is the
"how".

See `docs/adr/0008-adoption-funnel-analytics.md` for why the events are shaped this way
and what they cannot tell you.

## The events

| Event | Where | Payload | Fires when |
|---|---|---|---|
| `od_demo_opened` | browser | none | somebody lands on `/on-deck/demo`. Once per page load |
| `od_demo_finished` | browser | none | they have watched three turnovers. Once per page load |
| `od_club_intent` | browser | `{ from: "demo" \| "landing-hero" \| "landing-close" }` | a "Create your Club" is clicked, **before** sign-in |
| `od_club_created` | server | none | an Organizer creates their Club. Once per account |
| `od_first_session_started` | server | none | that Club's first ever Session opens |
| `od_first_session_closed` | server | `{ auto: boolean }` | that Club's first ever Session closes |

## The read

Vercel project → **Analytics** → **Events**.

1. **Step volume.** Each event's count over the window is how many people reached that
   step. `od_demo_opened` is the denominator for everything above the account boundary;
   `od_club_created` is the denominator for everything below it.
2. **Did the demo convince anybody.** `od_club_intent` ÷ `od_demo_finished`, filtered to
   `from = demo`. This is the number the release was built to see. Low means the demo
   itself is not doing its job.
3. **Was signing up the problem.** `od_club_created` ÷ `od_club_intent`. Low means the
   demo convinced them and the sign-in page or the two-field form lost them. These two
   ratios need opposite fixes, which is the entire reason `od_club_intent` exists.
4. **Which call to action carries the intent.** Filter `od_club_intent` by `from`. A
   landing page out-pulling the demo means people are deciding before they try it.
5. **Did they ever run a night.** `od_first_session_started` ÷ `od_club_created`. A Club
   created and never started is somebody who got all the way through and then hit
   Saturday without using it.
6. **How the first night ended.** Filter `od_first_session_closed` by `auto`. `false` is
   an Organizer who ran the night to its end and tapped Close. `true` is one whose
   Session closed itself six hours after going quiet, which is a night they walked away
   from and worth reading as a failure, not a completion.

**Do not compute a conversion rate straight from `od_demo_opened` to `od_club_created`
and report it as a measurement.** Events are keyed to a visitor session and carry no id
to join on, so a visitor who tries the demo on Tuesday and signs up on Saturday is two
unrelated sessions. Everything above `od_club_intent` is one visit; everything from
`od_club_created` down is a different one for anybody who slept on it. Treat the
boundary as an estimate. The ADR has the full statement of this.

## Local verification

In `npm run dev` (no `VERCEL_URL`) the SDK logs `[Vercel Web Analytics] Track "<event>"`
instead of sending, for both the browser and the server halves. The whole funnel can be
walked in one sitting:

1. Open `/on-deck/demo` — `od_demo_opened`.
2. Tap "Court 1 done" three times — `od_demo_finished` on the third.
3. Click "Create your Club" at the bottom — `od_club_intent` with `from = demo`.
4. Sign in as an account with no Club and create one — `od_club_created`.
5. Start tonight's Session — `od_first_session_started`.
6. Close it from the Floor's wrap-up — `od_first_session_closed` with `auto = false`.

Each should appear exactly once. Repeating steps 4 to 6 on the same account should
produce nothing: they are all 0 → 1.
