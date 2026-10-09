/**
 * The two hosts as the game draws them: Mii-style, from the photos in
 * public/pictures (faces from the Creator Night group photo, backs from
 * adrian-dav-backs-rally). `face` is a flat cartoon of the features on a
 * skin-tone square, wrapped round the front of the head; until it exists the
 * scene paints a simple stand-in from `glasses`.
 */
export type HostId = "adrian" | "daven";

export type Host = {
  name: string;
  /** Upper case, across the back of the jersey. */
  jersey: string;
  face: string | null;
  skin: string;
  hair: string;
  /** A ball cap over the hair, in this colour. */
  cap: string | null;
  glasses: { frame: string; round: boolean };
  /** Leggings under the shorts, or bare legs. */
  leggings: boolean;
  /** Relative to a standard figure: height, and width across the torso. */
  build: { height: number; width: number };
};

export const HOSTS: Record<HostId, Host> = {
  adrian: {
    name: "Adrian",
    jersey: "ADRIAN",
    face: "/play/adrian-face.webp",
    skin: "#e8b48c",
    hair: "#17130f",
    cap: null,
    glasses: { frame: "#141414", round: false },
    leggings: false,
    build: { height: 0.95, width: 1.12 },
  },
  daven: {
    name: "Daven",
    jersey: "DAVEN",
    face: "/play/daven-face.webp",
    skin: "#dba47a",
    hair: "#17130f",
    cap: "#2b3038",
    glasses: { frame: "#b9a57a", round: true },
    leggings: true,
    build: { height: 1.06, width: 0.94 },
  },
};

export const otherHost = (id: HostId): HostId => (id === "adrian" ? "daven" : "adrian");
