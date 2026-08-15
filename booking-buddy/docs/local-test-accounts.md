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

## Two Amys and two Bens

Deliberate, and worth understanding before it confuses you: the two pairs share display
names and differ only by Username. That is the exact ambiguity Usernames exist to resolve
(see [adr/0004-user-search-is-not-a-directory.md](adr/0004-user-search-is-not-a-directory.md)),
so it is a useful thing to have in local data — but it is also easy to send a friend
request to the wrong Amy and then wonder why the other one never received it. Check the
`@handle` in search results, not the name.

## These are local-only

The emails are unreachable, the password is in this file on purpose, and none of these
accounts exist on the hosted project. Nothing here is a secret. The seed script refuses
to run against anything other than `127.0.0.1` for the same reason.

To create an account on the **hosted** project instead, use the Supabase dashboard →
Authentication → Users → Add user, with *Auto Confirm User* ticked.
