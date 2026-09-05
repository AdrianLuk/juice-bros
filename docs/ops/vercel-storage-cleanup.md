# Vercel Functions Storage cleanup

Vercel's **Usage → Functions Storage** number is the total size of serverless
function bundles across *every retained deployment* — production and preview
both. On the Hobby plan nothing ever expires automatically, and this project's
GitHub integration builds a fresh deployment on every push to every branch. At
this repo's commit pace that adds up fast (~750 deployments accumulated over
about 4 weeks, 43.81GB, before the cleanup below). None of it is one bloated
function — the dependency list is lean (Supabase, Resend, web-push, geo-tz) —
it's purely deployment count.

There's no code fix for this. It's a recurring housekeeping task until either
the deploy volume drops or the project moves to a paid plan (see
[Preventing it from coming back](#preventing-it-from-coming-back)).

## Before you do anything: find the live deployment

You're about to bulk-delete deployments. The one thing that must never get
deleted is whichever deployment your custom domains currently point to.
Confirm it first:

```
vercel alias ls --non-interactive
```

This prints every alias (`juicebrospickleball.com`, `www.`, the
`-git-master-` branch alias, etc.) next to the deployment URL it resolves to.
They should all point to the **same** URL — write it down. That's the one
deployment that survives everything below.

## One-time bulk cleanup

This runs from the repo root with the Vercel CLI logged in and linked
(`vercel whoami` / check `.vercel/project.json` exist).

**1. Collect every deployment.** `vercel ls` paginates 100 at a time via
`--next <cursor>`; keep following `pagination.next` until it's empty. Do this
with the CLI's `--json` output rather than the dashboard — the dashboard
Deployments tab doesn't give you a scriptable bulk-delete.

```
vercel ls --limit 100 --json --non-interactive > p1.json
# read p1.json's .pagination.next, then:
vercel ls --limit 100 --json --non-interactive --next <cursor> > p2.json
# repeat until pagination.next is empty
```

Pull the `.deployments[].url` out of each page into one flat list (a few
lines of Node against the JSON files works fine — see the inline scripts used
in the original cleanup session if you want a template, they're throwaway and
weren't committed anywhere).

**2. First pass — bulk remove with `--safe`.** `--safe` skips any deployment
that still has an active alias, so it can't take down the live site. Batch
the URLs (the CLI accepts many at once; keep batches around 20 to keep the
command line reasonable):

```
vercel remove <url1> <url2> ... <url20> --safe --yes --non-interactive
```

Repeat across all batches. This will remove most of the list — in the
original run it cleared 490 of 750 immediately.

**3. Second pass — the leftovers.** `--safe` is conservative: it also
protects deployments that still have a *branch* alias
(`<project>-git-<branch>-<team>.vercel.app`), even for branches that were
merged and deleted weeks ago. Re-list deployments the same way as step 1. For
whatever's left:

- Confirm exactly one deployment matches the URL you wrote down in the
  "before you do anything" step above.
- Remove everything else **without** `--safe` (these are just internal
  preview/branch-alias URLs, not production traffic):

```
vercel remove <url1> <url2> ... --yes --non-interactive
```

In the original run this cleared the remaining 259, leaving exactly the one
live production deployment.

**4. Verify.** List deployments again — should be down to 1. Re-run
`vercel alias ls` — same aliases, same target URL as before. Hit the live
domain and confirm it still returns 200.

Storage usage on the dashboard lags the actual state by a few hours; don't
expect the Usage graph to drop instantly.

## Preventing it from coming back

Nothing here is a permanent fix on the Hobby plan — pick based on how often
you're willing to think about this:

- **Do nothing, repeat this doc occasionally.** At the observed rate
  (~27 deployments/day) it'll take a few weeks to matter again. Cheapest
  option if you don't mind the manual chore.
- **Cut deployment volume at the source** with an [Ignored Build
  Step](https://vercel.com/docs/deployments/ignored-build-step) (Project
  Settings → Git → Ignored Build Step) — e.g. skip building branches/commits
  that only touch `docs/` or `docs/screenshots/`, which this repo generates a
  lot of per the PR screenshot convention.
- **Upgrade to Pro.** Unlocks **Deployment Retention Policy** (Project
  Settings → General), which auto-expires Preview deployments after N days —
  turns this whole doc into a one-time setup instead of a recurring chore.
