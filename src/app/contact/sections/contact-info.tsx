import { Button } from "@/components/ui/button";
import { InstagramIcon } from "@/components/icons";
import { SectionHeading } from "@/components/typography/section-heading";

type Account = {
  name: string;
  instagram: string;
};

// The brand account (@juicebrospickleball) isn't here on purpose — the "On
// Instagram" feed above already links straight to it. This row is just the two
// hosts' personal accounts.
const accounts: Account[] = [
  { name: "Daven", instagram: "https://www.instagram.com/pickleball.dav" },
  { name: "Adrian", instagram: "https://www.instagram.com/adrian.pickleball" },
];

function AccountButton({ account }: { account: Account }) {
  return (
    <Button
      size="lg"
      variant="outline"
      nativeButton={false}
      className="h-12 w-full min-w-0 justify-start gap-2 rounded-2xl px-4 text-sm"
      render={<a href={account.instagram} target="_blank" rel="noopener noreferrer" />}
    >
      <InstagramIcon className="size-4 shrink-0 text-[#e1306c]" />
      <span className="truncate">{account.name}</span>
    </Button>
  );
}

export function ContactInfo() {
  return (
    <section className="w-full bg-muted/50 px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <SectionHeading eyebrow="Stay In The Loop" title="Follow the bros" />
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {accounts.map((account) => (
            <AccountButton key={account.name} account={account} />
          ))}
        </div>
      </div>
    </section>
  );
}
