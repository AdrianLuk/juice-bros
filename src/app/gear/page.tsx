import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Gear",
};

export default function GearPage() {
  return (
    <div className="flex w-full flex-1 flex-col px-4 py-16 sm:px-6 lg:px-8">
      <h1 className="font-heading text-3xl font-semibold tracking-tight">Gear</h1>
      <p className="mt-2 text-muted-foreground">Our paddle, shoe, and accessory picks — coming soon.</p>
    </div>
  );
}
