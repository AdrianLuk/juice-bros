import Link from "next/link";

import { Button } from "@/components/ui/button";
import { ON_DECK_DEMO_PATH, ON_DECK_SIGN_IN_PATH } from "@/lib/on-deck/routes";
import { FloorModeConsoles } from "./floor-mode-consoles";

export function Hero() {
  return (
    <section className="odl-section w-full overflow-x-clip px-4 pt-28 pb-16 sm:px-6 sm:pt-40 sm:pb-24 lg:pt-44">
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-5 text-center">
        <h1 className="odl-display jb-in text-4xl sm:text-6xl">
          The board that
          <br />
          updates itself
        </h1>
        <p className="odl-body jb-in jb-in-2 max-w-xl text-lg text-balance">
          Sixty people turn up for eight courts and somebody ends up holding
          the marker all night. On Deck keeps the running order instead, so
          that person gets to play.
        </p>
        <div className="jb-in jb-in-3 mt-3 flex flex-col gap-3 sm:flex-row">
          <Button
            size="lg"
            nativeButton={false}
            className="odl-key odl-key--go h-12 px-7 text-base"
            render={<Link href={ON_DECK_DEMO_PATH} />}
          >
            Try the demo night
          </Button>
          <Button
            size="lg"
            variant="outline"
            nativeButton={false}
            className="odl-key odl-key--neutral h-12 px-7 text-base"
            render={<Link href={ON_DECK_SIGN_IN_PATH} />}
          >
            Create your Club
          </Button>
        </div>
        <p className="odl-mono jb-in jb-in-4">
          Free to use. The demo needs no account.
        </p>
      </div>

      <div className="jb-in jb-in-5 mx-auto mt-16 w-full max-w-5xl sm:mt-20">
        <FloorModeConsoles />
      </div>
    </section>
  );
}
