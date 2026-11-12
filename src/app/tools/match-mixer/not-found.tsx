import Link from "next/link";

/** A Live Mixer link with nothing behind it: mistyped, cut short, or not a link at all. */
export default function NoSuchLiveMixer() {
  return (
    <div className="mm-sheet">
      <div className="mm-face mm-fixings">
        <h1 className="mm-title">No such board</h1>
        <p className="mm-lede mt-4">
          There&rsquo;s no live Match Mixer board at this link. Check you copied the whole link, or ask the organizer
          to share it again.
        </p>
        <p className="mm-note mt-4">
          <Link href="/tools/match-mixer" className="underline">
            Make your own board
          </Link>
        </p>
      </div>
    </div>
  );
}
