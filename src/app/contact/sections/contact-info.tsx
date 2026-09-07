import { siteConfig } from "@/config/site";
import { InstagramIcon } from "@/components/icons";

type Account = {
  name: string;
  instagram: string;
};

// The brand account (@juicebrospickleball) leads rather than being left to the
// Instagram strip below: that strip links out from each individual post, which
// is not the same thing as "follow the show".
const accounts: Account[] = [
  { name: "Daven", instagram: "https://www.instagram.com/pickleball.dav" },
  { name: "Adrian", instagram: "https://www.instagram.com/adrian.pickleball" },
];

/**
 * The other ways to reach them, for the visitor who was never going to fill in
 * a form.
 *
 * It sits beside the form rather than under it. A contact page is one narrow
 * column of fields, and on a 72rem measure that leaves half the screen empty -
 * so the alternative to the form goes in the space the form doesn't need,
 * where it is visible at the moment someone decides they don't want to type.
 *
 * The show's own account takes the brand-coloured button and the two personal
 * accounts are ghosts beside it, which is the real hierarchy: most people want
 * the show.
 */
export function ContactInfo() {
  return (
    <aside className="bx-panel h-fit p-6 sm:p-7">
      <h2 className="bx-h2 text-lg sm:text-xl">Or just say it on Instagram</h2>
      <p className="mt-3.5 text-[0.9375rem] leading-relaxed text-[var(--bx-muted)]">
        Our DMs are open, and so are the comments. Both hosts are on there too.
      </p>

      <div className="mt-6 flex flex-wrap gap-2.5">
        <a
          href={siteConfig.links.instagram}
          target="_blank"
          rel="noopener noreferrer"
          className="bx-btn bx-btn-ig"
        >
          <InstagramIcon className="size-[1.125rem]" />
          The show
        </a>
        {accounts.map((account) => (
          <a
            key={account.name}
            href={account.instagram}
            target="_blank"
            rel="noopener noreferrer"
            className="bx-btn bx-btn-ghost"
          >
            <InstagramIcon className="size-[1.125rem]" />
            {account.name}
          </a>
        ))}
      </div>
    </aside>
  );
}
