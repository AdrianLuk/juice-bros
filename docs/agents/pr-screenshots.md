# PR Screenshots

Any PR that changes a UI surface embeds screenshots in its body, at desktop and
mobile widths.

## Where the files live

Commit them to `docs/screenshots/<issue>-<name>.png`, in their own commit,
separate from the code commits. They reach `master` through the merge like any
other file, so they stay reachable forever regardless of what happens to the
branch.

## How to reference them

Embed raw GitHub URLs pinned to a **commit SHA**:

```
https://raw.githubusercontent.com/AdrianLuk/juice-bros/<sha>/docs/screenshots/<file>.png
```

Use the SHA of the screenshots commit itself: `git rev-parse HEAD` straight
after committing them. That means composing the PR body after that commit
exists. If a later commit on the branch changes the screenshots, re-point the
body at the new SHA.

**Never pin to a branch name.** The URL dies the moment the branch is deleted,
which breaks the images in the merged PR and makes merged branches effectively
undeletable. This is not hypothetical: on 2026-09-17 a cleanup found 39 such
URLs across 9 merged PRs, and every one had to be rewritten before the branches
could be removed.

**Never pin to `master` either.** Those URLs survive branch deletion but are
mutable. Re-shoot a screenshot at the same path later and old PRs silently start
showing the new image, misrepresenting what that PR actually shipped. A SHA is
both permanent and immutable.

## Capturing them

Use a throwaway Playwright spec under `e2e/` that reuses the suite's own sign-in
and seeding helpers, shoot at desktop and mobile widths, then delete the spec
before committing.

Two things to watch for:

- **Scroll reveals.** `Reveal` / `RevealGroup` only show a section once an
  `IntersectionObserver` fires as it enters the viewport, so a bare
  `fullPage: true` capture leaves everything below the fold at `opacity: 0`.
  Either call `page.emulateMedia({ reducedMotion: "reduce" })` before `goto`
  (the component's own escape hatch, since content never hides under reduced
  motion), or scroll the page end to end and back to the top before capturing.
  Lazy images need the scroll either way.

- **Targeting one section.** When an outer `<section>` wraps the whole page,
  `getByRole("heading", { name }).locator("xpath=ancestor::section[1]")` picks
  the inner one. A `.locator("section").filter({ has: heading })` matches both.

`node_modules/sharp` is available for downscaling; full-page captures compress
several times smaller without becoming unreadable.
