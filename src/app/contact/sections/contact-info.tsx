import { siteConfig } from "@/config/site";
import { Button } from "@/components/ui/button";
import { InstagramIcon } from "@/components/icons";
import { PageHeading } from "@/components/typography/page-heading";

type Account = {
  name: string;
  instagram: string;
};

const accounts: Account[] = [
  { name: "Juice Bros Pickleball", instagram: siteConfig.links.instagram },
  { name: "Daven", instagram: "https://www.instagram.com/pickleball.dav" },
  { name: "Adrian", instagram: "https://www.instagram.com/adrian.pickleball" },
];

export function ContactInfo() {
  return (
    <>
      <PageHeading title="Contact" description="Get in touch - coming soon." />

      <div className="mt-12 border-t pt-12">
        <p className="font-heading text-xl font-bold">Follow the Juice Bros</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {accounts.map((account) => (
            <Button
              key={account.name}
              size="lg"
              variant="outline"
              nativeButton={false}
              className="h-11 justify-start px-6 text-base"
              render={
                <a href={account.instagram} target="_blank" rel="noopener noreferrer" />
              }
            >
              <InstagramIcon className="size-5 text-[#e1306c]" />
              {account.name}
            </Button>
          ))}
        </div>
      </div>
    </>
  );
}
