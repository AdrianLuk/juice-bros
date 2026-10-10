import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PerspectiveCamera, Vector3 } from "three";

import type { Vec } from "./rules.ts";
import { dragOnCourt, playView } from "./view.ts";

/** The game's camera on a screen of this shape. */
function cameraFor(aspect: number) {
  const { pose, fovY } = playView(aspect);
  const camera = new PerspectiveCamera(fovY, aspect, 0.5, 400);
  camera.position.copy(pose.position);
  camera.quaternion.copy(pose.quaternion);
  camera.updateMatrixWorld();
  return camera;
}

/** Where a point on the court's floor, in feet, lands on screen. */
function onScreen(camera: PerspectiveCamera, at: Vec) {
  const p = new Vector3(at.x, 0, at.z).project(camera);
  return { x: p.x, y: p.y };
}

const close = (a: number, b: number) => assert.ok(Math.abs(a - b) < 5e-7, `${a} ≈ ${b}`);

for (const [name, aspect] of Object.entries({ phone: 0.46, desktop: 1.6 })) {
  describe(`the court on a ${name}`, () => {
    const camera = cameraFor(aspect);

    it("holds both baselines in the frame", () => {
      for (const at of [{ x: -10, z: 22 }, { x: 10, z: 22 }, { x: -10, z: -22 }, { x: 10, z: -22 }]) {
        const { x, y } = onScreen(camera, at);
        assert.ok(Math.abs(x) <= 1 && Math.abs(y) <= 1, `${JSON.stringify(at)} on screen`);
      }
    });

    it("moves the player's image exactly as the finger moved, wherever they stand", () => {
      for (const from of [{ x: 0, z: 24 }, { x: -6, z: 14 }, { x: 9, z: 8 }]) {
        for (const by of [{ x: 0.05, y: 0 }, { x: 0, y: 0.04 }, { x: -0.03, y: -0.05 }]) {
          const moved = dragOnCourt(camera, from, by)!;
          const before = onScreen(camera, from);
          const after = onScreen(camera, { x: from.x + moved.x, z: from.z + moved.z });
          close(after.x - before.x, by.x);
          close(after.y - before.y, by.y);
        }
      }
    });

    it("moves toward the net as the finger moves up, and right as it moves right", () => {
      const up = dragOnCourt(camera, { x: 0, z: 18 }, { x: 0, y: 0.05 })!;
      assert.ok(up.z < 0);
      assert.ok(Math.abs(up.x) < 1e-6);
      assert.ok(dragOnCourt(camera, { x: 0, z: 18 }, { x: 0.05, y: 0 })!.x > 0);
    });

    it("goes nowhere past the horizon", () => {
      assert.equal(dragOnCourt(camera, { x: 0, z: 18 }, { x: 0, y: 3 }), null);
    });
  });
}
