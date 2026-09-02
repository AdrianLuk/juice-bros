import {
  OnDeckShellFooter,
  OnDeckShellHeader,
} from "@/components/on-deck/on-deck-shell";

/**
 * On Deck's section layout. The global Juice Bros header/footer are suppressed
 * across `/on-deck/*` app surfaces by `SiteChromeSlot` in the root layout;
 * this puts On Deck's own bare shell around them instead. The marketing
 * landing at exactly `/on-deck` keeps the full site chrome — both shell
 * components no-op there.
 *
 * The shell is intentionally nav-free: On Deck is a walk-up tool (a phone at
 * the courts, a tablet on the snack table), not a site to browse.
 */
export default function OnDeckLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex w-full flex-1 flex-col">
      <OnDeckShellHeader />
      <div className="flex w-full flex-1 flex-col">{children}</div>
      <OnDeckShellFooter />
    </div>
  );
}
