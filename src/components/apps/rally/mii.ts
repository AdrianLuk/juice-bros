import {
  CanvasTexture,
  CapsuleGeometry,
  Color,
  CylinderGeometry,
  BoxGeometry,
  Group,
  Mesh,
  MeshToonMaterial,
  SphereGeometry,
  SRGBColorSpace,
  type Material,
} from "three";

import type { Host } from "./hosts";

/**
 * A host as a Mii-style figure, in feet: a big round head with their face
 * wrapped round its front, a rounded torso in the orange jersey with their
 * name across the back, short limbs and ball hands, and a paddle in the
 * right hand. It faces -z (the net, for the near player); its right is +x.
 * Every motion is procedural: a bob and stride while it runs, a turn of the
 * shoulders on each swing, arms up for a point won and a droop for one lost.
 */

const HEAD_R = 0.95;
const JERSEY = "#f26522";
const SHORTS = "#16181b";
const SHOE = "#eef0f2";
const PADDLE = "#1b1e22";
const PADDLE_FACE = "#2d6cdf";

/** How long a swing, a cheer and a slump last, in seconds. */
const SWING = 0.3;
const CHEER = 1.2;
const SLUMP = 1.1;

export type Mii = {
  group: Group;
  /** Starts a swing: a forehand (+1) or a backhand (-1). */
  swing(side: 1 | -1): void;
  cheer(): void;
  slump(): void;
  /**
   * Advances the motions by `dt` seconds. `speed` is how fast the figure
   * moves (feet a second); `ball` is where the ball is in the figure's own
   * frame (x to its right, y up, z behind it), or null when it's far.
   */
  update(dt: number, speed: number, ball: { x: number; y: number; z: number } | null): void;
  /** Sets the skin's colour, from the face texture's background once it loads. */
  setSkin(color: Color): void;
  setFace(texture: CanvasTexture): void;
  dispose(): void;
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
/** Eases `from` toward `to` at `rate` per second. */
const ease = (from: number, to: number, rate: number, dt: number) =>
  from + (to - from) * (1 - Math.exp(-rate * dt));

/** The host's name, across the back of the jersey. */
function nameTexture(text: string, font: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 300;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `800 150px ${font}`;
  ctx.fillText(text, 256, 160, 490);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/**
 * A stand-in face until the host's cartoon face exists: their glasses, eyes,
 * brows and a smile on a skin-tone square, the layout the real one follows.
 */
export function placeholderFace(host: Host) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = host.skin;
  ctx.fillRect(0, 0, 256, 256);
  ctx.lineCap = "round";
  ctx.fillStyle = ctx.strokeStyle = "#1d1611";
  // Brows, eyes, nose, smile.
  ctx.lineWidth = 7;
  for (const x of [92, 164]) {
    ctx.beginPath();
    ctx.moveTo(x - 20, 98);
    ctx.lineTo(x + 20, 96);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(x, 124, 7, 9, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(128, 146, 8, 0.2 * Math.PI, 0.8 * Math.PI);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(128, 166, 26, 0.1 * Math.PI, 0.9 * Math.PI);
  ctx.closePath();
  ctx.fill();
  // Glasses.
  ctx.strokeStyle = host.glasses.frame;
  ctx.lineWidth = 6;
  for (const x of [92, 164]) {
    ctx.beginPath();
    if (host.glasses.round) ctx.ellipse(x, 124, 27, 22, 0, 0, Math.PI * 2);
    else ctx.roundRect(x - 30, 106, 60, 38, 8);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(119, 122);
  ctx.lineTo(137, 122);
  ctx.stroke();
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

export function createMii(host: Host, face: CanvasTexture, font: string): Mii {
  const { height: h, width: w } = host.build;
  const toon = (color: string | Color) => new MeshToonMaterial({ color });
  const skin = toon(host.skin);
  const hair = toon(host.hair);
  const jersey = toon(JERSEY);
  const shorts = toon(SHORTS);
  const legs = host.leggings ? toon(SHORTS) : skin;
  const faceMaterial = new MeshToonMaterial({ map: face });
  const nameMaterial = new MeshToonMaterial({ map: nameTexture(host.jersey, font), transparent: true });

  const group = new Group();
  // Everything that bobs and hops: the whole figure off the ground.
  const body = new Group();
  // Everything that turns with a swing: torso, arms and head.
  const upper = new Group();
  group.add(body);

  const hipY = 1.5 * h;
  const legLength = 1.5 * h;

  // Legs swing from the hip; a white shoe at each foot.
  const leg = (x: number) => {
    const pivot = new Group();
    pivot.position.set(x * w, hipY, 0);
    const limb = new Mesh(new CapsuleGeometry(0.24, legLength - 0.48, 4, 10), legs);
    limb.position.y = -legLength / 2;
    const shoe = new Mesh(new SphereGeometry(0.27, 12, 8), toon(SHOE));
    shoe.scale.set(1, 0.6, 1.5);
    shoe.position.set(0, -legLength + 0.1, -0.12);
    pivot.add(limb, shoe);
    body.add(pivot);
    return pivot;
  };
  const legL = leg(-0.3);
  const legR = leg(0.3);

  const shortsMesh = new Mesh(new CylinderGeometry(0.62 * w, 0.66 * w, 0.6, 20), shorts);
  shortsMesh.position.y = hipY + 0.05;
  body.add(shortsMesh);

  upper.position.y = hipY;
  body.add(upper);

  const torso = new Mesh(new CapsuleGeometry(0.62, 0.8, 6, 20), jersey);
  torso.scale.x = w;
  torso.position.y = 0.85;
  // The name on the back: a strip of the torso's own curve, a hair outside it.
  const name = new Mesh(
    new CylinderGeometry(0.63, 0.63, 0.56, 16, 1, true, -0.75, 1.5),
    nameMaterial,
  );
  name.position.y = 0.15;
  torso.add(name);
  upper.add(torso);

  // Arms hang from the shoulder; a ball hand at the end; the paddle in the right.
  const arm = (x: number) => {
    const pivot = new Group();
    pivot.position.set(x * 0.72 * w, 1.42, 0);
    const limb = new Mesh(new CapsuleGeometry(0.17, 0.7, 4, 8), skin);
    limb.position.y = -0.5;
    const sleeve = new Mesh(new CapsuleGeometry(0.22, 0.12, 4, 8), jersey);
    sleeve.position.y = -0.12;
    const hand = new Mesh(new SphereGeometry(0.22, 12, 8), skin);
    hand.position.y = -1.0;
    pivot.add(limb, sleeve, hand);
    upper.add(pivot);
    return pivot;
  };
  const armL = arm(-1);
  const armR = arm(1);
  const paddle = new Group();
  const blade = new Mesh(new BoxGeometry(0.75, 0.95, 0.08), toon(PADDLE));
  blade.position.y = -0.62;
  const bladeFace = new Mesh(new BoxGeometry(0.6, 0.78, 0.09), toon(PADDLE_FACE));
  bladeFace.position.y = -0.64;
  const grip = new Mesh(new CylinderGeometry(0.07, 0.07, 0.45, 8), toon(PADDLE));
  grip.position.y = -0.05;
  paddle.add(blade, bladeFace, grip);
  paddle.position.y = -1.05;
  armR.add(paddle);

  // The head: skin all round, the face wrapped round its front.
  const head = new Group();
  head.position.y = 1.9 + HEAD_R * 0.8;
  const skull = new Mesh(new SphereGeometry(HEAD_R, 32, 20), skin);
  const faceMesh = new Mesh(
    new SphereGeometry(HEAD_R * 1.004, 32, 20, Math.PI * 1.5 - 1, 2, 0.7, 1.5),
    faceMaterial,
  );
  head.add(skull, faceMesh);
  for (const x of [-1, 1]) {
    const ear = new Mesh(new SphereGeometry(0.2, 10, 8), skin);
    ear.scale.set(0.6, 1, 0.8);
    ear.position.set(x * HEAD_R * 0.97, -0.05, 0.05);
    head.add(ear);
  }
  if (host.cap) {
    const capMaterial = toon(host.cap);
    const crown = new Mesh(new SphereGeometry(HEAD_R * 1.07, 28, 12, 0, Math.PI * 2, 0, 1.25), capMaterial);
    crown.position.y = 0.04;
    const brim = new Mesh(
      new CylinderGeometry(0.78, 0.78, 0.06, 24, 1, false, Math.PI / 2, Math.PI),
      capMaterial,
    );
    brim.position.set(0, 0.4, -HEAD_R * 0.72);
    brim.rotation.x = -0.12;
    // Hair showing under the cap at the back.
    const nape = new Mesh(
      new SphereGeometry(HEAD_R * 1.03, 20, 10, Math.PI / 2 - 1.3, 2.6, 1.2, 0.55),
      hair,
    );
    head.add(crown, brim, nape);
  } else {
    // Short hair: a cap of it over the top, down the back to the nape.
    const top = new Mesh(new SphereGeometry(HEAD_R * 1.05, 28, 12, 0, Math.PI * 2, 0, 0.95), hair);
    const back = new Mesh(
      new SphereGeometry(HEAD_R * 1.04, 24, 12, Math.PI / 2 - 1.45, 2.9, 0, 1.85),
      hair,
    );
    head.add(top, back);
  }
  upper.add(head);

  let stride = 0;
  let runAmount = 0;
  let swingT = Infinity;
  let swingSide: 1 | -1 = 1;
  let cheerT = Infinity;
  let slumpT = Infinity;

  function update(dt: number, speed: number, ball: { x: number; y: number; z: number } | null) {
    swingT += dt;
    cheerT += dt;
    slumpT += dt;
    runAmount = ease(runAmount, clamp(speed / 9, 0, 1), 12, dt);
    stride += dt * (4 + 8 * runAmount);

    // Running: legs stride, arms pump against them, the body bobs.
    const s = Math.sin(stride) * runAmount;
    legL.rotation.x = s * 0.7;
    legR.rotation.x = -s * 0.7;
    let hop = Math.abs(Math.sin(stride)) * 0.14 * runAmount;
    let leftArm = { x: -s * 0.6, z: -0.12 };
    let rightArm = { x: s * 0.6 + 0.35, z: 0.25 };

    // Ready for the ball: the paddle arm reaches toward it, forehand or backhand.
    if (ball) {
      const lift = clamp((ball.y - 2.5) / 3, 0, 1);
      rightArm =
        ball.x >= -0.3
          ? { x: 0.5 + lift * 1.2, z: 0.35 + clamp(ball.x / 3, 0, 1) * 0.9 }
          : { x: 0.9 + lift * 1.0, z: -0.2 - clamp(-ball.x / 3, 0, 1) * 0.7 };
    }

    // A swing: the shoulders turn through the ball.
    let turn = 0;
    if (swingT < SWING) {
      const t = swingT / SWING;
      turn = swingSide * (0.7 - 1.6 * t) * Math.sin(Math.PI * Math.min(1, t * 1.2));
      rightArm.x += 0.6 * Math.sin(Math.PI * t);
    }
    upper.rotation.y = ease(upper.rotation.y, turn, 30, dt);

    // A point won: arms up, a few hops. A point lost: head and shoulders drop.
    let droop = 0;
    if (cheerT < CHEER) {
      hop += Math.abs(Math.sin(cheerT * Math.PI * 3)) * 0.6 * (1 - cheerT / CHEER);
      leftArm = { x: 0.2, z: -2.6 };
      rightArm = { x: 0.2, z: 2.6 };
    } else if (slumpT < SLUMP) {
      droop = Math.sin(Math.PI * (slumpT / SLUMP));
      leftArm = { x: -0.1, z: -0.05 };
      rightArm = { x: 0.1, z: 0.1 };
    }
    body.position.y = hop;
    head.rotation.x = ease(head.rotation.x, -0.45 * droop, 14, dt);
    upper.rotation.x = ease(upper.rotation.x, -0.15 * droop, 14, dt);
    for (const [pivot, to] of [
      [armL, leftArm],
      [armR, rightArm],
    ] as const) {
      pivot.rotation.x = ease(pivot.rotation.x, to.x, 18, dt);
      pivot.rotation.z = ease(pivot.rotation.z, to.z, 18, dt);
    }
  }

  return {
    group,
    swing(side) {
      swingSide = side;
      swingT = 0;
    },
    cheer() {
      cheerT = 0;
      slumpT = Infinity;
    },
    slump() {
      slumpT = 0;
      cheerT = Infinity;
    },
    update,
    setSkin(color) {
      skin.color.copy(color);
    },
    setFace(texture) {
      faceMaterial.map?.dispose();
      faceMaterial.map = texture;
      faceMaterial.needsUpdate = true;
    },
    dispose() {
      const materials = new Set<Material>();
      group.traverse((object) => {
        if (object instanceof Mesh) {
          object.geometry.dispose();
          materials.add(object.material as Material);
        }
      });
      for (const material of materials) {
        (material as MeshToonMaterial).map?.dispose();
        material.dispose();
      }
    },
  };
}
