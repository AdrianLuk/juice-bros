import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";

import { DemoBoard } from "./demo-board";

const NIGHT = [
  {
    title: "The Host starts a Poll",
    text: "Name the night and type in the line-up. A duet goes in as one Contestant, and anyone who decides to sing halfway through can still be added.",
  },
  {
    title: "The Guest Link goes in the group chat",
    text: "One link for the whole room. It opens in any phone's browser, the group chat's own included, with nothing to install and no account.",
  },
  {
    title: "Everyone votes from their seat",
    text: "Tap a name to vote, tap another to switch. The chart re-sorts on every phone at once, so the race plays out between songs.",
  },
  {
    title: "Last call, then No. 1",
    text: "The Host closes the Poll and the chart freezes. Whoever leads takes No. 1. Level at the top is a joint win, and the room settles it with a sing-off.",
  },
];

const RULES = [
  {
    title: "One phone, one vote",
    text: "Your phone remembers your pick. Close the tab, open the link again, and you're still backing the same Contestant.",
  },
  {
    title: "Change your mind all night",
    text: "A later Contestant blew you away? Tap them. Your old vote stops counting the moment you switch.",
  },
  {
    title: "Nobody sees your pick",
    text: "The chart shows counts and nothing else. Not who voted, not for whom.",
  },
  {
    title: "Contestants vote too",
    text: "Including for themselves. It keeps the rules simple.",
  },
];

const QUESTIONS = [
  {
    question: "Do Guests need an account?",
    answer: "No. They open the Guest Link and tap. No sign-in, no name, nothing to download.",
  },
  {
    question: "What if my signal drops?",
    answer:
      "The chart says Reconnecting until it's back, so you never mistake old counts for live ones. A vote you cast before it dropped still counts.",
  },
  {
    question: "Who can host?",
    answer: "Hosting is invite-only for now. Guests never need to be invited: the Guest Link is the invite.",
  },
  {
    question: "Does it cost anything?",
    answer: "No. Mic Drop is free and has no ads.",
  },
];

/**
 * Mic Drop's signed-out landing: what it is, shown with the real chart on a
 * made-up night the visitor can vote in, then how a night runs, the rules,
 * and the Host's way in at the bottom. Unlisted; for sharing a preview.
 */
export function MicDropLanding({ hostSignIn }: { hostSignIn: ReactNode }) {
  return (
    <div className="md-land">
      <section className="md-land-hero md-land-wrap" aria-labelledby="md-land-title">
        <div className="md-land-pitch">
          <h1 id="md-land-title" className="md-land-title">
            Mic Drop
          </h1>
          <p className="md-land-lead">
            The vote for karaoke night. Everyone backs their favourite Contestant from their own phone, and the chart
            re-sorts as the votes come in.
          </p>
          <p className="md-land-meta">Free, and Guests just open a link.</p>
          <p className="md-land-try">Try it: the demo room is already voting.</p>
        </div>
        <DemoBoard />
      </section>

      <section className="md-land-band" aria-labelledby="md-land-night">
        <div className="md-land-wrap md-land-section">
          <h2 id="md-land-night" className="md-land-h2">
            How a night runs
          </h2>
          <ol className="md-land-steps">
            {NIGHT.map((step, index) => (
              <li key={step.title}>
                <span aria-hidden className="md-land-num">
                  {index + 1}
                </span>
                <h3 className="md-land-h3">{step.title}</h3>
                <p>{step.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="md-land-band" aria-labelledby="md-land-rules">
        <div className="md-land-wrap md-land-section md-land-split">
          <h2 id="md-land-rules" className="md-land-h2">
            House rules
          </h2>
          <ul className="md-land-rules">
            {RULES.map((rule) => (
              <li key={rule.title}>
                <h3 className="md-land-h3">{rule.title}</h3>
                <p>{rule.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="md-land-band" aria-labelledby="md-land-questions">
        <div className="md-land-wrap md-land-section md-land-split">
          <h2 id="md-land-questions" className="md-land-h2">
            Questions
          </h2>
          <div className="md-land-faq">
            {QUESTIONS.map((item) => (
              <details key={item.question}>
                <summary>
                  {item.question}
                  <ChevronDown aria-hidden size={20} />
                </summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section id="host" className="md-land-band md-land-host" aria-labelledby="md-land-host">
        <div className="md-land-wrap md-land-section">
          <h2 id="md-land-host" className="md-land-h2">
            Hosting a night?
          </h2>
          <p className="md-land-lead">
            Sign in with Google. If your account is on the Host list, you land on your Polls.
          </p>
          {hostSignIn}
        </div>
      </section>
    </div>
  );
}
