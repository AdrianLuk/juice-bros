export type GearItem = {
  category: "Paddles" | "Shoes" | "Accessories";
  name: string;
  why: string;
  image: string;
  affiliateUrl: string | null;
};

export const gear: GearItem[] = [
  {
    category: "Paddles",
    name: "Placeholder Paddle",
    why: "Great control and pop for intermediate players.",
    image: "/gear/placeholder-paddle.png",
    affiliateUrl: null,
  },
];
