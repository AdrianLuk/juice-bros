import {
  CanvasTexture,
  CapsuleGeometry,
  Color,
  CylinderGeometry,
  BoxGeometry,
  CatmullRomCurve3,
  ExtrudeGeometry,
  Group,
  Matrix4,
  LatheGeometry,
  Mesh,
  MeshToonMaterial,
  Shape,
  SphereGeometry,
  SRGBColorSpace,
  type Texture,
  TorusGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
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

/** The head: big, as a Mii's is, so the face reads from across the court. */
const HEAD_R = 1.15;
/** The face's patch of the head: its width round the front, and where it starts and how far it runs down (radians). */
const FACE_WIDTH = 2.1;
const FACE_TOP = 1.02;
const FACE_HEIGHT = 1.5;
/** How much the skin and face light themselves, over the court's lights. */
const FACE_GLOW = 0.35;
/** How wide the cap's logo is round the front of the crown, in radians. */
const LOGO_WIDTH = 0.38;
const JERSEY = "#f26522";
const SHORTS = "#16181b";
const PADDLE = "#1b1e22";
const PADDLE_GRIP = "#eef0f2";
/** How far down the thigh the shorts reach, in feet. */
const SHORTS_LENGTH = 0.45;
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
  /** Tilts the face up toward the camera, in radians. */
  setGaze(angle: number): void;
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

/** A rounded rectangle from `bottom` up to `top`, `width` across, rounder at the top. */
function roundedRect(width: number, top: number, bottom: number, r: number) {
  const x = width / 2;
  const rt = r * 1.5;
  const shape = new Shape();
  shape.moveTo(-x + r, bottom);
  shape.lineTo(x - r, bottom);
  shape.absarc(x - r, bottom + r, r, -Math.PI / 2, 0, false);
  shape.lineTo(x, top - rt);
  shape.absarc(x - rt, top - rt, rt, 0, Math.PI / 2, false);
  shape.lineTo(-x + rt, top);
  shape.absarc(-x + rt, top - rt, rt, Math.PI / 2, Math.PI, false);
  shape.lineTo(-x, bottom + r);
  shape.absarc(-x + r, bottom + r, r, Math.PI, Math.PI * 1.5, false);
  return shape;
}

/**
 * A pickleball paddle, in feet, hanging from the hand down -y: an elongated
 * face with rounded corners (rounder at the tip), a dark edge guard round
 * it, a coloured face on each side, and a wrapped grip with a butt cap.
 */
function createPaddle(edge: MeshToonMaterial, face: MeshToonMaterial, grip: MeshToonMaterial) {
  const group = new Group();
  const thickness = 0.06;
  // Drawn tip up, then turned over so the tip hangs below the hand.
  const guard = new ExtrudeGeometry(roundedRect(0.68, 1.26, 0.28, 0.16), { depth: thickness, bevelEnabled: false, curveSegments: 10 });
  guard.rotateZ(Math.PI).translate(0, 0, -thickness / 2);
  group.add(new Mesh(guard, edge));
  for (const side of [-1, 1]) {
    const plate = new ExtrudeGeometry(roundedRect(0.6, 1.22, 0.32, 0.13), { depth: 0.006, bevelEnabled: false, curveSegments: 10 });
    plate.rotateZ(Math.PI).translate(0, 0, side > 0 ? thickness / 2 : -thickness / 2 - 0.006);
    group.add(new Mesh(plate, face));
  }
  const handle = new Mesh(new CylinderGeometry(0.068, 0.072, 0.5, 10), grip);
  handle.position.y = -0.04;
  const cap = new Mesh(new CylinderGeometry(0.085, 0.085, 0.05, 10), edge);
  cap.position.y = 0.22;
  group.add(handle, cap);
  return group;
}

/** A point on a sphere of radius `r`: `theta` down from the top, `phi` round from the front (-z) toward +x. */
const onSphere = (r: number, theta: number, phi: number) =>
  new Vector3(r * Math.sin(theta) * Math.sin(phi), r * Math.cos(theta), -r * Math.sin(theta) * Math.cos(phi));

/**
 * The hairline, as the height (on the unit sphere) the hair comes down to in
 * a direction round the head: low on the forehead, above the ears at the
 * sides, down to the nape at the back.
 */
function hairline(dir: Vector3) {
  const across = Math.hypot(dir.x, dir.z) || 1;
  const front = -dir.z / across;
  return 0.14 + 0.24 * Math.max(0, front) ** 1.5 - 0.54 * Math.max(0, -front);
}

/** How far out the hair stands in a direction: close at the sides, height on top, lifted most at the front. */
function hairRadius(dir: Vector3) {
  const across = Math.hypot(dir.x, dir.z) || 1;
  const front = Math.max(0, -dir.z / across);
  const up = Math.max(0, dir.y);
  return HEAD_R * 1.03 * (1 + 0.2 * up ** 1.3 + 0.18 * front * up);
}

/**
 * Thick, short black hair, as in the photos: a full mass over the top with
 * real volume, a hairline low on the forehead and above the ears, down to
 * the nape at the back, and short straight strands over it that sweep up
 * and forward into the fringe.
 */
function createHair(material: MeshToonMaterial) {
  const group = new Group();
  // The mass: a shell round the head, tucked inside the skull below the hairline.
  const geometry = new SphereGeometry(1, 64, 32, 0, Math.PI * 2, 0, 2.3);
  const position = geometry.getAttribute("position");
  const dir = new Vector3();
  for (let i = 0; i < position.count; i++) {
    dir.fromBufferAttribute(position, i).normalize();
    const r = dir.y >= hairline(dir) ? hairRadius(dir) : HEAD_R * 0.9;
    position.setXYZ(i, dir.x * r, dir.y * r, dir.z * r);
  }
  geometry.computeVertexNormals();
  group.add(new Mesh(geometry, material));

  // Clumps over the top, sweeping forward; a fringe lifting at the front.
  const clump = new SphereGeometry(1, 8, 6);
  const place = (theta: number, phi: number, size: number, lift: number) => {
    const at = onSphere(1, theta, phi);
    const mesh = new Mesh(clump, material);
    mesh.scale.set(HEAD_R * 0.12 * size, HEAD_R * 0.045 * size, HEAD_R * 0.3 * size);
    mesh.position.copy(at.clone().multiplyScalar(hairRadius(at) * 0.97));
    // Lie on the head, the long axis running toward the front and up by `lift`.
    const normal = at.clone().normalize();
    const forward = new Vector3(0, lift, -1);
    forward.sub(normal.clone().multiplyScalar(forward.dot(normal))).normalize();
    const side = new Vector3().crossVectors(normal, forward);
    mesh.quaternion.setFromRotationMatrix(new Matrix4().makeBasis(side, normal, forward));
    group.add(mesh);
  };
  for (let ring = 0; ring < 4; ring++) {
    const theta = 0.12 + ring * 0.24;
    const count = 4 + ring * 3;
    for (let i = 0; i < count; i++) place(theta, (i / count) * Math.PI * 2 + ring * 0.5, 1, 0.3);
  }
  for (let i = 0; i < 6; i++) place(1.02, -0.62 + (i / 5) * 1.24, 1.25, 1.6);
  return group;
}

/**
 * The lower half of the face: fuller through the cheeks, or narrowing to the
 * chin, per the host's photos. Applied alike to the skull and the face on it.
 */
function shapeJaw(geometry: SphereGeometry, cheeks: number, chin: number) {
  const position = geometry.getAttribute("position");
  for (let i = 0; i < position.count; i++) {
    const y = position.getY(i);
    if (y >= 0) continue;
    const t = Math.min(1, -y / HEAD_R);
    const f = 1 + cheeks * Math.sin(Math.PI * t) - chin * t * t;
    position.setX(i, position.getX(i) * f);
    position.setZ(i, position.getZ(i) * (1 + (f - 1) * 0.6));
  }
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * The crown's profile, in head radii (radius out from the axis, height):
 * near-straight sides up from just under the band, then a rounded shoulder
 * into a flatter top, the shape of a structured cap rather than a dome.
 */
const CROWN_PROFILE: [number, number][] = [
  [0.99, 0.26],
  [1.01, 0.45],
  [1.0, 0.65],
  [0.94, 0.82],
  [0.8, 0.96],
  [0.55, 1.06],
  [0.27, 1.11],
  [0, 1.12],
];

/**
 * Stands the front panels up: points toward the front (-z) rise a little,
 * more the higher they are, and come forward, the way a structured cap's
 * front holds its height above the bill.
 */
/** The crown's radius at height `y`, from its profile. */
function crownRadiusAt(y: number) {
  const points = CROWN_PROFILE.map(([r, h]) => [r * HEAD_R, h * HEAD_R]);
  for (let i = 1; i < points.length; i++) {
    const [r0, y0] = points[i - 1];
    const [r1, y1] = points[i];
    if (y <= y1) return r0 + ((r1 - r0) * (y - y0)) / (y1 - y0);
  }
  return 0;
}

function shapeCrown(point: Vector3) {
  const R = HEAD_R;
  const front = Math.max(0, -point.z) / R;
  const height = Math.max(0, (point.y - 0.26 * R) / (0.86 * R));
  point.y += R * 0.1 * front * height;
  if (point.z < 0) point.z *= 1.05;
  return point;
}

/**
 * A structured six-panel baseball cap, as in the photos: a crown with
 * straight sides, a high front and a flatter top that sits on the head just
 * above the brows, seams from the button down each panel, a curved bill out
 * the front, and the strap's opening at the back with hair showing through.
 */
function createCap(
  capMaterial: MeshToonMaterial,
  seamMaterial: MeshToonMaterial,
  strapMaterial: MeshToonMaterial,
  hairMaterial: MeshToonMaterial,
  logo: Texture | null,
) {
  const group = new Group();
  const R = HEAD_R;
  const band = R * 0.36;
  const rBand = R * 0.99;
  const profile = CROWN_PROFILE.map(([r, y]) => new Vector2(r * R, y * R));
  const top = CROWN_PROFILE[CROWN_PROFILE.length - 1][1] * R;

  /** A lathe of the profile (or part of it), shaped like the crown. */
  const lathe = (points: Vector2[], segments: number, phiStart?: number, phiLength?: number) => {
    const geometry = new LatheGeometry(points, segments, phiStart, phiLength);
    const position = geometry.getAttribute("position");
    const point = new Vector3();
    for (let i = 0; i < position.count; i++) {
      shapeCrown(point.fromBufferAttribute(position, i));
      position.setXYZ(i, point.x, point.y, point.z);
    }
    geometry.computeVertexNormals();
    return geometry;
  };

  // The crown runs a little below the band, over the bill's root, so the two read as one piece.
  group.add(new Mesh(lathe(profile, 48), capMaterial));
  // Seams down each panel, from the button to the band, following the crown's shape.
  for (let i = 0; i < 6; i++) {
    // The front seam hides under the logo's embroidery.
    if (logo && i === 3) continue;
    const phi = (i * Math.PI) / 3;
    const path = new CatmullRomCurve3(
      profile.map(({ x: r, y }) => shapeCrown(new Vector3(Math.sin(phi) * (r + 0.006), y, Math.cos(phi) * (r + 0.006)))),
    );
    group.add(new Mesh(new TubeGeometry(path, 24, R * 0.012, 4), seamMaterial));
  }
  const button = new Mesh(new SphereGeometry(R * 0.09, 12, 8), capMaterial);
  button.position.y = top;
  // The strap's opening at the back: hair through an arch above the strap.
  const opening = new Mesh(
    lathe(profile.slice(0, 3).map(({ x, y }) => new Vector2(x + 0.008, y)), 8, -0.42, 0.84),
    hairMaterial,
  );
  group.add(button, opening);
  // The logo, embroidered a shade darker on the front panels.
  if (logo) {
    const rows = 10;
    const heights = Array.from({ length: rows }, (_, i) => R * (0.5 + (0.42 * i) / (rows - 1)));
    const points = heights.map((y) => new Vector2(crownRadiusAt(y) + 0.012, y));
    const material = new MeshToonMaterial({
      map: logo,
      color: new Color(capMaterial.color).multiplyScalar(0.62),
      transparent: true,
      depthWrite: false,
    });
    group.add(new Mesh(lathe(points, 16, Math.PI - LOGO_WIDTH / 2, LOGO_WIDTH), material));
  }
  // The strap across the opening's foot, and its buckle.
  const strapArc = 0.95;
  const strap = new Mesh(new TorusGeometry(rBand + 0.03, R * 0.05, 6, 16, strapArc), strapMaterial);
  strap.rotation.z = Math.PI / 2 - strapArc / 2;
  const strapRing = new Group();
  strapRing.rotation.x = Math.PI / 2;
  strapRing.position.y = band + R * 0.04;
  strapRing.add(strap);
  const buckle = new Mesh(new BoxGeometry(R * 0.16, R * 0.12, R * 0.05), new MeshToonMaterial({ color: "#8d949e" }));
  buckle.position.set(R * 0.18, band + R * 0.04, rBand + 0.05);
  group.add(strapRing, buckle);

  // The bill: a rounded D, curved down at its sides, out from the front of the band.
  const half = R * 0.74;
  const reach = R * 0.86;
  const shape = new Shape();
  shape.moveTo(-half, 0);
  shape.absellipse(0, 0, half, reach, Math.PI, 0, true);
  shape.lineTo(-half, 0);
  const billGeometry = new ExtrudeGeometry(shape, { depth: R * 0.05, bevelEnabled: true, bevelSize: R * 0.02, bevelThickness: R * 0.02, bevelSegments: 2, curveSegments: 24 });
  billGeometry.rotateX(-Math.PI / 2);
  const position = billGeometry.getAttribute("position");
  // Pre-curved: level where it meets the crown, curving down toward its sides as it runs out.
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i) / half;
    const out = Math.max(0, -position.getZ(i) / reach);
    position.setY(i, position.getY(i) - R * 0.32 * x * x * out ** 0.8);
  }
  billGeometry.computeVertexNormals();
  const bill = new Mesh(billGeometry, capMaterial);
  const chord = Math.sqrt(Math.max(0, rBand ** 2 - half ** 2));
  bill.position.set(0, band - R * 0.05, -chord * 1.05 + R * 0.06);
  bill.rotation.x = -0.12;
  group.add(bill);

  // Hair showing under the cap at the back and round the ears.
  const napeTheta = Math.acos(0.3);
  const nape = new Mesh(new SphereGeometry(R * 1.02, 24, 10, Math.PI / 2 - 1.4, 2.8, napeTheta, 0.4), hairMaterial);
  group.add(nape);
  return group;
}

export function createMii(host: Host, face: CanvasTexture, font: string, logo: Texture | null): Mii {
  const { height: h, legs: legScale, width: w, depth: d, limbs } = host.build;
  const toon = (color: string | Color) => new MeshToonMaterial({ color });
  // The skin and the face glow a little, so the face reads from across the court.
  const skin = new MeshToonMaterial({ color: host.skin, emissive: host.skin, emissiveIntensity: FACE_GLOW });
  const hair = toon(host.hair);
  const jersey = toon(JERSEY);
  const shorts = toon(SHORTS);
  const legs = host.leggings ? toon(SHORTS) : skin;
  const faceMaterial = new MeshToonMaterial({
    map: face,
    emissive: "#ffffff",
    emissiveMap: face,
    emissiveIntensity: FACE_GLOW,
  });
  const nameMaterial = new MeshToonMaterial({ map: nameTexture(host.jersey, font), transparent: true });

  const group = new Group();
  // Everything that bobs and hops: the whole figure off the ground.
  const body = new Group();
  // Everything that turns with a swing: torso, arms and head.
  const upper = new Group();
  group.add(body);

  const legLength = 1.5 * h * legScale;
  const hipY = legLength;
  const legR = 0.24 * limbs;

  // Legs swing from the hip; a shoe at each foot.
  const shoeMaterial = toon(host.shoes);
  const leg = (x: number) => {
    const pivot = new Group();
    pivot.position.set(x * w, hipY, 0);
    const limb = new Mesh(new CapsuleGeometry(legR, legLength - legR * 2, 4, 10), legs);
    limb.position.y = -legLength / 2;
    const shoe = new Mesh(new SphereGeometry(0.28, 12, 8), shoeMaterial);
    shoe.scale.set(1, 0.6, 1.5);
    shoe.position.set(0, -legLength + 0.1, -0.12);
    // Each leg of the shorts goes with its leg, so they read as shorts, not a skirt.
    const short = new Mesh(new CylinderGeometry(legR + 0.1, legR + 0.13, SHORTS_LENGTH, 14), shorts);
    short.scale.z = d;
    short.position.y = -SHORTS_LENGTH / 2 + 0.05;
    pivot.add(limb, shoe, short);
    body.add(pivot);
    return pivot;
  };
  const legL = leg(-0.3);
  const legRight = leg(0.3);

  // The seat of the shorts, under the jersey's hem.
  const seat = new Mesh(new CylinderGeometry(0.58 * w, 0.58 * w, 0.4, 20), shorts);
  seat.scale.z = d;
  seat.position.y = hipY + 0.1;
  body.add(seat);

  upper.position.y = hipY;
  body.add(upper);

  const torso = new Mesh(new CapsuleGeometry(0.62, 0.8, 6, 20), jersey);
  torso.scale.set(w, 1, d);
  torso.position.y = 0.85;
  // The name on the back: a strip of the torso's own curve, a hair outside it.
  const name = new Mesh(new CylinderGeometry(0.63, 0.63, 0.56, 16, 1, true, -0.75, 1.5), nameMaterial);
  name.position.y = 0.15;
  torso.add(name);
  upper.add(torso);

  // Arms hang from the shoulder; a ball hand at the end; the paddle in the right.
  const armR = 0.17 * limbs;
  const arm = (x: number) => {
    const pivot = new Group();
    pivot.position.set(x * 0.72 * w, 1.42, 0);
    const limb = new Mesh(new CapsuleGeometry(armR, 0.7, 4, 8), skin);
    limb.position.y = -0.5;
    const sleeve = new Mesh(new CapsuleGeometry(armR + 0.06, 0.12, 4, 8), jersey);
    sleeve.position.y = -0.12;
    const hand = new Mesh(new SphereGeometry(0.2 + 0.03 * limbs, 12, 8), skin);
    hand.position.y = -1.0;
    pivot.add(limb, sleeve, hand);
    upper.add(pivot);
    return pivot;
  };
  const armLeft = arm(-1);
  const armRight = arm(1);
  if (host.watch) {
    const watch = new Mesh(new CylinderGeometry(armR + 0.03, armR + 0.03, 0.14, 12), toon("#111316"));
    watch.position.y = -0.82;
    armLeft.add(watch);
  }
  const paddle = createPaddle(toon(PADDLE), toon(PADDLE_FACE), toon(PADDLE_GRIP));
  paddle.position.y = -1.05;
  armRight.add(paddle);

  // The head: skin all round, the face wrapped round its front, set low the
  // way a Mii's is, under a tall forehead for the hair or the cap.
  const head = new Group();
  head.position.y = 1.85 + HEAD_R * 0.85;
  // Shaped from the photos: wider or narrower, longer or rounder, fuller in the cheeks or narrowing to the chin.
  const { width: headWidth, height: headHeight, cheeks, chin, ears } = host.head;
  head.scale.set(headWidth, headHeight, (1 + headWidth) / 2);
  const skull = new Mesh(shapeJaw(new SphereGeometry(HEAD_R, 40, 24), cheeks, chin), skin);
  const faceMesh = new Mesh(
    shapeJaw(
      new SphereGeometry(HEAD_R * 1.004, 40, 24, Math.PI * 1.5 - FACE_WIDTH / 2, FACE_WIDTH, FACE_TOP, FACE_HEIGHT),
      cheeks,
      chin,
    ),
    faceMaterial,
  );
  head.add(skull, faceMesh);
  for (const x of [-1, 1]) {
    const ear = new Mesh(new SphereGeometry(0.22, 10, 8), skin);
    ear.scale.set(0.6 * ears, ears, 0.8 * ears);
    ear.position.set(x * HEAD_R * 0.97, -0.08, 0.05);
    head.add(ear);
  }
  head.add(
    host.cap
      ? createCap(toon(host.cap), toon(new Color(host.cap).multiplyScalar(0.8)), toon(new Color(host.cap).multiplyScalar(0.8)), hair, logo)
      : createHair(hair),
  );
  upper.add(head);

  let stride = 0;
  let runAmount = 0;
  let swingT = Infinity;
  let swingSide: 1 | -1 = 1;
  let cheerT = Infinity;
  let slumpT = Infinity;
  let gaze = 0;

  function update(dt: number, speed: number, ball: { x: number; y: number; z: number } | null) {
    swingT += dt;
    cheerT += dt;
    slumpT += dt;
    runAmount = ease(runAmount, clamp(speed / 9, 0, 1), 12, dt);
    stride += dt * (4 + 8 * runAmount);

    // Running: legs stride, arms pump against them, the body bobs.
    const s = Math.sin(stride) * runAmount;
    legL.rotation.x = s * 0.7;
    legRight.rotation.x = -s * 0.7;
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
    head.rotation.x = ease(head.rotation.x, gaze - 0.45 * droop, 14, dt);
    upper.rotation.x = ease(upper.rotation.x, -0.15 * droop, 14, dt);
    for (const [pivot, to] of [
      [armLeft, leftArm],
      [armRight, rightArm],
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
      skin.emissive.copy(color);
    },
    setGaze(angle) {
      gaze = angle;
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
