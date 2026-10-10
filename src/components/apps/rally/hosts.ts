/**
 * The two hosts as the game draws them: Mii-style, from the photos in
 * public/pictures (faces from the Creator Night group photo; builds and kit
 * from that photo and adrian-dav-backs-rally). `face` is a flat cartoon of
 * the features on a skin-tone square, wrapped round the front of the head;
 * without one the scene paints a simple stand-in from `glasses`.
 */
export type HostId = "adrian" | "daven";

export type Host = {
  name: string;
  /** Upper case, across the back of the jersey. */
  jersey: string;
  face: string | null;
  skin: string;
  hair: string;
  /** A baseball cap over the hair, in this colour; short thick hair without one. */
  cap: string | null;
  /** The logo on the cap's front panels. */
  capLogo: string | null;
  /**
   * The head's shape, from the photos: width and height against a round
   * head, how full the cheeks are, how much it narrows to the chin, and how
   * big the ears are.
   */
  head: { width: number; height: number; cheeks: number; chin: number; ears: number };
  glasses: { frame: string; round: boolean };
  /** Leggings under the shorts, or bare legs. */
  leggings: boolean;
  shoes: string;
  /** A watch on the left wrist. */
  watch: boolean;
  /**
   * Relative to a standard figure: overall height, leg length, torso width
   * and depth, and how thick the arms and legs are.
   */
  build: { height: number; legs: number; width: number; depth: number; limbs: number };
};

export const HOSTS: Record<HostId, Host> = {
  // Shorter and sturdy: broad through the chest and middle, thick arms and legs,
  // bare legs below black shorts.
  adrian: {
    name: "Adrian",
    jersey: "ADRIAN",
    face: "/play/adrian-face.webp",
    skin: "#e8b48c",
    hair: "#17130f",
    cap: null,
    capLogo: null,
    // Round and broad, full in the cheeks.
    head: { width: 1.07, height: 0.97, cheeks: 0.08, chin: 0.04, ears: 1 },
    glasses: { frame: "#141414", round: false },
    leggings: false,
    // White, as Daven's: dark shoes vanished into the court's shadow.
    shoes: "#f1f2f4",
    watch: false,
    build: { height: 0.9, legs: 1.1, width: 1.2, depth: 1.15, limbs: 1.25 },
  },
  // Taller and lean: long legs in black leggings, slim arms, white shoes.
  daven: {
    name: "Daven",
    jersey: "DAVEN",
    face: "/play/daven-face.webp",
    skin: "#dba47a",
    hair: "#17130f",
    // Light grey, as in the Vaughan Fall Open photo.
    cap: "#d3d3cd",
    // His own brand, Game Point Apparel (gamepointapparel.ca).
    capLogo: "/play/gp-logo.png",
    // A longer oval, narrowing to the chin, the ears standing out a little.
    head: { width: 0.92, height: 1.1, cheeks: 0, chin: 0.22, ears: 1.15 },
    glasses: { frame: "#b9a57a", round: true },
    leggings: true,
    shoes: "#f1f2f4",
    watch: true,
    build: { height: 1.08, legs: 1.14, width: 0.94, depth: 0.88, limbs: 0.86 },
  },
};

export const otherHost = (id: HostId): HostId => (id === "adrian" ? "daven" : "adrian");
