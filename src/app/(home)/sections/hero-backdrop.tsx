"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The homepage hero's "citrus energy field" - a full-bleed WebGL layer that
 * screen-blends over the host photo: domain-warped fractal caustics in brand
 * black / orange / yellow, like light moving through a glass of juice. It
 * refracts toward the pointer and rings out from a click, and ignites once on
 * load before settling.
 *
 * Progressive enhancement, in order of fallback:
 *  - No WebGL, or context lost -> the canvas never mounts; a static CSS glow
 *    (rendered by the Hero itself) carries the idea.
 *  - `prefers-reduced-motion: reduce` -> one static frame is drawn, no rAF, no
 *    pointer listeners. The look, none of the movement.
 *  - Otherwise -> animated, but paused whenever the tab is hidden or the hero
 *    has scrolled out of view, and capped at ~0.7x internal resolution (the
 *    effect is soft, so the pixels don't need to be there).
 */

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

const FRAG = `
precision highp float;

uniform vec2 uRes;
uniform float uTime;
uniform float uIntro;      // 1 -> 0 over the first ~1.6s
uniform vec2 uPointer;     // 0..1 (gl space: y up)
uniform float uPointerAmp; // 0..1, eases with pointer presence
uniform vec3 uRipples[4];  // xy = center (0..1), z = age in seconds (<0 = off)

varying vec2 vUv;

vec2 hash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(dot(hash2(i + vec2(0.0, 0.0)), f - vec2(0.0, 0.0)),
        dot(hash2(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0)), u.x),
    mix(dot(hash2(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0)),
        dot(hash2(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0)), u.x),
    u.y);
}

float fbm(vec2 p) {
  float a = 0.5;
  float s = 0.0;
  for (int i = 0; i < 4; i++) {
    s += a * noise(p);
    p *= 2.03;
    a *= 0.5;
  }
  return s;
}

void main() {
  vec2 uv = vUv;
  float aspect = uRes.x / max(uRes.y, 1.0);
  vec2 p = (uv - 0.5) * vec2(aspect, 1.0);

  float t = uTime * 0.05;

  // Slow two-pass domain warp: broad flowing light, not busy crackle.
  vec2 q = vec2(
    fbm(p * 1.1 + vec2(0.0, t)),
    fbm(p * 1.1 + vec2(4.4, 1.3) - t * 0.8));
  vec2 r = vec2(
    fbm(p * 1.7 + 1.4 * q + vec2(1.7, 9.2) + t * 0.9),
    fbm(p * 1.7 + 1.4 * q + vec2(8.3, 2.8) - t * 0.6));

  // Pointer: a gentle warm bloom that follows the cursor and nudges the flow.
  vec2 pc = (uPointer - 0.5) * vec2(aspect, 1.0);
  float pd = length(p - pc);
  float lens = exp(-pd * pd * 4.0) * uPointerAmp;
  r += normalize(p - pc + 1e-4) * lens * 0.2;

  // Click ripples: a soft expanding ring, low amplitude.
  for (int i = 0; i < 4; i++) {
    float age = uRipples[i].z;
    if (age < 0.0) continue;
    vec2 rc = (uRipples[i].xy - 0.5) * vec2(aspect, 1.0);
    float d = length(p - rc);
    float ring = sin(d * 16.0 - age * 7.0) * exp(-d * 3.5) * exp(-age * 2.4);
    r += normalize(p - rc + 1e-4) * ring * 0.06;
  }

  float flow = fbm(p * 1.0 + 1.3 * r + vec2(0.0, t));

  // One set of soft, thick caustic ribbons drifting slowly - not filaments.
  float ribbon = sin(flow * 6.2831 + (r.x - r.y) * 2.0 - t * 2.4);
  ribbon = smoothstep(0.25, 0.95, ribbon * 0.5 + 0.5);

  float body = smoothstep(-0.45, 0.75, flow);

  // Brand-locked ramp. Amber is the ribbon highlight - stops short of pure yellow.
  vec3 ember = vec3(0.30, 0.08, 0.02);
  vec3 orange = vec3(0.949, 0.396, 0.133);
  vec3 amber = vec3(0.98, 0.66, 0.10);

  vec3 col = vec3(0.0);
  col += ember * body * 0.68;
  col += orange * smoothstep(0.25, 1.0, body) * 0.44;
  col += amber * ribbon * body * 0.36;
  col += orange * lens * 0.28;
  col += ember * (uIntro * uIntro) * 0.34;

  // Spatial mask: pool the light in a central corridor and a low band, and
  // damp it hard over the left/right thirds (the hosts) and the top edge.
  vec2 c = uv - 0.5;
  float sideKeep = smoothstep(0.47, 0.05, abs(c.x));
  float topDamp = smoothstep(0.55, -0.05, c.y);
  float bottom = smoothstep(0.05, -0.5, c.y);
  float zone = sideKeep * mix(0.55, 1.0, bottom) * mix(0.6, 1.0, topDamp);

  // Soft horizontal dip through the headline band so the type stays clean.
  vec2 tc = c * vec2(1.3, 3.1);
  float textDip = 1.0 - 0.5 * exp(-dot(tc, tc) * 5.0);

  float vig = smoothstep(1.1, 0.4, length(c * vec2(1.0, 1.22)));

  col *= zone * textDip * vig;

  // The pointer bloom rides on top of the mask: the whole hero answers the
  // cursor, but softly enough that it never lights a face to a hotspot.
  col += orange * lens * 0.22 * vig;

  // Fine grain so the gradients never band under the screen blend.
  col += hash2(uv * uRes + t).x * 0.01;

  gl_FragColor = vec4(max(col, vec3(0.0)), 1.0);
}
`;

const RIPPLE_COUNT = 4;
const RIPPLE_LIFETIME = 2.6;

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.warn("[HeroBackdrop] shader compile failed:", gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

export function HeroBackdrop() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl =
      canvas.getContext("webgl", { antialias: false, alpha: false, depth: false }) ??
      (canvas.getContext("experimental-webgl", {
        antialias: false,
        alpha: false,
        depth: false,
      }) as WebGLRenderingContext | null);
    if (!gl) return;

    const vert = compile(gl, gl.VERTEX_SHADER, VERT);
    const frag = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vert || !frag) return;

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vert);
    gl.attachShader(program, frag);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.warn("[HeroBackdrop] link failed:", gl.getProgramInfoLog(program));
      return;
    }
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(program, "aPos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(program, "uRes");
    const uTime = gl.getUniformLocation(program, "uTime");
    const uIntro = gl.getUniformLocation(program, "uIntro");
    const uPointer = gl.getUniformLocation(program, "uPointer");
    const uPointerAmp = gl.getUniformLocation(program, "uPointerAmp");
    const uRipples = gl.getUniformLocation(program, "uRipples");

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const scale = dpr * 0.7;

    let width = 1;
    let height = 1;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = Math.max(1, Math.round(rect.width * scale));
      height = Math.max(1, Math.round(rect.height * scale));
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
    };
    resize();

    // Eased pointer state.
    const pointer = { x: 0.5, y: 0.55, tx: 0.5, ty: 0.55, amp: 0, tamp: 0 };
    const ripples = new Float32Array(RIPPLE_COUNT * 3).fill(-1);
    let rippleHead = 0;

    const draw = (timeSeconds: number, introSeconds: number) => {
      pointer.x += (pointer.tx - pointer.x) * 0.09;
      pointer.y += (pointer.ty - pointer.y) * 0.09;
      pointer.amp += (pointer.tamp - pointer.amp) * 0.09;

      const intro = Math.max(0, 1 - introSeconds / 1.6);
      gl.uniform2f(uRes, width, height);
      gl.uniform1f(uTime, timeSeconds);
      gl.uniform1f(uIntro, intro * intro);
      gl.uniform2f(uPointer, pointer.x, pointer.y);
      gl.uniform1f(uPointerAmp, pointer.amp);
      gl.uniform3fv(uRipples, ripples);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    let raf = 0;
    let start = performance.now();
    let last = start;
    let running = false;

    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, 1 / 30);
      last = now;
      for (let i = 0; i < RIPPLE_COUNT; i++) {
        const age = ripples[i * 3 + 2];
        if (age >= 0) {
          const next = age + dt;
          ripples[i * 3 + 2] = next > RIPPLE_LIFETIME ? -1 : next;
        }
      }
      // Pointer presence lingers, then fades once the cursor has gone quiet.
      pointer.tamp *= 0.992;
      draw((now - start) / 1000, (now - start) / 1000);
      raf = requestAnimationFrame(frame);
    };

    const play = () => {
      if (running || reduced) return;
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    };
    const pause = () => {
      running = false;
      cancelAnimationFrame(raf);
    };

    // First paint.
    if (reduced) {
      resize();
      draw(6.0, 999);
    } else {
      draw(0, 999);
    }
    requestAnimationFrame(() => setReady(true));

    const onResize = () => {
      resize();
      if (reduced) draw(6.0, 999);
    };
    window.addEventListener("resize", onResize);

    let onMove: ((e: PointerEvent) => void) | undefined;
    let onDown: ((e: PointerEvent) => void) | undefined;
    let io: IntersectionObserver | undefined;
    let onVisibility: (() => void) | undefined;

    if (!reduced) {
      onMove = (e: PointerEvent) => {
        const rect = canvas.getBoundingClientRect();
        pointer.tx = (e.clientX - rect.left) / rect.width;
        pointer.ty = 1 - (e.clientY - rect.top) / rect.height;
        pointer.tamp = 1;
      };
      onDown = (e: PointerEvent) => {
        const rect = canvas.getBoundingClientRect();
        const i = rippleHead % RIPPLE_COUNT;
        ripples[i * 3] = (e.clientX - rect.left) / rect.width;
        ripples[i * 3 + 1] = 1 - (e.clientY - rect.top) / rect.height;
        ripples[i * 3 + 2] = 0;
        rippleHead++;
      };
      const host = canvas.parentElement ?? canvas;
      host.addEventListener("pointermove", onMove);
      host.addEventListener("pointerdown", onDown);

      onVisibility = () => {
        if (document.hidden) pause();
        else play();
      };
      document.addEventListener("visibilitychange", onVisibility);

      io = new IntersectionObserver(
        (entries) => {
          const visible = entries.some((entry) => entry.isIntersecting);
          if (visible && !document.hidden) play();
          else pause();
        },
        { threshold: 0 },
      );
      io.observe(canvas);

      start = performance.now();
      play();
    }

    return () => {
      pause();
      window.removeEventListener("resize", onResize);
      if (onVisibility) document.removeEventListener("visibilitychange", onVisibility);
      io?.disconnect();
      const host = canvas.parentElement ?? canvas;
      if (onMove) host.removeEventListener("pointermove", onMove);
      if (onDown) host.removeEventListener("pointerdown", onDown);
      // Free GL resources but keep the context: canvas.getContext() hands back
      // the same object, and a re-run of this effect (React strict mode in dev,
      // or a fast remount) rebuilds cleanly on top of it. Forcing a context
      // loss here would leave that second run with a dead context.
      gl.deleteProgram(program);
      gl.deleteShader(vert);
      gl.deleteShader(frag);
      gl.deleteBuffer(buffer);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={`pointer-events-none absolute inset-0 z-5 size-full mix-blend-screen transition-opacity duration-900 ease-[cubic-bezier(0.32,0.72,0,1)] ${
        ready ? "opacity-100" : "opacity-0"
      }`}
    />
  );
}
