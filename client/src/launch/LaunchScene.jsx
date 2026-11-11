import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment } from "@react-three/drei";
import { Bloom, EffectComposer, ToneMapping, Vignette } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import { AdditiveBlending, Color, FogExp2, HalfFloatType, MathUtils, NormalBlending, Vector3, WebGLRenderTarget } from "three";
import {
  FAIRING_BASE,
  FairingHalf,
  SPACECRAFT_BASE,
  STAGE1_HEIGHT,
  Spacecraft,
  StageOneModel,
  StageTwoModel,
} from "./Rocket";
import { EnvironmentSky, HAZE, LaunchSite, SkyDome, SUN_DIRECTION } from "./LaunchSite";
import { graphicsProfile } from "../graphics";

export const TIMELINE = {
  holdAt: 4.2,
  armRetract: 3,
  ignition: 4.6,
  liftoff: 6,
  maxQ: 6 + 5,
  separation: 6 + 9,
  secondIgnition: 6 + 9.8,
  fairing: 6 + 12.5,
  seco: 6 + 17,
  payload: 6 + 18.5,
  orbit: 6 + 21,
};

const SPACE = new Color("#000207");
const WAIT_FOR_SCENE_AT = 2.5;

const BURN = TIMELINE.seco - TIMELINE.liftoff;
const shakeAt = (t, throttle) => {
  if (t < TIMELINE.ignition) return 0;
  const s = t - TIMELINE.liftoff;
  const ignition = Math.min(1, (t - TIMELINE.ignition) / 1.4) * 0.7;
  const liftoff = s > 0 ? Math.exp(-s / 6) : 0;
  const maxQ = 0.45 * Math.exp(-Math.pow((s - 5.5) / 1.6, 2));
  const jolt = (at, size, decay) => (t > at ? size * Math.exp(-(t - at) * decay) : 0);
  return (
    Math.max(ignition * (s > 0 ? Math.exp(-s / 6) : 1), liftoff) * throttle +
    maxQ * throttle +
    jolt(TIMELINE.separation, 0.9, 3.5) +
    jolt(TIMELINE.secondIgnition, 0.5, 3) +
    jolt(TIMELINE.fairing, 0.25, 4) +
    jolt(TIMELINE.payload, 0.15, 4)
  );
};
const rawAltitude = (s) => 0.6 * s * s + 0.12 * s * s * s;
const rawSpeed = (s) => 1.2 * s + 0.36 * s * s;
const altitudeAt = (s) => (s <= BURN ? rawAltitude(s) : rawAltitude(BURN) + rawSpeed(BURN) * 0.35 * (s - BURN));
const speedAt = (s) => (s <= BURN ? rawSpeed(s) : rawSpeed(BURN));
const pitchAt = (s) => (s > 3 ? Math.min(0.85, (s - 3) * 0.075) : 0);
const driftAt = (s) => (s > 3 ? 0.035 * Math.pow(Math.min(s, BURN) - 3, 3) + Math.max(0, s - BURN) * 30 : 0);

const phaseAt = (t) => {
  if (t < TIMELINE.ignition) return "countdown";
  if (t < TIMELINE.liftoff) return "ignition";
  if (t < TIMELINE.maxQ - 1) return "liftoff";
  if (t < TIMELINE.maxQ + 2) return "maxq";
  if (t < TIMELINE.separation) return "ascent";
  if (t < TIMELINE.secondIgnition + 1) return "separation";
  if (t < TIMELINE.fairing) return "second";
  if (t < TIMELINE.fairing + 1.6) return "fairing";
  if (t < TIMELINE.seco) return "second";
  if (t < TIMELINE.payload) return "seco";
  if (t < TIMELINE.orbit) return "payload";
  return "orbit";
};

const vertexShader = `
  attribute float aSize;
  attribute float aAlpha;
  attribute vec3 aColor;
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    vAlpha = aAlpha;
    vColor = aColor;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (420.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;

const fragmentShader = `
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    gl_FragColor = vec4(vColor, vAlpha * smoothstep(0.5, 0.0, d));
  }
`;

class Pool {
  constructor(max) {
    this.max = max;
    this.cursor = 0;
    this.pos = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.color = new Float32Array(max * 3);
    this.age = new Float32Array(max);
    this.life = new Float32Array(max);
    this.size = new Float32Array(max);
    this.alpha = new Float32Array(max);
    this.seed = new Float32Array(max);
  }

  spawn(px, py, pz, vx, vy, vz, life) {
    const i = this.cursor;
    this.cursor = (i + 1) % this.max;
    this.pos.set([px, py, pz], i * 3);
    this.vel.set([vx, vy, vz], i * 3);
    this.age[i] = 0;
    this.life[i] = life;
    this.seed[i] = Math.random();
  }
}

const useParticles = (max, blending) => {
  const pool = useMemo(() => new Pool(max), [max]);
  const material = useMemo(
    () => ({
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      blending,
    }),
    [blending],
  );
  return { pool, material };
};

const ParticleMesh = ({ pool, material, geometryRef }) => (
  <points frustumCulled={false}>
    <bufferGeometry ref={geometryRef}>
      <bufferAttribute attach="attributes-position" args={[pool.pos, 3]} />
      <bufferAttribute attach="attributes-aColor" args={[pool.color, 3]} />
      <bufferAttribute attach="attributes-aSize" args={[pool.size, 1]} />
      <bufferAttribute attach="attributes-aAlpha" args={[pool.alpha, 1]} />
    </bufferGeometry>
    <shaderMaterial args={[material]} />
  </points>
);

const flush = (geometry) => {
  if (!geometry) return;
  for (const name of ["position", "aColor", "aSize", "aAlpha"]) {
    geometry.attributes[name].needsUpdate = true;
  }
};

const Flame = ({ sim, stage, length = 1, tint = "orange", quality }) => {
  const geometryRef = useRef();
  const { pool, material } = useParticles(Math.round((stage === 1 ? 900 : 400) * quality.particles), AdditiveBlending);
  const light = useRef();
  const blue = tint === "blue";

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const throttle = stage === 1 ? sim.current.throttle1 : sim.current.throttle2;
    const count = Math.floor(throttle * (stage === 1 ? 950 : 420) * quality.particles * dt + Math.random());
    for (let n = 0; n < count; n++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * (stage === 1 ? 0.28 : 0.14);
      pool.spawn(
        Math.cos(a) * r,
        -0.55,
        Math.sin(a) * r,
        (Math.random() - 0.5) * 1.6,
        -(16 + Math.random() * 8) * length,
        (Math.random() - 0.5) * 1.6,
        0.22 + Math.random() * 0.22,
      );
    }
    for (let i = 0; i < pool.max; i++) {
      if (pool.age[i] >= pool.life[i]) {
        pool.alpha[i] = 0;
        continue;
      }
      pool.age[i] += dt;
      const k = pool.age[i] / pool.life[i];
      const j = i * 3;
      pool.pos[j] += pool.vel[j] * dt;
      pool.pos[j + 1] += pool.vel[j + 1] * dt;
      pool.pos[j + 2] += pool.vel[j + 2] * dt;
      pool.vel[j] *= 1 + dt * 2.2;
      pool.vel[j + 2] *= 1 + dt * 2.2;
      if (blue) {
        pool.color[j] = MathUtils.lerp(0.85, 0.25, k);
        pool.color[j + 1] = MathUtils.lerp(0.92, 0.45, k);
        pool.color[j + 2] = 1;
      } else {
        pool.color[j] = 1;
        pool.color[j + 1] = MathUtils.lerp(0.95, 0.35, Math.min(1, k * 1.4));
        pool.color[j + 2] = MathUtils.lerp(0.75, 0.05, Math.min(1, k * 2));
      }
      pool.alpha[i] = (1 - k) * (blue ? 0.7 : 0.85);
      pool.size[i] = (stage === 1 ? 1.1 : 0.6) + k * (stage === 1 ? 2.4 : 1.2);
    }
    flush(geometryRef.current);
    if (light.current) {
      light.current.intensity = throttle * (stage === 1 ? 140 : 40) * (0.85 + Math.random() * 0.3);
    }
  });

  return (
    <group>
      <ParticleMesh pool={pool} material={material} geometryRef={geometryRef} />
      <pointLight ref={light} position={[0, -1.5, 0]} color={blue ? "#9cc8ff" : "#ff9a3c"} distance={90} decay={1.7} intensity={0} />
    </group>
  );
};

const Smoke = ({ sim, quality }) => {
  const geometryRef = useRef();
  const { pool, material } = useParticles(Math.round(1800 * quality.particles), NormalBlending);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const { throttle1, nozzle, altitude, pitch } = sim.current;
    if (throttle1 > 0.05) {
      const low = altitude < 45;
      const rate = low ? 260 : 70;
      const count = Math.floor(rate * throttle1 * quality.particles * dt + Math.random());
      for (let n = 0; n < count; n++) {
        const spread = low ? 5 : 1.2;
        pool.spawn(
          nozzle.x + (Math.random() - 0.5) * 0.6,
          nozzle.y - 0.8,
          nozzle.z + (Math.random() - 0.5) * 0.6,
          Math.sin(pitch) * -12 + (Math.random() - 0.5) * spread,
          low ? -14 - Math.random() * 6 : -3 - Math.random() * 2,
          (Math.random() - 0.5) * spread,
          low ? 3 + Math.random() * 2.5 : 4 + Math.random() * 2,
        );
      }
    }
    for (let i = 0; i < pool.max; i++) {
      if (pool.age[i] >= pool.life[i]) {
        pool.alpha[i] = 0;
        continue;
      }
      pool.age[i] += dt;
      const k = pool.age[i] / pool.life[i];
      const j = i * 3;
      pool.vel[j] *= 1 - dt * 0.7;
      pool.vel[j + 1] = pool.vel[j + 1] * (1 - dt * 0.9) + dt * 0.8;
      pool.vel[j + 2] *= 1 - dt * 0.7;
      pool.pos[j] += pool.vel[j] * dt;
      pool.pos[j + 1] += pool.vel[j + 1] * dt;
      pool.pos[j + 2] += pool.vel[j + 2] * dt;
      if (pool.pos[j + 1] < 0.6) {
        pool.pos[j + 1] = 0.6;
        const dx = pool.pos[j] || 0.01;
        const dz = pool.pos[j + 2] || 0.01;
        const len = Math.hypot(dx, dz);
        const push = Math.abs(pool.vel[j + 1]) * 0.9 + 2;
        pool.vel[j] += (dx / len) * push;
        pool.vel[j + 2] += (dz / len) * push;
        pool.vel[j + 1] = 0.4;
      }
      const glow = Math.max(0, 1 - k * 6) * throttle1;
      const grey = MathUtils.lerp(0.82, 0.46, k) + pool.seed[i] * 0.06;
      pool.color[j] = grey + glow * 0.5;
      pool.color[j + 1] = grey + glow * 0.18;
      pool.color[j + 2] = grey * 1.02;
      pool.alpha[i] = Math.min(1, k * 8) * (1 - k) * 0.55;
      pool.size[i] = (2.2 + k * 9) * (0.7 + pool.seed[i] * 0.6);
    }
    flush(geometryRef.current);
  });

  return <ParticleMesh pool={pool} material={material} geometryRef={geometryRef} />;
};

const Vent = ({ sim, quality }) => {
  const geometryRef = useRef();
  const { pool, material } = useParticles(Math.round(420 * quality.particles), NormalBlending);
  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const { t, throttle1 } = sim.current;
    if (t > 0.2 && t < TIMELINE.liftoff + 0.4 && sim.current.phase !== "scrubbed") {
      const count = Math.floor(70 * quality.particles * dt + Math.random());
      for (let n = 0; n < count; n++) {
        const a = Math.random() * Math.PI * 2;
        const high = Math.random() < 0.45;
        const y = high ? STAGE1_HEIGHT + 1.6 + Math.random() * 0.6 : STAGE1_HEIGHT * (0.45 + Math.random() * 0.5);
        pool.spawn(Math.cos(a) * 0.44, y + 0.95, Math.sin(a) * 0.44, Math.cos(a) * 1.4, -0.3, Math.sin(a) * 1.4, 1.2 + Math.random() * 1.2);
      }
    }
    for (let i = 0; i < pool.max; i++) {
      if (pool.age[i] >= pool.life[i]) {
        pool.alpha[i] = 0;
        continue;
      }
      pool.age[i] += dt;
      const k = pool.age[i] / pool.life[i];
      const j = i * 3;
      pool.vel[j] *= 1 - dt * 1.2;
      pool.vel[j + 1] -= dt * 0.9;
      pool.vel[j + 2] *= 1 - dt * 1.2;
      pool.pos[j] += pool.vel[j] * dt;
      pool.pos[j + 1] += pool.vel[j + 1] * dt;
      pool.pos[j + 2] += pool.vel[j + 2] * dt;
      const c = 0.9 + pool.seed[i] * 0.08 + throttle1 * 0.1;
      pool.color[j] = c;
      pool.color[j + 1] = c;
      pool.color[j + 2] = c + 0.04;
      pool.alpha[i] = Math.min(1, k * 6) * (1 - k) * 0.4;
      pool.size[i] = 0.5 + k * 2.6;
    }
    flush(geometryRef.current);
  });
  return <ParticleMesh pool={pool} material={material} geometryRef={geometryRef} />;
};

const StageOne = ({ sim, label, quality }) => (
  <group>
    <StageOneModel sim={sim} label={label} shadows={!quality.low} />
    <Flame sim={sim} stage={1} quality={quality} />
  </group>
);

const StageTwo = ({ sim, label, quality }) => (
  <group>
    <StageTwoModel sim={sim} shadows={!quality.low} />
    <group position={[0, -0.6, 0]}>
      <Flame sim={sim} stage={2} tint="blue" length={0.7} quality={quality} />
    </group>
  </group>
);

const SkyStars = ({ sim, quality }) => {
  const ref = useRef();
  const material = useRef();
  const positions = useMemo(() => {
    const count = Math.round(1800 * quality.stars);
    const list = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const u = Math.random() * 2 - 1;
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(1 - u * u);
      list.set([Math.cos(a) * r * 500, Math.abs(u) * 500, Math.sin(a) * r * 500], i * 3);
    }
    return list;
  }, [quality.stars]);
  const { camera } = useThree();
  useFrame(() => {
    ref.current.position.copy(camera.position);
    material.current.opacity = MathUtils.clamp((sim.current.altitude - 30) / 220, 0.08, 1);
  });
  return (
    <points ref={ref} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial ref={material} size={1.6} sizeAttenuation={false} color="#ffffff" transparent depthWrite={false} />
    </points>
  );
};

const PAD_CAMERA = new Vector3(21, 3.5, 40);
const PAD_LOOK = new Vector3(0, 8.5, 0);
const PAD_ANGLE = Math.atan2(PAD_CAMERA.x, PAD_CAMERA.z);
const PAD_RADIUS = Math.hypot(PAD_CAMERA.x, PAD_CAMERA.z);

const Director = ({ sim, outcomeRef, onTelemetry, label, quality, mode }) => {
  const stage1 = useRef();
  const stage2 = useRef();
  const halves = [useRef(), useRef()];
  const craft = useRef();
  const deploy = useRef(0);
  const { camera, scene } = useThree();
  const look = useMemo(() => PAD_LOOK.clone(), []);
  const desired = useMemo(() => new Vector3(), []);
  const offset = useMemo(() => new Vector3(21, 2.5, 40), []);
  const lookOffset = useRef(7.5);
  const lastTick = useRef(0);
  const sep = useRef(null);
  const fairingSep = useRef(null);
  const previous2 = useMemo(() => new Vector3(), []);
  const velocity2 = useMemo(() => new Vector3(), []);
  const pad = mode === "pad";

  useEffect(() => {
    scene.fog = new FogExp2(HAZE.clone(), 0.0025);
    scene.background = null;
    camera.position.copy(PAD_CAMERA);
    camera.lookAt(PAD_LOOK);
    if (pad) sim.current.t = 1.5;
  }, [camera, scene, pad, sim]);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.25);
    const s0 = sim.current;
    const outcome = outcomeRef.current;

    const holding = !pad && outcome === "pending" && s0.t >= TIMELINE.holdAt;
    if (pad) {
      s0.phase = "pad";
    } else if (s0.phase !== "scrubbed") {
      if (outcome === "failed" && s0.t < TIMELINE.ignition) {
        s0.phase = "scrubbed";
      } else if (holding) {
        s0.phase = "hold";
      } else {
        if (s0.ready || s0.t < WAIT_FOR_SCENE_AT) s0.t += dt;
        s0.phase = phaseAt(s0.t);
      }
    }

    const t = s0.t;
    const s = Math.max(0, t - TIMELINE.liftoff);
    const ignitionK = MathUtils.clamp((t - TIMELINE.ignition) / 0.9, 0, 1);
    s0.throttle1 = s0.phase === "scrubbed" || pad ? 0 : t < TIMELINE.separation ? ignitionK : 0;
    const on2 = MathUtils.clamp((t - TIMELINE.secondIgnition) / 0.5, 0, 1);
    const off2 = MathUtils.clamp(1 - (t - TIMELINE.seco) / 0.4, 0, 1);
    s0.throttle2 = t > TIMELINE.secondIgnition ? on2 * off2 : 0;
    s0.mvacHeat = t > TIMELINE.seco ? Math.exp(-(t - TIMELINE.seco) / 2.5) : 0;

    const altitude = altitudeAt(s);
    const pitch = pitchAt(s);
    const x = driftAt(s);
    s0.altitude = altitude;
    s0.speed = speedAt(s);
    s0.pitch = pitch;

    const rocketY = altitude + 0.95;
    const up = new Vector3(-Math.sin(pitch), Math.cos(pitch), 0);

    previous2.copy(stage2.current.position);
    stage2.current.position.set(x, rocketY, 0).addScaledVector(up, STAGE1_HEIGHT);
    stage2.current.rotation.set(0, 0, pitch);
    if (dt > 0) velocity2.copy(stage2.current.position).sub(previous2).divideScalar(dt);

    if (t < TIMELINE.separation) {
      stage1.current.position.set(x, rocketY, 0);
      stage1.current.rotation.set(0, 0, pitch);
    } else {
      if (!sep.current) {
        sep.current = { velocity: up.clone().multiplyScalar(speedAt(s) * 0.6), spin: 0.5 + Math.random() * 0.4 };
      }
      sep.current.velocity.y -= 22 * dt;
      stage1.current.position.addScaledVector(sep.current.velocity, dt);
      stage1.current.rotation.z += sep.current.spin * dt;
      stage1.current.rotation.x += sep.current.spin * 0.4 * dt;
    }
    s0.nozzle.copy(stage1.current.position);

    const side = new Vector3(Math.cos(pitch), Math.sin(pitch), 0);
    halves.forEach((half, i) => {
      const dir = i === 0 ? 1 : -1;
      const h = half.current;
      if (t < TIMELINE.fairing) {
        h.position.copy(stage2.current.position).addScaledVector(up, FAIRING_BASE);
        h.rotation.set(0, 0, pitch);
        return;
      }
      if (!fairingSep.current) {
        fairingSep.current = [1, -1].map((d) => ({
          velocity: velocity2.clone().addScaledVector(side, d * 2.2),
          spin: 0.9 + Math.random() * 0.3,
        }));
      }
      const state2 = fairingSep.current[i];
      state2.velocity.addScaledVector(up, -6 * dt);
      h.position.addScaledVector(state2.velocity, dt);
      h.rotation.z -= dir * state2.spin * dt;
      h.rotation.y += state2.spin * 0.3 * dt;
    });

    const afterPayload = Math.max(0, t - TIMELINE.payload);
    craft.current.position
      .copy(stage2.current.position)
      .addScaledVector(up, SPACECRAFT_BASE + 0.9 * afterPayload + 0.25 * afterPayload * afterPayload);
    craft.current.rotation.set(0, afterPayload * 0.15, pitch);
    deploy.current = MathUtils.clamp((afterPayload - 0.8) / 2.5, 0, 1);

    const focus = afterPayload > 0 ? craft.current.position : t < TIMELINE.separation ? stage1.current.position : stage2.current.position;
    if (pad) {
      const a = PAD_ANGLE + (quality.reducedMotion ? 0 : state.clock.elapsedTime * 0.04);
      desired.set(Math.sin(a) * PAD_RADIUS, PAD_CAMERA.y, Math.cos(a) * PAD_RADIUS);
      camera.position.lerp(desired, 1 - Math.exp(-2 * dt));
      look.lerp(PAD_LOOK, 1 - Math.exp(-3 * dt));
    } else if (s <= 0) {
      camera.position.lerp(PAD_CAMERA, 1 - Math.exp(-3 * dt));
      look.lerp(PAD_LOOK, 1 - Math.exp(-3 * dt));
    } else {
      const k = MathUtils.clamp(s / 8, 0, 1);
      const upper = t >= TIMELINE.separation;
      if (afterPayload > 0) desired.set(3.2, 1.4, 6.5);
      else if (upper) desired.set(10, -2.5, 15);
      else desired.set(MathUtils.lerp(21, 19, k), MathUtils.lerp(2.5, -5, k), MathUtils.lerp(40, 30, k));
      offset.lerp(desired, 1 - Math.exp(-1.5 * dt));
      const target = afterPayload > 0 ? 0.4 : upper ? 3 : MathUtils.lerp(7.5, 8, k);
      lookOffset.current = MathUtils.lerp(lookOffset.current, target, 1 - Math.exp(-2 * dt));
      look.copy(focus).addScaledVector(up, lookOffset.current);
      camera.position.copy(focus).add(offset);
    }

    const shake = quality.reducedMotion || pad ? 0 : shakeAt(t, s0.throttle1);
    s0.shake = shake;
    const time = state.clock.elapsedTime;
    const nx = Math.sin(time * 41.3) * 0.6 + Math.sin(time * 23.1 + 1.7) * 0.4 + (Math.random() - 0.5) * 0.5;
    const ny = Math.sin(time * 37.7 + 0.4) * 0.6 + Math.sin(time * 19.3 + 2.9) * 0.4 + (Math.random() - 0.5) * 0.5;
    const nr = Math.sin(time * 29.9 + 1.1) * 0.7 + (Math.random() - 0.5) * 0.4;
    camera.position.x += nx * shake * 0.55;
    camera.position.y += ny * shake * 0.55;
    camera.lookAt(look);
    camera.rotateZ(nr * shake * 0.022);
    camera.rotateX(ny * shake * 0.016);
    camera.rotateY(nx * shake * 0.012);

    const sky = MathUtils.clamp(altitude / 320, 0, 1);
    scene.fog.color.copy(HAZE).lerp(SPACE, sky);
    scene.fog.density = MathUtils.lerp(0.0025, 0.00003, sky);

    if (state.clock.elapsedTime - lastTick.current > 0.1) {
      lastTick.current = state.clock.elapsedTime;
      onTelemetry({ t, phase: s0.phase, altitude, speed: s0.speed, shake: s0.shake });
    }
  });

  return (
    <>
      <group ref={stage1}>
        <StageOne sim={sim} label={label} quality={quality} />
      </group>
      <group ref={stage2}>
        <StageTwo sim={sim} label={label} quality={quality} />
      </group>
      <group ref={halves[0]}>
        <FairingHalf side={1} shadows={!quality.low} />
      </group>
      <group ref={halves[1]}>
        <FairingHalf side={-1} shadows={!quality.low} />
      </group>
      <group ref={craft}>
        <Spacecraft deploy={deploy} shadows={!quality.low} />
      </group>
    </>
  );
};

const Lights = ({ quality }) => {
  const sun = useMemo(() => SUN_DIRECTION.clone().multiplyScalar(80), []);
  return (
    <>
      <hemisphereLight args={["#6f86b8", "#2a2420", 0.35]} />
      <directionalLight
        position={sun}
        intensity={1.4}
        color="#ffb27a"
        castShadow={!quality.low}
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-camera-left={-26}
        shadow-camera-right={26}
        shadow-camera-top={26}
        shadow-camera-bottom={-26}
        shadow-camera-near={10}
        shadow-camera-far={180}
      />
      <directionalLight position={[25, 12, 40]} intensity={0.7} color="#ffe9cf" />
      <directionalLight position={[-20, 10, 30]} intensity={0.3} color="#c9d6ff" />
    </>
  );
};

const Effects = ({ quality }) => {
  if (quality.low) return null;
  return (
    <EffectComposer multisampling={4} disableNormalPass>
      <Bloom mipmapBlur intensity={0.75} luminanceThreshold={1} luminanceSmoothing={0.2} />
      <Vignette offset={0.3} darkness={0.55} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  );
};

export const prepareRenderer = ({ gl }) => {
  gl.debug.checkShaderErrors = import.meta.env.DEV;
};

const MAX_WARMUP_MS = 6000;

export const Warmup = ({ onReady, offscreen, content }) => {
  const { gl, scene, camera } = useThree();
  useEffect(() => {
    let timer;
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      onReady();
    };
    const started = performance.now();
    let pending;
    const previous = gl.getRenderTarget();
    const target = offscreen ? new WebGLRenderTarget(4, 4, { type: HalfFloatType }) : null;
    const group = content?.current;
    const wasVisible = group?.visible;
    try {
      if (group) group.visible = true;
      if (target) gl.setRenderTarget(target);
      pending = gl.compile(scene, camera);
    } catch {
      finish();
      return undefined;
    } finally {
      if (group) group.visible = wasVisible;
      gl.setRenderTarget(previous);
      target?.dispose();
    }
    const check = () => {
      pending.forEach((material) => {
        const program = gl.properties.get(material).currentProgram;
        if (!program?.program || program.isReady()) pending.delete(material);
      });
      if (pending.size === 0 || performance.now() - started > MAX_WARMUP_MS) finish();
      else timer = setTimeout(check, 30);
    };
    timer = setTimeout(check, 0);
    return () => {
      finished = true;
      clearTimeout(timer);
    };
  }, [gl, scene, camera, onReady, offscreen, content]);
  return null;
};

const LaunchScene = ({ outcome, onTelemetry, label, mode = "launch", onReady }) => {
  const outcomeRef = useRef(outcome);
  outcomeRef.current = outcome;
  const sim = useRef({
    t: 0,
    phase: "countdown",
    throttle1: 0,
    throttle2: 0,
    altitude: 0,
    speed: 0,
    pitch: 0,
    nozzle: new Vector3(0, 0.95, 0),
  });
  const quality = useMemo(graphicsProfile, []);
  const [ready, setReady] = useState(false);
  const content = useRef();
  const markReady = useCallback(() => {
    sim.current.ready = true;
    setReady(true);
    onReady?.();
  }, [onReady]);

  return (
    <Canvas
      className={`launch-canvas ${ready ? "is-ready" : ""}`}
      shadows={!quality.low}
      dpr={quality.dpr}
      camera={{ fov: 50, near: 0.3, far: 30000 }}
      gl={{ antialias: quality.antialias }}
      onCreated={prepareRenderer}
    >
      <Environment resolution={128} frames={1}>
        <EnvironmentSky />
      </Environment>
      <group ref={content} visible={ready}>
        <Lights quality={quality} />
        <SkyDome sim={sim} low={quality.low} />
        <SkyStars sim={sim} quality={quality} />
        <LaunchSite sim={sim} quality={quality} />
        <Smoke sim={sim} quality={quality} />
        <Vent sim={sim} quality={quality} />
        <Director sim={sim} outcomeRef={outcomeRef} onTelemetry={onTelemetry} label={label} quality={quality} mode={mode} />
      </group>
      <Effects quality={quality} />
      <Warmup onReady={markReady} offscreen={!quality.low} content={content} />
    </Canvas>
  );
};

export default LaunchScene;
