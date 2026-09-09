# Retired: the Partner Matrix stylesheet

The Partner Matrix's CSS, exactly as it left `src/app/globals.css` when
[#477](https://github.com/AdrianLuk/juice-bros/issues/477) removed the component. Its
component source is kept dormant beside the live code at
`src/components/apps/match-mixer/partner-matrix.tsx`, which carries the full revival
checklist and the reasoning for the removal.

**Why this is a Markdown file and not a `.css` one.** It was a `.css` file for one commit
([#479](https://github.com/AdrianLuk/juice-bros/pull/479)) and Tailwind v4 compiled it into the
shared stylesheet on sight — nothing had to import it, and about 5KB of dead rules shipped to
every page on the site until [#480](https://github.com/AdrianLuk/juice-bros/issues/480). A file
that is not a stylesheet cannot be picked up by a stylesheet pipeline, which is the only
version of "dormant" that does not depend on a build tool continuing to agree.

Match Mixer has one stylesheet. Reviving these means pasting them into `globals.css` at the
homes marked below, not importing anything from here.

## Screen

Belongs inside `@layer components`.

```css
/* ---- The Partner Matrix ----------------------------------------------- */

  .mm-matrix {
    border-collapse: collapse;
    font-family: var(--font-mono), ui-monospace, monospace;
    font-variant-numeric: tabular-nums;
    font-size: 0.75rem;
  }
  .mm-matrix thead th,
  .mm-matrix td {
    width: 1.75rem;
    min-width: 1.75rem;
    height: 1.75rem;
    padding: 0;
    text-align: center;
    border: 1px solid var(--mm-rule);
  }
  .mm-matrix thead th {
    border-bottom-color: var(--mm-rule-strong);
    color: var(--mm-ink-dim);
    font-weight: 400;
  }
  .mm-matrix thead th:first-child {
    width: auto;
    min-width: 0;
    border: 0;
  }
  .mm-matrix thead abbr {
    text-decoration: none;
  }
  .mm-matrix tbody th {
    width: auto;
    padding-right: 0.75rem;
    border: 0;
    text-align: left;
    white-space: nowrap;
    font-weight: 400;
  }
  .mm-matrix-index {
    display: inline-block;
    width: 1.75rem;
    color: var(--mm-ink-dim);
  }
  .mm-matrix-name {
    font-family: var(--font-arena), "Saira Condensed", "Arial Narrow", sans-serif;
    font-size: 0.8125rem;
    letter-spacing: 0.01em;
  }
  /* Inert, not empty: a pair with itself is not a missing pairing. */
  .mm-matrix-self {
    background-image: linear-gradient(
      to bottom right,
      transparent calc(50% - 0.5px),
      var(--mm-rule) calc(50% - 0.5px),
      var(--mm-rule) calc(50% + 0.5px),
      transparent calc(50% + 0.5px)
    );
  }
  /* The failure signal is a count above 1, so that is the only thing drawn
     loudly - in ink, because orange is spoken for. */
  .mm-matrix td[data-repeat] {
    box-shadow: inset 0 0 0 2px var(--mm-ink);
    font-weight: 700;
  }
```

## Paper

Belongs inside the `@media print` block.

```css
/* Fixed cell sizes are a screen affordance - they keep the matrix square
     at any player count. On paper the count decides: at 32 players a 1.75rem
     grid is 56rem wide and the right-hand columns fall off the sheet. Sizing
     to content instead lets the table fit whatever the roster is. */
  .mm-matrix {
    max-width: 100%;
    font-size: 0.6875rem;

    /* The diagonal through the inert cells is a background image, and
       printing drops backgrounds unless a page says otherwise. Without this
       a pair with itself prints as a blank cell - which is the one thing the
       diagonal exists to deny. */
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
  }
  .mm-matrix thead th,
  .mm-matrix td {
    width: auto;
    min-width: 0;
    height: 1.15rem;
    padding: 0 0.15rem;
  }
  /* The name column is the only one on the sheet that can give, so it is the
     one allowed to. Held at `nowrap` it sets a floor the table cannot get
     under, and a roster with a "Maria Fernanda Rodriguez Villanueva" in it
     pushes 32 columns past the edge of an A4 page - which is the cut-off this
     whole block is here to prevent. A wrapped name costs one taller row. */
  .mm-matrix tbody th {
    padding-right: 0.5rem;
    white-space: normal;
  }
  .mm-matrix-index {
    width: 1.25rem;
  }
  /* A border rather than the screen's inset shadow, for the same reason the
     diagonal needed help: borders print, shadows are background paint. */
  .mm-matrix td[data-repeat] {
    box-shadow: none;
    border: 2px solid var(--mm-ink);
  }
  /* The matrix follows the schedule down the page rather than being forced
     onto a sheet of its own: at eight players that would be a page holding
     an 8x8 grid and nothing else. But it is never split when it does not
     have to be - it is one square read across and down, and half of it on
     each side of a page turn is most of its value gone. Even at 32 players
     it is shorter than a page, so this only ever moves it, never squeezes
     it; if a roster of long wrapped names ever does outgrow a sheet the
     browser drops the request and the repeating header row carries it. */
  .mm-sheet section:has(> #mm-matrix-heading) {
    margin-top: 1.75rem;
    break-inside: avoid;
  }
```

## Not reproduced here

Two rules were folded into neighbouring print rules rather than removed whole, so they have no
block of their own. Both go in `@media print`:

```css
/* `.mm-matrix tr` joins `.mm-grid tbody tr` in the existing rule: */
.mm-grid tbody tr,
.mm-matrix tr {
  break-inside: avoid;
}

/* And this one stands alone: */
.mm-matrix thead {
  display: table-header-group;
}
```
