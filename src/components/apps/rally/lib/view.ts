import { Matrix4, Plane, Quaternion, Ray, Vector3, type Camera } from "three";

import type { Vec } from "./rules.ts";

/**
 * The game's camera and its touch drag, in the court's feet (the court on
 * the floor at y = 0, its net across z = 0). Ported from the portfolio's
 * Rally game, where the court stood in a bigger world; here it is the world.
 */

export type Pose = { position: Vector3; quaternion: Quaternion };

/**
 * Where the camera stands: raised behind the player's baseline on the
 * centre line, aiming down the court; on a screen taller than it is wide,
 * higher and further back.
 */
const VIEW = {
  landscape: { height: 19, back: 41, aim: -3 },
  portrait: { height: 30, back: 46, aim: -2 },
};

/**
 * What the frame holds: both baselines with room round them, and the ball's
 * height over the far one, each within `edge` of the frame's middle (in
 * normalised device coordinates). The field of view widens to hold them,
 * from `fovY` up to `fovMax` (vertical, in degrees); past that, the camera
 * backs off along its line of sight, `backOff` of its distance at a time.
 */
const FRAME = {
  points: [
    [-13, 0, 27],
    [13, 0, 27],
    [-11, 0, -23],
    [11, 0, -23],
    [0, 9, -23],
  ],
  edge: 0.94,
  fovY: 24,
  fovMax: 60,
  backOff: 0.05,
} as const;

const UP = new Vector3(0, 1, 0);

/** Where `point` lands across and up the frame of a camera at `pose`, in NDC. */
function ndc(pose: Pose, point: Vector3, fovY: number, aspect: number) {
  const local = point.clone().sub(pose.position).applyQuaternion(pose.quaternion.clone().invert());
  const tanY = Math.tan(((fovY / 2) * Math.PI) / 180);
  const depth = -local.z;
  return { x: local.x / (depth * tanY * aspect), y: local.y / (depth * tanY), depth };
}

/** The camera for a screen of this shape: the narrowest view that holds the whole court. */
export function playView(aspect: number): { pose: Pose; fovY: number } {
  const view = aspect < 1 ? VIEW.portrait : VIEW.landscape;
  const aim = new Vector3(0, 0, view.aim);
  const from = new Vector3(0, view.height, view.back);
  const frame = FRAME.points.map(([x, y, z]) => new Vector3(x, y, z));
  for (let back = 1; ; back += FRAME.backOff) {
    const position = aim.clone().lerp(from, back);
    const look = new Matrix4().lookAt(position, aim, UP);
    const pose = { position, quaternion: new Quaternion().setFromRotationMatrix(look) };
    for (let fovY = FRAME.fovY; fovY <= FRAME.fovMax; fovY++) {
      const fits = frame.every((point) => {
        const { x, y, depth } = ndc(pose, point, fovY, aspect);
        return depth > 0 && Math.abs(x) <= FRAME.edge && Math.abs(y) <= FRAME.edge;
      });
      if (fits) return { pose, fovY };
    }
  }
}

const FLOOR = new Plane(new Vector3(0, 1, 0), 0);

/**
 * How far a touch drag moves the player, in feet: as far as moves their
 * image on screen with the finger, so the player keeps pace with it at any
 * depth, though the court shrinks away from the camera. `from` is where the
 * player is heading, `by` the finger's movement in normalised device
 * coordinates. Null where the finger would take them past the horizon.
 */
export function dragOnCourt(camera: Camera, from: Vec, by: { x: number; y: number }): Vec | null {
  const start = new Vector3(from.x, 0, from.z);
  const target = start.clone().project(camera);
  target.x += by.x;
  target.y += by.y;
  const origin = new Vector3().setFromMatrixPosition(camera.matrixWorld);
  const direction = target.unproject(camera).sub(origin).normalize();
  const hit = new Ray(origin, direction).intersectPlane(FLOOR, new Vector3());
  if (!hit) return null;
  return { x: hit.x - start.x, z: hit.z - start.z };
}
