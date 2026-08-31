import { Reveal } from "@/components/motion/reveal";
import { SectionHeading } from "@/components/typography/section-heading";

export function Matching() {
  return (
    <section className="w-full bg-muted/50">
      <div className="mx-auto w-full max-w-3xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
        <Reveal>
          <SectionHeading
            eyebrow="Match Me and Queue Together"
            title="Fair by default, flexible when it matters"
          />
        </Reveal>
        <div className="mt-10 flex flex-col gap-6">
          <Reveal className="rounded-[1.5rem] bg-card p-6 shadow-brand sm:p-8">
            <p className="font-heading text-lg font-bold text-brand-orange">
              Match Me
            </p>
            <p className="mt-2 text-muted-foreground">
              The person who has waited longest is always in the next Foursome.
              The other three come from the next-longest waiting, chosen to keep
              skill levels close and to avoid people you have already played
              tonight. Every one of those is a preference rather than a rule, so
              a court never sits empty waiting for a perfect group. Players who
              want none of this can just leave their phone in a bag and keep
              rotating.
            </p>
          </Reveal>
          <Reveal className="rounded-[1.5rem] bg-card p-6 shadow-brand sm:p-8">
            <p className="font-heading text-lg font-bold text-brand-orange">
              Queue Together
            </p>
            <p className="mt-2 text-muted-foreground">
              Came with friends? Build a group of up to four from your phone, or
              ask a volunteer to do it. It joins the Queue as one unit at the
              median wait time of its own members, so it takes its real turn
              instead of jumping the line or losing anyone&apos;s place. A group
              of two or three gets its last seats filled by Match Me, and it
              dissolves once the game ends.
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
