export type GearItem = {
  name: string;
  category: string;
  blurb: string;
  code: string;
  url: string;
  image?: string;
};

export type HostGear = {
  name: string;
  current: GearItem[];
  bag: GearItem[];
};

// Shared: both hosts main the Trigger Grip Pro, so it appears in each Currently Using list.
const triggerGripCard: GearItem = {
  name: "Trigger Grip Pro",
  category: "Accessory",
  blurb: "The grip upgrade both of us run — the accessory that changed our games.",
  code: "JUICEBROS",
  url: "https://triggergrippro.com",
  image:
    "https://cdn.shopify.com/s/files/1/0608/2596/0544/files/TGP_Premium_Grip_Stealth_Grey.png?v=1778789661",
};

const daven: HostGear = {
  name: "Daven",
  current: [
    triggerGripCard,
    {
      name: "Bread & Butter Loco",
      category: "Paddle",
      blurb: "Daven's daily driver for competitive tournament play.",
      code: "DWONG",
      url: "https://www.bnbpickleball.com",
      image:
        "https://cdn.sanity.io/images/ka3o2rwm/production/4c6d4b23cb549b9c90e30d53d873a89e45fcb2ab-800x800.png?w=400&h=400&q=80&auto=format",
    },
    {
      name: "UDrippin Overgrips",
      category: "Overgrip",
      blurb: "Wrapped on every paddle for the tack and feel he trusts.",
      code: "DWONG15",
      url: "https://www.udrippin.com",
      image:
        "https://www.udrippin.com/cdn/shop/files/udrippin_white_main.webp?v=1707586921&width=1750",
    },
  ],
  bag: [
    {
      name: "Aethos Pickleball",
      category: "Apparel",
      blurb: "On-court apparel and gear that comes along for every session.",
      code: "DWONG10",
      url: "https://aethospickleball.com",
      image:
        "https://aethospickleball.com/cdn/shop/files/M3_Ares_Shopify_Desktop_Slideshow_Banner.png?v=1780200604&width=800",
    },
  ],
};

const adrian: HostGear = {
  name: "Adrian",
  current: [
    triggerGripCard,
    {
      name: "Honolulu Pickleball",
      category: "Paddle",
      blurb: "Adrian's daily driver for competitive play.",
      code: "ADRIANLUK",
      url: "https://808pickle.com",
      image:
        "https://808pickle.com/cdn/shop/files/J2CR_CBES_WHT_400x.jpg?v=1782937697",
    },
  ],
  bag: [],
};

export const hosts: HostGear[] = [daven, adrian];
