import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { AdditiveBlending, Color, FogExp2, MathUtils, NormalBlending, Vector3 } from "three";

export const TIMELINE = {
  holdAt: 4.2,
  armRetract: 3,
  ignition: 4.6,
  liftoff: 6,
  maxQ: 6 + 5,
  separation: 6 + 9,
  secondIgnition: 6 + 9.8,
  orbit: 6 + 14,
};

const STAGE1_HEIGHT = 7.4;
const DUSK = new Color("#1d3a5f");
const SPACE = new Color("#000207");

const BURN = TIMELINE.orbit - TIMELINE.liftoff;
const rawAltitude = (s) => 0.6 * s * s + 0.12 * s * s * s;
const rawSpeed = (s) => 1.2 * s + 0.36 * s * s;
const altitudeAt = (s) => (s <= BURN ? rawAltitude(s) : rawAltitude(BURN) + rawSpeed(BURN) * 0.35 * (s - BURN));
const speedAt = (s) => (s <= BURN ? rawSpeed(s) : rawSpeed(BURN));
const pitchAt = (s) => (s > 3 ? Math.min(0.85, (s - 3) * 0.075) : 0);
const driftAt = (s) => (s > 3 ? 0.035 * Math.pow(Math.min(s, BURN) - 3, 3) + Math.max(0, s - BURN) * 30 : 0);

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

const Flame = ({ sim, stage, length = 1, tint = "orange" }) => {
  const geometryRef = useRef();
  const { pool, material } = useParticles(stage === 1 ? 900 : 400, AdditiveBlending);
  const light = useRef();
  const blue = tint === "blue";

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const throttle = stage === 1 ? sim.current.throttle1 : sim.current.throttle2;
    const count = Math.floor(throttle * (stage === 1 ? 950 : 420) * dt + Math.random());
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

const Smoke = ({ sim }) => {
  const geometryRef = useRef();
  const { pool, material } = useParticles(1800, NormalBlending);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const { throttle1, nozzle, altitude, pitch } = sim.current;
    if (throttle1 > 0.05) {
      const low = altitude < 45;
      const rate = low ? 260 : 70;
      const count = Math.floor(rate * throttle1 * dt + Math.random());
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

const White = (props) => <meshStandardMaterial color="#e9edf0" roughness={0.55} metalness={0.1} {...props} />;
const Dark = (props) => <meshStandardMaterial color="#1b1f24" roughness={0.6} metalness={0.4} {...props} />;

const StageOne = ({ sim }) => (
  <group>
    <mesh position={[0, -0.3, 0]}>
      <cylinderGeometry args={[0.22, 0.4, 0.6, 24]} />
      <Dark />
    </mesh>
    <mesh position={[0, 3.5, 0]}>
      <cylinderGeometry args={[0.45, 0.45, 7, 32]} />
      <White />
    </mesh>
    <mesh position={[0, 5.2, 0]}>
      <cylinderGeometry args={[0.455, 0.455, 0.16, 32]} />
      <meshStandardMaterial color="#2ec6e6" emissive="#0b4a57" roughness={0.4} />
    </mesh>
    <mesh position={[0, 7.1, 0]}>
      <cylinderGeometry args={[0.46, 0.46, 0.6, 32]} />
      <Dark />
    </mesh>
    {[0, 1, 2, 3].map((n) => (
      <mesh key={n} rotation={[0, (n * Math.PI) / 2, 0]} position={[Math.sin((n * Math.PI) / 2) * 0.62, 0.55, Math.cos((n * Math.PI) / 2) * 0.62]}>
        <boxGeometry args={[0.06, 1.1, 0.5]} />
        <Dark />
      </mesh>
    ))}
    <Flame sim={sim} stage={1} />
  </group>
);

const StageTwo = ({ sim }) => (
  <group>
    <mesh position={[0, -0.15, 0]}>
      <cylinderGeometry args={[0.12, 0.3, 0.4, 20]} />
      <Dark />
    </mesh>
    <mesh position={[0, 1.1, 0]}>
      <cylinderGeometry args={[0.45, 0.45, 2.2, 32]} />
      <White />
    </mesh>
    <mesh position={[0, 2.7, 0]}>
      <cylinderGeometry args={[0.5, 0.5, 1, 32]} />
      <White />
    </mesh>
    <mesh position={[0, 3.85, 0]}>
      <coneGeometry args={[0.5, 1.3, 32]} />
      <White />
    </mesh>
    <group position={[0, 0.25, 0]}>
      <Flame sim={sim} stage={2} tint="blue" length={0.7} />
    </group>
  </group>
);

const Tower = ({ sim }) => {
  const arm = useRef();
  const beacon = useRef();
  useFrame((state) => {
    const t = sim.current.t;
    const k = MathUtils.clamp((t - TIMELINE.armRetract) / 1.2, 0, 1);
    arm.current.rotation.y = MathUtils.lerp(0, -1.3, k * k * (3 - 2 * k));
    beacon.current.material.emissiveIntensity = Math.sin(state.clock.elapsedTime * 4) > 0 ? 3 : 0.2;
  });
  const rungs = [];
  for (let y = 0.8; y < 13; y += 1.2) rungs.push(y);
  return (
    <group position={[-2.3, 0, 0]}>
      {[
        [-0.5, -0.5],
        [0.5, -0.5],
        [-0.5, 0.5],
        [0.5, 0.5],
      ].map(([x, z]) => (
        <mesh key={`${x}${z}`} position={[x, 6.5, z]}>
          <boxGeometry args={[0.08, 13, 0.08]} />
          <meshStandardMaterial color="#7a3b26" roughness={0.8} />
        </mesh>
      ))}
      {rungs.map((y) => (
        <group key={y} position={[0, y, 0]}>
          <mesh>
            <boxGeometry args={[1.08, 0.06, 0.06]} />
            <meshStandardMaterial color="#6b3322" />
          </mesh>
          <mesh rotation={[0, Math.PI / 2, 0]}>
            <boxGeometry args={[1.08, 0.06, 0.06]} />
            <meshStandardMaterial color="#6b3322" />
          </mesh>
        </group>
      ))}
      <group ref={arm} position={[0.5, 9.6, 0]}>
        <mesh position={[0.75, 0, 0]}>
          <boxGeometry args={[1.5, 0.22, 0.3]} />
          <meshStandardMaterial color="#555b61" metalness={0.5} roughness={0.5} />
        </mesh>
      </group>
      <mesh ref={beacon} position={[0, 13.15, 0]}>
        <sphereGeometry args={[0.12, 12, 12]} />
        <meshStandardMaterial color="#ff2a2a" emissive="#ff2a2a" emissiveIntensity={1} />
      </mesh>
    </group>
  );
};

const Ground = () => (
  <group>
    <mesh rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[3000, 3000]} />
      <meshStandardMaterial color="#0e1813" roughness={1} />
    </mesh>
    <mesh position={[0, 0.15, 0]}>
      <cylinderGeometry args={[4.2, 4.6, 0.3, 48]} />
      <meshStandardMaterial color="#4a4e52" roughness={0.95} />
    </mesh>
    <mesh position={[0, 0.31, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[1.2, 1.35, 48]} />
      <meshStandardMaterial color="#c9a227" roughness={0.8} />
    </mesh>
    {[
      [-60, -120],
      [80, -160],
      [-140, -220],
      [150, -90],
      [30, -260],
    ].map(([x, z]) => (
      <mesh key={`${x}${z}`} position={[x, 1.5, z]}>
        <boxGeometry args={[6, 3, 6]} />
        <meshStandardMaterial color="#14201b" roughness={1} />
      </mesh>
    ))}
  </group>
);

const SkyStars = ({ sim }) => {
  const ref = useRef();
  const material = useRef();
  const positions = useMemo(() => {
    const list = new Float32Array(1800 * 3);
    for (let i = 0; i < 1800; i++) {
      const u = Math.random() * 2 - 1;
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(1 - u * u);
      list.set([Math.cos(a) * r * 500, Math.abs(u) * 500, Math.sin(a) * r * 500], i * 3);
    }
    return list;
  }, []);
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

const Director = ({ sim, outcomeRef, onTelemetry }) => {
  const stage1 = useRef();
  const stage2 = useRef();
  const { camera, scene } = useThree();
  const look = useMemo(() => new Vector3(0, 6, 0), []);
  const desired = useMemo(() => new Vector3(), []);
  const offset = useMemo(() => new Vector3(10, 1.5, 15), []);
  const lookOffset = useRef(5);
  const lastTick = useRef(0);
  const sep = useRef(null);

  useEffect(() => {
    scene.fog = new FogExp2(DUSK.clone(), 0.0045);
    scene.background = DUSK.clone();
    camera.position.set(10, 2.5, 15);
    camera.lookAt(0, 6, 0);
  }, [camera, scene]);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const s0 = sim.current;
    const outcome = outcomeRef.current;

    if (s0.phase !== "scrubbed") {
      if (outcome === "failed" && s0.t < TIMELINE.ignition) {
        s0.phase = "scrubbed";
      } else if (outcome === "pending" && s0.t >= TIMELINE.holdAt) {
        s0.phase = "hold";
      } else {
        s0.t += dt;
      }
    }

    const t = s0.t;
    const s = Math.max(0, t - TIMELINE.liftoff);
    if (s0.phase !== "scrubbed" && s0.phase !== "hold") {
      s0.phase =
        t < TIMELINE.ignition ? "countdown"
          : t < TIMELINE.liftoff ? "ignition"
            : t < TIMELINE.maxQ - 1 ? "liftoff"
              : t < TIMELINE.maxQ + 2 ? "maxq"
                : t < TIMELINE.separation ? "ascent"
                  : t < TIMELINE.secondIgnition + 1 ? "separation"
                    : t < TIMELINE.orbit ? "second"
                      : "orbit";
    }

    const ignitionK = MathUtils.clamp((t - TIMELINE.ignition) / 0.9, 0, 1);
    s0.throttle1 = s0.phase === "scrubbed" ? 0 : t < TIMELINE.separation ? ignitionK : 0;
    s0.throttle2 = t > TIMELINE.secondIgnition ? Math.min(1, (t - TIMELINE.secondIgnition) / 0.5) : 0;

    const altitude = altitudeAt(s);
    const pitch = pitchAt(s);
    const x = driftAt(s);
    s0.altitude = altitude;
    s0.speed = speedAt(s);
    s0.pitch = pitch;

    const rocketY = altitude + 0.95;
    const up = new Vector3(-Math.sin(pitch), Math.cos(pitch), 0);

    stage2.current.position.set(x, rocketY, 0).addScaledVector(up, STAGE1_HEIGHT);
    stage2.current.rotation.set(0, 0, pitch);

    if (t < TIMELINE.separation) {
      stage1.current.position.set(x, rocketY, 0);
      stage1.current.rotation.set(0, 0, pitch);
    } else {
      if (!sep.current) {
        const velocity = up.clone().multiplyScalar(speedAt(s) * 0.6);
        sep.current = { velocity, spin: 0.5 + Math.random() * 0.4 };
      }
      sep.current.velocity.y -= 22 * dt;
      stage1.current.position.addScaledVector(sep.current.velocity, dt);
      stage1.current.rotation.z += sep.current.spin * dt;
      stage1.current.rotation.x += sep.current.spin * 0.4 * dt;
    }
    s0.nozzle.copy(stage1.current.position);

    const focus = t < TIMELINE.separation ? stage1.current.position : stage2.current.position;
    if (s <= 0) {
      desired.set(10, 2.5, 15);
      look.lerp(new Vector3(0, 6, 0), 1 - Math.exp(-3 * dt));
    } else {
      const k = MathUtils.clamp(s / 8, 0, 1);
      const upper = t >= TIMELINE.separation;
      if (upper) desired.set(9, -2.5, 13);
      else desired.set(MathUtils.lerp(10, 15, k), MathUtils.lerp(-1, -4, k), MathUtils.lerp(15, 22, k));
      offset.lerp(desired, 1 - Math.exp(-1.5 * dt));
      lookOffset.current = MathUtils.lerp(lookOffset.current, upper ? 2.6 : MathUtils.lerp(5, 7, k), 1 - Math.exp(-2 * dt));
      look.copy(focus).addScaledVector(up, lookOffset.current);
    }
    if (s <= 0) {
      camera.position.lerp(desired, 1 - Math.exp(-3 * dt));
    } else {
      camera.position.copy(focus).add(offset);
    }

    const shake = (t > TIMELINE.ignition ? Math.min(1, (t - TIMELINE.ignition) / 1.4) : 0) * Math.max(0, 1 - s / 12) * 0.16 * s0.throttle1;
    camera.position.x += (Math.random() - 0.5) * shake;
    camera.position.y += (Math.random() - 0.5) * shake;
    camera.lookAt(look);

    const sky = MathUtils.clamp(altitude / 320, 0, 1);
    scene.background.copy(DUSK).lerp(SPACE, sky);
    scene.fog.color.copy(scene.background);
    scene.fog.density = MathUtils.lerp(0.0045, 0.0006, sky);

    if (state.clock.elapsedTime - lastTick.current > 0.1) {
      lastTick.current = state.clock.elapsedTime;
      onTelemetry({ t, phase: s0.phase, altitude, speed: s0.speed });
    }
  });

  return (
    <>
      <group ref={stage1}>
        <StageOne sim={sim} />
      </group>
      <group ref={stage2}>
        <StageTwo sim={sim} />
      </group>
    </>
  );
};

const LaunchScene = ({ outcome, onTelemetry }) => {
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

  return (
    <Canvas dpr={[1, 1.75]} camera={{ fov: 50, near: 0.1, far: 4000 }} gl={{ antialias: true }}>
      <hemisphereLight args={["#6d8fbf", "#1a1410", 0.55]} />
      <directionalLight position={[-30, 40, 20]} intensity={0.9} color="#cfd9ff" />
      <SkyStars sim={sim} />
      <Ground />
      <Tower sim={sim} />
      <Smoke sim={sim} />
      <Director sim={sim} outcomeRef={outcomeRef} onTelemetry={onTelemetry} />
    </Canvas>
  );
};

export default LaunchScene;
