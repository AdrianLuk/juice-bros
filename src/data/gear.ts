export enum GearCategory {
  Paddle = "Paddle",
  Accessory = "Accessory",
  Overgrip = "Overgrip",
  // Reserved for shoes and other on-court apparel added later. Currently unused.
  Apparel = "Apparel",
}

export type GearItem = {
  name: string;
  category: GearCategory;
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
  category: GearCategory.Accessory,
  blurb: "The grip upgrade both of us run - the accessory that changed our games.",
  code: "JUICEBROS",
  url: "https://triggergrippro.com/products/tgp-premium-grip",
  image:
    "https://cdn.shopify.com/s/files/1/0608/2596/0544/files/TGP_Premium_Grip_Stealth_Grey.png?v=1778789661",
};

const daven: HostGear = {
  name: "Daven",
  current: [
    triggerGripCard,
    {
      name: "Bread & Butter Loco",
      category: GearCategory.Paddle,
      blurb: "Daven's daily driver for competitive tournament play.",
      code: "DWONG",
      url: "https://www.bnbpickleball.com/products/loco-16mm-pickleball-paddle-standard",
      image:
        "https://www.bnbpickleball.com/cdn/shop/files/standard_940a5924-81d5-41b0-9aa8-46700c673dc2_1200x1200.jpg?v=1763482142",
    },
    {
      name: "UDrippin Overgrips",
      category: GearCategory.Overgrip,
      blurb: "Wrapped on every paddle for the tack and feel he trusts.",
      code: "DWONG15",
      url: "https://www.udrippin.com/collections/udrippin-overgrips",
      image:
        "https://www.udrippin.com/cdn/shop/files/udrippin_white_main.webp?v=1707586921&width=1750",
    },
  ],
  bag: [],
};

const adrian: HostGear = {
  name: "Adrian",
  current: [
    triggerGripCard,
    {
      name: "Honolulu J2CR Crystal Blue",
      category: GearCategory.Paddle,
      blurb: "Adrian's daily driver for competitive play.",
      code: "ADRIANLUK",
      url: "https://808pickle.com/products/j2cr-crystal-blue-endurance-surface%E2%84%A2-pre-order",
      image:
        "https://808pickle.com/cdn/shop/files/J2CR_CBES_WHT_400x.jpg?v=1782937697",
    },
  ],
  bag: [],
};

export const hosts: HostGear[] = [daven, adrian];

// Brands we've partnered with and have codes for, but don't currently game.
// Still worth passing the discount along to anyone who wants to try them.
export const partnerCodes: GearItem[] = [
  {
    name: "Aethos",
    category: GearCategory.Paddle,
    blurb: "A raw carbon paddle brand we've partnered with - grab our code if you want to try them.",
    code: "DWONG10",
    url: "https://aethospickleball.com",
    image:
      "https://aethospickleball.com/cdn/shop/files/Untitled_design_18.png?v=1701403746&width=400",
  },
];
