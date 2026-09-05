/**
 * The play affordance drawn on every thumbnail. An authored SVG rather than a
 * unicode triangle or an icon-set glyph, so its optical centring and its
 * corner radius match the rest of the page's drawing.
 */
export function PlayMark() {
  return (
    <span aria-hidden className="bx-play">
      <svg viewBox="0 0 24 24" className="size-[38%] translate-x-[6%]" fill="currentColor">
        <path d="M6.6 3.4a1.4 1.4 0 0 1 2.1-1.2l11 8.6a1.4 1.4 0 0 1 0 2.4l-11 8.6a1.4 1.4 0 0 1-2.1-1.2Z" />
      </svg>
    </span>
  );
}
