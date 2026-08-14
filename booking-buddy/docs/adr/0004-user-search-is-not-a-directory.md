# User search is a narrow lookup, not a directory

Profiles are readable only by their owner and accepted Connections. That creates a chicken-and-egg problem for friend discovery: you must find someone before you can ask to connect, but you cannot read their profile until they have accepted.

The obvious fix — letting any signed-in User read any profile — would make Booking Buddy a browsable directory of everyone's names. That contradicts the premise in [CONTEXT.md](../../CONTEXT.md) that visibility is earned through a mutual Connection, and it is exactly the exposure the app exists to avoid for people who only know each other casually from pickleball.

**Decision**: keep the restrictive profile policy, and route discovery through a single `SECURITY DEFINER` function, `search_users(query)`. It can read what the caller cannot, and is constrained so that it supports finding someone you already know while refusing to enumerate the membership:

- a minimum query length, so one character cannot list everyone
- email matches must be **exact** — searching a domain finds nobody
- the email is never returned, only used as a lookup key
- results are capped, so a common name cannot be paged through
- the caller never appears in their own results

**Why**: discoverability and privacy genuinely conflict here, and the narrow function lets us have the useful half of each. Widening it later is a one-line policy change if it proves too strict; retracting a directory that people have come to expect is not.

## Consequences

Every future feature needing to look a User up must go through `search_users` rather than querying `profiles` directly — a direct query will return nothing for anyone the caller is not already connected to, which looks like a bug but is the policy working.

The function is `SECURITY DEFINER`, so it bypasses RLS by design. Any change to it is a change to the privacy boundary and deserves the same scrutiny as changing a policy: `search_path` is pinned, and every constraint above is load-bearing rather than incidental.
