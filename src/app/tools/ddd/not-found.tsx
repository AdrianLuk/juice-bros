import { DddBar } from "@/components/ddd/ddd-head";

/** A DDD or link that isn't there: a mistyped link, or a DDD that was deleted. */
export default function DddNotFound() {
  return (
    <>
      <DddBar title="Nothing here" />
      <main className="ddd-main">
        <div className="ddd-col ddd-slip ddd-notice">
          <p>This link doesn&apos;t open a DDD. Check it against the one in the group chat.</p>
        </div>
      </main>
    </>
  );
}
