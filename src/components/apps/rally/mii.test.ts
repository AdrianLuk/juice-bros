import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DoubleSide, Mesh, MeshBasicMaterial, Raycaster, Vector3, type BufferGeometry } from "three";

import { HOSTS } from "./hosts.ts";
import { hairGeometry, skullGeometry } from "./mii.ts";

const head = HOSTS.adrian.head;

/** How far the outline seen from the front reaches toward `degrees` (0 his left, 90 up). */
function reach(geometry: BufferGeometry, degrees: number) {
  const a = (degrees * Math.PI) / 180;
  const position = geometry.getAttribute("position");
  let most = -Infinity;
  for (let i = 0; i < position.count; i++) {
    most = Math.max(most, position.getX(i) * Math.cos(a) + position.getY(i) * Math.sin(a));
  }
  return most;
}

/** The top of the outline seen from the front, `x` across from the middle. */
function topAt(geometry: BufferGeometry, x: number) {
  const position = geometry.getAttribute("position");
  let most = -Infinity;
  for (let i = 0; i < position.count; i++) {
    if (Math.abs(position.getX(i) - x) < 0.03) most = Math.max(most, position.getY(i));
  }
  return most;
}

/** How far out from the head's centre a surface lies in direction `dir`, or null where it isn't. */
function depth(mesh: Mesh, dir: Vector3) {
  const [hit] = new Raycaster(new Vector3(), dir).intersectObject(mesh);
  return hit?.distance ?? null;
}

describe("Adrian's buzz cut", () => {
  const hair = hairGeometry(head);

  it("is squarer than a round head from the front, full at 10 and 2 o'clock", () => {
    // An ellipse through the top and sides reaches this far at 45 degrees; a square, 1.41 times as far.
    const round = Math.sqrt((reach(hair, 0) ** 2 + reach(hair, 90) ** 2) / 2);
    for (const corner of [45, 135]) {
      const squareness = reach(hair, corner) / round;
      assert.ok(squareness > 1.05, `at ${corner} degrees, ${squareness.toFixed(3)} times an ellipse`);
    }
  });

  it("is flat on top", () => {
    const side = reach(hair, 0);
    // A dome falls to 0.87 of its height halfway out to the side.
    const fall = topAt(hair, side / 2) / topAt(hair, 0);
    assert.ok(fall > 0.95, `halfway out, ${fall.toFixed(3)} of the top's height`);
  });

  it("covers the skull everywhere it grows, with no skin through at the crown or the nape", () => {
    const surface = (geometry: BufferGeometry) => new Mesh(geometry, new MeshBasicMaterial({ side: DoubleSide }));
    const skull = surface(skullGeometry(head));
    const layers = [surface(hair), surface(hairGeometry(head, "fuzz"))];
    const dir = new Vector3();
    let closest = Infinity;
    for (let up = -60; up <= 90; up += 3) {
      for (let round = 0; round < 360; round += 6) {
        const u = (up * Math.PI) / 180;
        const r = (round * Math.PI) / 180;
        dir.set(Math.cos(u) * Math.sin(r), Math.sin(u), -Math.cos(u) * Math.cos(r));
        for (const layer of layers) {
          const out = depth(layer, dir);
          if (out === null) continue;
          closest = Math.min(closest, out - depth(skull, dir)!);
        }
      }
    }
    assert.ok(closest > 0.02, `the hair comes within ${closest.toFixed(3)} ft of the skull`);
  });
});
