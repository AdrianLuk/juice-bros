import Link from "next/link";

/**
 * The stub for a tool that is listed but not built yet.
 *
 * Unreachable today - both shipped tools are live - but it is the first thing
 * a visitor would see for the next one, so it wears the same look as
 * everything else rather than the incumbent's dashed-border placeholder with a
 * floating icon in it. No glyph: a generic mark hovering over an empty panel
 * is decoration standing in for information, which is the exact failure the
 * tools index was redesigned to fix.
 */
export function ComingSoon() {
  return (
    <div className="bx-panel mt-10 max-w-2xl p-8 sm:p-10">
      <h2 className="bx-h2 text-lg sm:text-xl">Still building this one</h2>
      <p className="bx-meta mt-2.5">Not ready yet</p>
      <p className="mt-4 max-w-[46ch] text-[0.9375rem] leading-relaxed text-[var(--bx-muted)]">
        It&apos;s on the bench while we finish it. The tools that are ready to
        use are all free and open right now.
      </p>
      <Link href="/tools" className="bx-actionlink group mt-7">
        See the tools that are ready
        <span aria-hidden className="bx-arrow">
          &rarr;
        </span>
      </Link>
    </div>
  );
}
