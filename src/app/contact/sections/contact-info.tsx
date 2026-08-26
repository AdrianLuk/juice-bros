import { siteConfig } from "@/config/site";
import { Button } from "@/components/ui/button";
import { InstagramIcon } from "@/components/icons";
import { SectionHeading } from "@/components/typography/section-heading";

type Account = {
  name: string;
  instagram: string;
};

const accounts: Account[] = [
  { name: "Juice Bros Pickleball", instagram: siteConfig.links.instagram },
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
        <SectionHeading title="Follow the Juice Bros" />
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {accounts.map((account) => (
            <AccountButton key={account.name} account={account} />
          ))}
        </div>
      </div>
    </section>
  );
}
