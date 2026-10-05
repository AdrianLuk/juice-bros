# PR Screenshots

Any PR that changes a UI surface embeds before/after screenshots in its body, at
desktop and mobile widths.

## Where the files live

Not in the repo. Each PR's images go in a standalone, parentless commit pushed to
a hidden `refs/screenshots/pr-<N>` ref, and the PR body links to them as
`https://github.com/AdrianLuk/juice-bros/blob/<commit>/<file>?raw=true`. The
script and the rules are in the "Screenshots in pull requests" section of
`CLAUDE.md`.

`docs/screenshots/` used to hold them and reached `master` through every merge,
which grew the repo to about 250 MB. It was deleted on 2026-10-05 and is now in
`.gitignore`; the `no-screenshots` GitHub Actions check fails any PR or push that
adds a file under it.

Save as WebP (quality about 80) or JPEG. `node_modules/sharp` converts and
downscales:

```sh
node -e "require('sharp')('in.png').webp({quality:80}).toFile('out.webp')"
```

## Capturing them

Use a throwaway Playwright spec under `e2e/` that reuses the suite's own sign-in
and seeding helpers, shoot at desktop and mobile widths, then delete the spec.
Write the captures to a folder outside the repo (or one that's ignored), never
to `docs/screenshots/`.

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
