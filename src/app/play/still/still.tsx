"use client";

import { useEffect, useRef } from "react";
import {
  Box3,
  Color,
  DirectionalLight,
  Fog,
  HemisphereLight,
  Mesh,
  CircleGeometry,
  MeshBasicMaterial,
  Object3D,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  TextureLoader,
  Vector3,
  WebGLRenderer,
} from "three";

import { HOSTS, type HostId } from "@/components/apps/rally/hosts";
import { createMii } from "@/components/apps/rally/mii";
import { COLORS, FIGURE_SCALE, createCourt, jerseyFont, loadFace } from "@/components/apps/rally/scene";

export const STILL = { width: 1440, height: 900 };

/**
 * Where each host stands, in the game's feet (z toward Adrian's baseline),
 * and how far they turn from facing the net toward the camera, so their faces
 * and kit show instead of a profile.
 */
const STAND: Record<HostId, { x: number; z: number; turn: number }> = {
  adrian: { x: 0.6, z: 8.5, turn: -1.2 },
  daven: { x: -0.6, z: -8.5, turn: Math.PI + 0.8 },
};
/** Where Adrian reaches for the ball, in his own frame (x to his right, y up, z behind him). */
const REACH = { x: 1.5, y: 4.2, z: -1.3 };
/** The ball's height over the net at the top of its flight. */
const PEAK = 7.2;

/**
 * Renders the Play teaser's still (`components/bx/play-teaser.tsx`) from the
 * game's own court and Mii figures, seen from beside the court. It leaves the
 * image and the ball's flight in screen pixels on `window.__playStill` for
 * `scripts/render-play-teaser.mts`, which writes them into the repo. The ball
 * itself is not drawn: the teaser animates it over the image.
 */
export function Still() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const renderer = new WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
      renderer.setPixelRatio(1);
      renderer.setSize(STILL.width, STILL.height, false);
      renderer.domElement.style.width = "100%";
      ref.current!.append(renderer.domElement);

      const scene = new Scene();
      scene.background = new Color(COLORS.sky);
      scene.fog = new Fog(COLORS.sky, 70, 140);
      scene.add(new HemisphereLight("#dfe8f5", "#1a1d22", 1.6));
      const sun = new DirectionalLight("#ffffff", 2.2);
      // From over the camera's shoulder, so the faces turned toward it are lit.
      sun.position.set(24, 30, 10);
      scene.add(sun, createCourt());

      const font = await jerseyFont();
      const shadow = new MeshBasicMaterial({ color: COLORS.shadow, transparent: true, opacity: 0.45 });
      const paddles = {} as Record<HostId, Vector3>;
      for (const id of ["adrian", "daven"] as const) {
        const host = HOSTS[id];
        const face = await loadFace(id);
        let logo = null;
        if (host.capLogo) {
          logo = await new TextureLoader().loadAsync(host.capLogo);
          logo.colorSpace = SRGBColorSpace;
        }
        const mii = createMii(host, face.texture, font, logo);
        mii.setSkin(face.skin);
        mii.setGaze(0.08);
        const { x, z, turn } = STAND[id];
        mii.group.scale.setScalar(FIGURE_SCALE);
        mii.group.position.set(x, 0, z);
        mii.group.rotation.y = turn;
        // Settle, then freeze Adrian halfway through his swing.
        // Daven waits in the ready stance; Adrian reaches for the ball and swings.
        for (let i = 0; i < 60; i++) mii.update(1 / 60, 0, id === "adrian" ? REACH : null);
        if (id === "adrian") {
          mii.swing(1);
          for (let i = 0; i < 9; i++) mii.update(1 / 60, 0, REACH);
        }
        const feet = new Mesh(new CircleGeometry(1, 24).rotateX(-Math.PI / 2), shadow);
        feet.scale.setScalar(1.1 * FIGURE_SCALE);
        feet.position.set(x, 0.04, z);
        scene.add(mii.group, feet);
        // The ball flies between the paddles' centres. The paddle is built from
        // extruded meshes, as the cap's bill is, so take the lowest such group.
        mii.group.updateMatrixWorld(true);
        const groups = new Set<Object3D>();
        mii.group.traverse((o) => {
          if (o instanceof Mesh && o.geometry.type === "ExtrudeGeometry" && o.parent) groups.add(o.parent);
        });
        const centres = [...groups].map((g) => new Box3().setFromObject(g).getCenter(new Vector3()));
        paddles[id] = centres.reduce((low, c) => (c.y < low.y ? c : low));
      }

      const camera = new PerspectiveCamera(22, STILL.width / STILL.height, 0.5, 400);
      camera.position.set(42, 14, 15);
      camera.lookAt(0, 1.6, 0);
      camera.updateMatrixWorld();
      renderer.render(scene, camera);
      if (cancelled) return;

      const px = (v: Vector3) => {
        const p = v.clone().project(camera);
        return { x: Math.round(((p.x + 1) / 2) * STILL.width), y: Math.round(((1 - p.y) / 2) * STILL.height) };
      };
      const from = paddles.adrian;
      const to = paddles.daven;
      const ground = (v: Vector3) => new Vector3(v.x, 0, v.z);
      const top = from.clone().lerp(to, 0.5).setY(PEAK);
      (window as unknown as { __playStill: unknown }).__playStill = {
        image: renderer.domElement.toDataURL("image/png"),
        flight: {
          ...STILL,
          from: px(from),
          to: px(to),
          fromGround: px(ground(from)),
          toGround: px(ground(to)),
          // Where the straight line between the paddles is at its midpoint, and where the ball is then.
          mid: px(from.clone().lerp(to, 0.5)),
          top: px(top),
        },
      };
      ref.current!.dataset.ready = "true";
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return <div ref={ref} className="mx-auto w-full max-w-5xl" />;
}
