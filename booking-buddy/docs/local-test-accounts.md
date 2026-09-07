# Local test accounts

Four accounts on the **local** Supabase stack for clicking through Booking Buddy.
Password for all four: `pickleball123`

| Display name | Username | Email |
| --- | --- | --- |
| Amy Ace | `@amyace` | `amyace@example.com` |
| Ben Backhand | `@benbackhand` | `benbackhand@example.com` |
| Amy Ace | `@amyace2` | `amyace2@example.com` |
| Ben Backhand | `@benbackhand2` | `benbackhand2@example.com` |

Each email's local part is that account's Username, so you only have to remember one
string per account — and either form works in the search box, since search accepts an
exact Username or an exact email.

Sign in at `http://localhost:3000/booking-buddy/sign-in` with the password option
(not magic link — these addresses have no inbox).

## Re-creating them

`supabase db reset` wipes `auth.users` along with everything else. To put them back:

```
npm run seed:users
```

Idempotent, so it is safe to run when you are not sure. It creates the accounts through
the Auth admin API, which fires the same signup trigger a real user does — so each one
gets its profile and Username the normal way.

Usernames are assigned in the order above, which is the order the script creates them in.
That is what makes the `2` suffixes stable across a reset — `amyace` is taken by the time
the third account arrives — and therefore what keeps each email matching its Username.
Reorder `TEST_ACCOUNTS` and the numbering swaps.

## Who is already friends with whom

The script also seeds two accepted Connections, because the browser tests take them as
given:

| Pair | Why |
| --- | --- |
| `@amyace` ↔ `@benbackhand` | `friends.spec.ts` asserts an existing friendship shows on both sides |
| `@amyace` ↔ `@benbackhand2` | `friend-groups.spec.ts` can only group someone already connected |

`@amyace2` and `@benbackhand2` are left **strangers** on purpose — the two-sided request
journey needs a pair who aren't connected yet, and it puts them back that way when it
finishes.

Connections are seeded as the Users themselves, not with the service-role key: the
`connections` table is granted to `authenticated` and to nobody else, and widening a
grant in production to make a local fixture convenient would be the wrong trade. The
requester inserts, the addressee accepts — the same two steps the app takes, through the
same policies.

Without this the friendships die with every `supabase db reset`, and five browser tests
fail for reasons that have nothing to do with the code under test. That is how it got
added.

The seeded pairs carry **no** per-friend override: the script clears both sides' every
run, so a fresh `supabase db reset` + `npm run seed:users` always lands them in the same
state whatever a previous run set through the picker. (Friend Groups it leaves alone — a
`db reset` drops them with everything else, and each spec sweeps its own.)

That state is not "sees nothing". Since [ADR 0021](adr/0021-visibility-default-is-calendar.md)
the floor is `profiles.default_friend_visibility`, seeded to `calendar`, so a seeded pair
with no group and no override **sees each other's games and availability**. A spec whose
subject is what someone can't see has to say so explicitly — `pinFriendVisibility`
(`e2e/support/db-reset.ts`) writes the per-friend override that says it, cleared again
with `deleteVisibilityOverrides`. Leaning on the floor instead is what left
`slots.spec.ts`'s "no Visibility" test and `overlap.spec.ts`'s picker test red for four
releases (#446).

## Two Amys and two Bens

Deliberate, and worth understanding before it confuses you: the two pairs share display
names and differ only by Username. That is the exact ambiguity Usernames exist to resolve
(see [adr/0004-user-search-is-not-a-directory.md](adr/0004-user-search-is-not-a-directory.md)),
so it is a useful thing to have in local data — but it is also easy to send a friend
request to the wrong Amy and then wonder why the other one never received it. Check the
`@handle` in search results, not the name.

## Per-worker copies (for the parallel browser suite)

`seed:users` also creates `E2E_WORKER_COUNT` (default 4) copies of all four
accounts — `amyace-w0@example.com`, `benbackhand-w0@example.com`,
`amyace2-w0@example.com`, `benbackhand2-w0@example.com`, then `-w1`, `-w2`, `-w3`
— each wired into the same two friendships and left at the same visibility
bottom. Playwright's `accounts` fixture hands each worker its own set, so
`workers: 4` doesn't have two workers writing one account's rows.

Their Usernames are `amyacew0` / `benbackhandw0` / `amyace2w0` /
`benbackhand2w0` (and `…w1` …). The display names still collide two-and-two on
purpose, so the seed script forces the Username explicitly rather than letting
the signup trigger number the collisions. These are for the test suite — click
through with the four un-suffixed accounts above.

## These are local-only

The emails are unreachable, the password is in this file on purpose, and none of these
accounts exist on the hosted project. Nothing here is a secret. The seed script refuses
to run against anything other than `127.0.0.1` for the same reason.

To create an account on the **hosted** project instead, use the Supabase dashboard →
Authentication → Users → Add user, with *Auto Confirm User* ticked.
