/**
 * The positioning argument: what this show is not.
 *
 * PRODUCT.md names this as the one thing a more credentialed competitor
 * couldn't copy, so it is set as an argument and not as a pull quote - left
 * aligned, at a reading measure, with the closing line promoted to ink because
 * it is the sentence the visitor is meant to answer for themselves.
 *
 * It runs left where the Mission above it runs centred, which is what keeps two
 * consecutive passages of prose from reading as the same section twice.
 *
 * Copy unchanged from the published About page.
 */
export function Differentiation() {
  return (
    <section className="bx-measure bx-hair py-16 sm:py-24">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,20rem)_1fr] lg:gap-16">
        <div>
          <h2 className="bx-h2 max-w-[16ch] text-[clamp(1.375rem,3.2vw,1.875rem)]">
            We&apos;re not the guys who made it to the tour
          </h2>
          <p className="bx-meta mt-3">Not pros, not coaches</p>
        </div>

        <div className="bx-prose">
          <p>
            Okay, we&apos;ve picked up a few things watching from the sidelines.
            But that&apos;s not why you&apos;re here.
          </p>
          <p>
            Most pickleball shows are hosted by people who&apos;ve already
            arrived: tour pros, certified coaches, ex-athletes who traded their
            ranking for a microphone. Great show. Just not this one. Daven and
            Adrian are rec players who lose to the same teams you do, argue
            about the same line calls you do, and fight for the same 8:00pm
            court booking every week.
          </p>
          <p>
            <strong>
              If that sounds more like your Tuesday night than a tour stop,
              you&apos;re exactly who this is for.
            </strong>
          </p>
        </div>
      </div>
    </section>
  );
}
