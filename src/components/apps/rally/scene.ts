import {
  BoxGeometry,
  CanvasTexture,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  Fog,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  MeshToonMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  SphereGeometry,
  SRGBColorSpace,
  WebGLRenderer,
  type Material,
} from "three";

import { HOSTS, type HostId } from "./hosts";
import { COURT } from "./lib/court";
import { type Game, type Side, type Vec } from "./lib/rules";
import { dragOnCourt, playView } from "./lib/view";
import { createMii, placeholderFace, type Mii } from "./mii";

/**
 * The Rally game's court, drawn with Three.js on a canvas of its own: the
 * court and its net in feet, the two hosts as Mii-style figures, the ball
 * and its shadow. The camera stands behind the player's baseline, framed by
 * `playView` for the canvas's shape. It draws only when asked: the page
 * steps the game and calls `draw` each frame while it plays.
 */
export type RallyView = {
  /** Draws the game as it stands now; `dt` is the real time since the last draw. */
  draw(game: Game, dt: number): void;
  /** Cheers and slumps on: off in slow mode. */
  setEffects(on: boolean): void;
  /** Who plays: the player's host and the opponent's. */
  setHosts(player: HostId): void;
  /** How far a touch drag moves the player, in feet; null past the horizon. */
  drag(from: Vec, by: { x: number; y: number }): Vec | null;
  dispose(): void;
};

const BALL_RADIUS = 0.42;
/** The hosts drawn larger than life, as the ball is, so they read from the baseline. */
const FIGURE_SCALE = 1.35;
/** The margin round a face image's features on the head, as a fraction of its side. */
const FACE_INSET = 0.03;
const COLORS = {
  sky: "#08090b",
  floor: "#121a22",
  court: "#1f4f7a",
  kitchen: "#2a6596",
  line: "#f2f4f6",
  net: "#0d0f12",
  ball: "#e3f04a",
  shadow: "#000000",
};

/** A flat strip on the floor, `y` above it so it never flickers into what's under it. */
function strip(width: number, length: number, color: string, x: number, z: number, y: number) {
  const mesh = new Mesh(
    new PlaneGeometry(width, length).rotateX(-Math.PI / 2),
    new MeshBasicMaterial({ color }),
  );
  mesh.position.set(x, y, z);
  return mesh;
}

function createCourt() {
  const group = new Group();
  const halfW = COURT.width / 2;
  const half = COURT.length / 2;
  const k = COURT.kitchen;
  group.add(
    strip(120, 140, COLORS.floor, 0, 0, 0),
    strip(COURT.width + 10, COURT.length + 16, COLORS.court, 0, 0, 0.01),
    strip(COURT.width, k * 2, COLORS.kitchen, 0, 0, 0.02),
  );
  const line = 0.17;
  const lines: [number, number, number, number][] = [
    // Baselines, kitchen lines, sidelines, centre lines.
    [COURT.width + line, line, 0, half],
    [COURT.width + line, line, 0, -half],
    [COURT.width, line, 0, k],
    [COURT.width, line, 0, -k],
    [line, COURT.length, halfW, 0],
    [line, COURT.length, -halfW, 0],
    [line, half - k, 0, (half + k) / 2],
    [line, half - k, 0, -(half + k) / 2],
  ];
  for (const [w, l, x, z] of lines) group.add(strip(w, l, COLORS.line, x, z, 0.03));

  // The net: posts outside the sidelines, the mesh, the white tape along its top.
  const postX = halfW + COURT.postOut;
  const net = new Mesh(
    new PlaneGeometry(postX * 2, COURT.netHeight - 0.3),
    new MeshBasicMaterial({ color: COLORS.net, transparent: true, opacity: 0.72 }),
  );
  net.position.y = (COURT.netHeight - 0.3) / 2 + 0.3;
  const tape = new Mesh(
    new BoxGeometry(postX * 2, 0.22, 0.06),
    new MeshBasicMaterial({ color: COLORS.line }),
  );
  tape.position.y = COURT.netHeight;
  group.add(net, tape);
  for (const x of [-postX, postX]) {
    const post = new Mesh(
      new CylinderGeometry(0.14, 0.14, COURT.postHeight, 10),
      new MeshToonMaterial({ color: "#2b3036" }),
    );
    post.position.set(x, COURT.postHeight / 2, 0);
    group.add(post);
  }
  return group;
}

/** The font the jersey names are set in: the site's condensed display face. */
async function jerseyFont() {
  const family = getComputedStyle(document.body).getPropertyValue("--font-saira-condensed").trim();
  const font = family ? `${family}, sans-serif` : "sans-serif";
  try {
    await document.fonts.load(`800 104px ${font}`);
  } catch {
    // The fallback face is fine.
  }
  return font;
}

/**
 * A host's cartoon face, and the skin colour round it (its top-left pixel),
 * so the rest of the head matches. The stand-in when they have none yet.
 */
async function loadFace(id: HostId): Promise<{ texture: CanvasTexture; skin: Color }> {
  const host = HOSTS[id];
  if (!host.face) return { texture: placeholderFace(host), skin: new Color(host.skin) };
  const image = new Image();
  image.src = host.face;
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(image, 0, 0, 512, 512);
  const [r, g, b] = ctx.getImageData(4, 4, 1, 1).data;
  // The features run nearly edge to edge: inset them on their own skin, so
  // the glasses sit on the front of the head instead of wrapping to the ears.
  ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
  ctx.fillRect(0, 0, 512, 512);
  ctx.drawImage(image, 512 * FACE_INSET, 512 * FACE_INSET, 512 * (1 - 2 * FACE_INSET), 512 * (1 - 2 * FACE_INSET));
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return { texture, skin: new Color(`rgb(${r}, ${g}, ${b})`) };
}

/** Throws where WebGL isn't available: the page says the game can't run. */
export async function createRallyView(container: HTMLElement, player: HostId): Promise<RallyView> {
  const renderer = new WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.domElement.style.display = "block";
  renderer.domElement.style.width = "100%";
  renderer.domElement.style.height = "100%";
  container.append(renderer.domElement);

  const scene = new Scene();
  scene.background = new Color(COLORS.sky);
  scene.fog = new Fog(COLORS.sky, 70, 140);
  scene.add(new HemisphereLight("#dfe8f5", "#1a1d22", 1.6));
  const sun = new DirectionalLight("#ffffff", 2.2);
  sun.position.set(-12, 30, 18);
  scene.add(sun, createCourt());

  const camera = new PerspectiveCamera(40, 1, 0.5, 400);

  const ball = new Mesh(
    new SphereGeometry(BALL_RADIUS, 20, 14),
    new MeshToonMaterial({ color: COLORS.ball }),
  );
  const shadowGeometry = new CircleGeometry(1, 24).rotateX(-Math.PI / 2);
  const shadowMaterial = new MeshBasicMaterial({ color: COLORS.shadow, transparent: true, opacity: 0.45 });
  const ballShadow = new Mesh(shadowGeometry, shadowMaterial);
  scene.add(ball, ballShadow);

  const font = await jerseyFont();
  const faces = await Promise.all([loadFace("adrian"), loadFace("daven")]);
  const figures: Record<HostId, Mii> = {
    adrian: createMii(HOSTS.adrian, faces[0].texture, font),
    daven: createMii(HOSTS.daven, faces[1].texture, font),
  };
  for (const { texture } of faces) texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  figures.adrian.setSkin(faces[0].skin);
  figures.daven.setSkin(faces[1].skin);
  const feetShadows = {} as Record<HostId, Mesh>;
  for (const id of ["adrian", "daven"] as const) {
    figures[id].group.scale.setScalar(FIGURE_SCALE);
    const shadow = new Mesh(shadowGeometry, shadowMaterial);
    shadow.scale.setScalar(1.1 * FIGURE_SCALE);
    feetShadows[id] = shadow;
    scene.add(figures[id].group, shadow);
  }

  let sides: Record<Side, HostId> = { player, ai: player === "adrian" ? "daven" : "adrian" };
  let effects = true;
  let last: Game | null = null;

  function resize() {
    const { clientWidth: width, clientHeight: height } = container;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    const { pose, fovY } = playView(width / height);
    camera.aspect = width / height;
    camera.fov = fovY;
    camera.position.copy(pose.position);
    camera.quaternion.copy(pose.quaternion);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    if (last) draw(last, 0);
  }
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  resize();

  function draw(game: Game, dt: number) {
    for (const side of ["player", "ai"] as const) {
      const figure = figures[sides[side]];
      const at = game[side];
      const was = last?.[side] ?? at;
      const speed = dt > 0 ? Math.hypot(at.x - was.x, at.z - was.z) / dt : 0;
      // The near player faces the net (-z); the far one turns to face it too.
      const facing = side === "player" ? 1 : -1;
      figure.group.position.set(at.x, 0, at.z);
      figure.group.rotation.y = side === "player" ? 0 : Math.PI;
      // The far host looks up at the camera, so their face meets the player's.
      figure.setGaze(side === "ai" ? 0.32 : 0);
      feetShadows[sides[side]].position.set(at.x, 0.04, at.z);
      const rel = {
        x: facing * (game.ball.x - at.x),
        y: game.ball.y,
        z: facing * (at.z - game.ball.z),
      };
      const near = game.phase === "rally" && Math.hypot(rel.x, rel.z) < 10;
      for (const event of game.events) {
        if ((event.type === "hit" || event.type === "serve") && event.side === side) {
          figure.swing(rel.x >= -0.3 ? 1 : -1);
        }
        if (event.type === "point" && effects) {
          if (event.winner === side) figure.cheer();
          else figure.slump();
        }
      }
      figure.update(dt, speed, near ? rel : null);
    }
    const { x, y, z } = game.ball;
    ball.position.set(x, y + BALL_RADIUS, z);
    ballShadow.position.set(x, 0.05, z);
    ballShadow.scale.setScalar(BALL_RADIUS * Math.max(0.5, 1 - y / 14));
    last = game;
    renderer.render(scene, camera);
  }

  return {
    draw,
    setEffects(on) {
      effects = on;
    },
    setHosts(next) {
      sides = { player: next, ai: next === "adrian" ? "daven" : "adrian" };
      if (last) draw(last, 0);
    },
    drag: (from, by) => dragOnCourt(camera, from, by),
    dispose() {
      observer.disconnect();
      figures.adrian.dispose();
      figures.daven.dispose();
      const materials = new Set<Material>();
      scene.traverse((object) => {
        if (object instanceof Mesh) {
          object.geometry.dispose();
          materials.add(object.material as Material);
        }
      });
      for (const material of materials) material.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
