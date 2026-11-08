import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, Line, OrbitControls, Stars } from "@react-three/drei";
import { AdditiveBlending, DoubleSide, MathUtils, Vector3 } from "three";
import { glowTexture, ringTexture, usePlanetTexture } from "./textures";

const SUN_RADIUS = 5;
const J2000 = Date.UTC(2000, 0, 1, 12);
const DAY_MS = 86400000;

const MEAN_LONGITUDE_J2000 = {
  mercury: 252.25,
  venus: 181.98,
  earth: 100.46,
  mars: 355.45,
  jupiter: 34.4,
  saturn: 49.94,
  uranus: 313.23,
  neptune: 304.88,
};

const RINGS = {
  saturn: { inner: 1.24, outer: 2.3 },
  uranus: { inner: 1.6, outer: 2.0 },
};

export const orbitRadius = (body) => 8 + Math.sqrt(body.distanceFromSunMillionKm) * 1.4;
export const visualRadius = (body) =>
  body.type === "star" ? SUN_RADIUS : 0.35 + Math.pow(body.diameterKm / 12756, 0.55) * 0.9;

export const daysSinceJ2000 = (date) => (date.getTime() - J2000) / DAY_MS;
export const dateFromDays = (days) => new Date(J2000 + days * DAY_MS);

const angleAt = (body, days) =>
  MathUtils.degToRad(MEAN_LONGITUDE_J2000[body.id] ?? 0) + (Math.PI * 2 * days) / body.orbitalPeriodDays;

const spinRate = (body, daysPerSecond) => {
  if (!body.dayLengthHours) return 0;
  const real = (Math.PI * 2 * daysPerSecond * 24) / body.dayLengthHours;
  return Math.min(real, 1.2) + 0.05;
};

const Label = ({ body, offset, selected, onSelect, entry }) => (
  <Html position={[0, offset, 0]} center zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
    <span
      ref={(el) => (entry.label = el)}
      onClick={() => onSelect(body.id)}
      style={{
        pointerEvents: "auto",
        cursor: "pointer",
        whiteSpace: "nowrap",
        fontFamily: '"Titillium Web", sans-serif',
        fontSize: 12,
        letterSpacing: 1,
        textTransform: "uppercase",
        padding: "1px 6px",
        color: selected ? "#000909" : "#a1ecfb",
        background: selected ? "#a1ecfb" : "rgba(0, 20, 24, 0.55)",
        border: "1px solid rgba(161, 236, 251, 0.45)",
        userSelect: "none",
        transition: "opacity 0.25s",
      }}
    >
      {body.name}
    </span>
  </Html>
);

const Orbit = ({ radius, color, highlighted }) => {
  const points = useMemo(() => {
    const list = [];
    for (let i = 0; i <= 160; i++) {
      const a = (i / 160) * Math.PI * 2;
      list.push([Math.cos(a) * radius, 0, Math.sin(a) * radius]);
    }
    return list;
  }, [radius]);
  return (
    <Line
      points={points}
      color={highlighted ? "#a1ecfb" : color}
      lineWidth={highlighted ? 1.6 : 1}
      transparent
      opacity={highlighted ? 0.85 : 0.28}
    />
  );
};

const Ring = ({ id, radius }) => {
  const ref = useRef();
  const { inner, outer } = RINGS[id];
  useEffect(() => {
    const geometry = ref.current;
    const pos = geometry.attributes.position;
    const uv = geometry.attributes.uv;
    const v = new Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      uv.setXY(i, (v.length() - radius * inner) / (radius * (outer - inner)), 0.5);
    }
    uv.needsUpdate = true;
  }, [radius, inner, outer]);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry ref={ref} args={[radius * inner, radius * outer, 128, 1]} />
      <meshStandardMaterial map={ringTexture(id)} transparent side={DoubleSide} depthWrite={false} roughness={1} />
    </mesh>
  );
};

const Moon = ({ planetRadius, clock }) => {
  const ref = useRef();
  const texture = usePlanetTexture("moon");
  useFrame(() => {
    const a = (Math.PI * 2 * clock.current.days) / 27.3;
    const r = planetRadius * 2.6;
    ref.current.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
  });
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[planetRadius * 0.27, 24, 24]} />
      <meshStandardMaterial key={texture ? "map" : "flat"} map={texture} color={texture ? "#ffffff" : "#8a8681"} roughness={1} />
    </mesh>
  );
};

const Planet = ({ body, clock, registry, selected, showLabels, showOrbits, onSelect }) => {
  const orbitRef = useRef();
  const spinRef = useRef();
  const radius = visualRadius(body);
  const distance = orbitRadius(body);
  const texture = usePlanetTexture(body.id);
  const entry = useMemo(
    () => ({ position: new Vector3(), radius: radius * (RINGS[body.id] ? 1.8 : 1), size: body.diameterKm, label: null }),
    [body.id, body.diameterKm, radius],
  );

  useEffect(() => {
    registry.current[body.id] = entry;
    return () => delete registry.current[body.id];
  }, [body.id, entry, registry]);

  useFrame((_, delta) => {
    const a = angleAt(body, clock.current.days);
    orbitRef.current.position.set(Math.cos(a) * distance, 0, -Math.sin(a) * distance);
    spinRef.current.rotation.y += spinRate(body, clock.current.speed) * delta;
    orbitRef.current.getWorldPosition(entry.position);
  });

  return (
    <group rotation={[MathUtils.degToRad(body.orbitalInclinationDeg), 0, 0]}>
      {(showOrbits || selected) && <Orbit radius={distance} color={body.color} highlighted={selected} />}
      <group ref={orbitRef}>
        <group rotation={[0, 0, MathUtils.degToRad(body.axialTiltDeg)]}>
          <mesh
            ref={spinRef}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(body.id);
            }}
            onPointerOver={() => (document.body.style.cursor = "pointer")}
            onPointerOut={() => (document.body.style.cursor = "")}
          >
            <sphereGeometry args={[radius, 48, 48]} />
            <meshStandardMaterial
              key={texture ? "map" : "flat"}
              map={texture}
              color={texture ? "#ffffff" : body.color}
              roughness={0.9}
              metalness={0}
            />
          </mesh>
          {RINGS[body.id] && <Ring id={body.id} radius={radius} />}
        </group>
        {body.id === "earth" && <Moon planetRadius={radius} clock={clock} />}
        {showLabels && <Label body={body} offset={radius + 1.1} selected={selected} onSelect={onSelect} entry={entry} />}
      </group>
    </group>
  );
};

const Sun = ({ body, registry, showLabels, selected, onSelect }) => {
  const ref = useRef();
  const texture = usePlanetTexture("sun");
  const entry = useMemo(() => ({ position: new Vector3(), radius: SUN_RADIUS, size: body.diameterKm, label: null }), [body.diameterKm]);
  useEffect(() => {
    registry.current.sun = entry;
    return () => delete registry.current.sun;
  }, [entry, registry]);
  useFrame((_, delta) => {
    ref.current.rotation.y += delta * 0.04;
  });
  return (
    <group>
      <mesh
        ref={ref}
        onClick={(e) => {
          e.stopPropagation();
          onSelect("sun");
        }}
      >
        <sphereGeometry args={[SUN_RADIUS, 64, 64]} />
        <meshBasicMaterial key={texture ? "map" : "flat"} map={texture} color={texture ? "#ffffff" : "#ffa31a"} toneMapped={false} />
      </mesh>
      <sprite scale={[SUN_RADIUS * 5.5, SUN_RADIUS * 5.5, 1]}>
        <spriteMaterial map={glowTexture()} blending={AdditiveBlending} depthWrite={false} transparent toneMapped={false} />
      </sprite>
      <pointLight position={[0, 0, 0]} intensity={2.6} decay={0} color="#fff3e0" />
      {showLabels && <Label body={body} offset={SUN_RADIUS + 1.6} selected={selected} onSelect={onSelect} entry={entry} />}
    </group>
  );
};

const Clock = ({ clock, speed, onTick }) => {
  const last = useRef(0);
  useEffect(() => {
    clock.current.speed = speed;
  }, [clock, speed]);
  useFrame((state, delta) => {
    clock.current.days += Math.min(delta, 0.1) * clock.current.speed;
    if (state.clock.elapsedTime - last.current > 0.2) {
      last.current = state.clock.elapsedTime;
      onTick(clock.current.days);
    }
  });
  return null;
};

const LabelDeclutter = ({ registry, selectedId }) => {
  const { camera, size } = useThree();
  const last = useRef(0);
  const point = useMemo(() => new Vector3(), []);
  useFrame((state) => {
    if (state.clock.elapsedTime - last.current < 0.1) return;
    last.current = state.clock.elapsedTime;
    const entries = Object.entries(registry.current)
      .filter(([, e]) => e.label)
      .sort(([idA, a], [idB, b]) => (idB === selectedId) - (idA === selectedId) || b.size - a.size);
    const placed = [];
    for (const [, e] of entries) {
      point.copy(e.position).project(camera);
      const x = (point.x * 0.5 + 0.5) * size.width;
      const y = (-point.y * 0.5 + 0.5) * size.height;
      const w = e.label.offsetWidth + 6;
      const h = e.label.offsetHeight + 4;
      const box = { l: x - w / 2, r: x + w / 2, t: y - h - 12, b: y };
      const hit = point.z > 1 || placed.some((p) => box.l < p.r && box.r > p.l && box.t < p.b && box.b > p.t);
      e.label.style.opacity = hit ? "0" : "1";
      e.label.style.pointerEvents = hit ? "none" : "auto";
      if (!hit) placed.push(box);
    }
  });
  return null;
};

const OVERVIEW = new Vector3(0, 125, 150);

const CameraRig = ({ registry, selectedId, resetKey }) => {
  const { camera, controls, size } = useThree();
  const flying = useRef(0);
  const overview = useMemo(() => OVERVIEW.clone().multiplyScalar(Math.max(1, 1.45 / (size.width / size.height))), [size.width, size.height]);
  const previous = useRef(new Vector3());
  const desired = useRef(new Vector3());

  useEffect(() => {
    flying.current = 2.2;
    const target = registry.current[selectedId];
    if (target) previous.current.copy(target.position);
  }, [selectedId, resetKey, registry]);

  useEffect(() => {
    if (!controls) return;
    const stop = () => (flying.current = 0);
    controls.addEventListener("start", stop);
    return () => controls.removeEventListener("start", stop);
  }, [controls]);

  useFrame((_, delta) => {
    if (!controls) return;
    const target = selectedId ? registry.current[selectedId] : null;

    if (target) {
      const move = target.position.clone().sub(previous.current);
      previous.current.copy(target.position);
      camera.position.add(move);
      controls.target.add(move);
    }

    if (flying.current > 0) {
      flying.current -= delta;
      const t = 1 - Math.pow(0.02, delta);
      if (target) {
        const distance = Math.max(target.radius * 5, 6);
        const dir = camera.position.clone().sub(target.position).normalize();
        if (dir.y < 0.25) dir.y = 0.25;
        dir.normalize();
        desired.current.copy(target.position).addScaledVector(dir, distance);
        controls.target.lerp(target.position, t);
      } else {
        desired.current.copy(overview);
        controls.target.lerp(new Vector3(), t);
      }
      camera.position.lerp(desired.current, t);
    }
    controls.update();
  });

  return null;
};

const SolarScene = ({ bodies, selectedId, onSelect, speed, showOrbits, showLabels, onTick, resetKey }) => {
  const clock = useRef({ days: daysSinceJ2000(new Date()), speed });
  const registry = useRef({});
  const sun = bodies.find((b) => b.id === "sun");
  const planets = bodies.filter((b) => b.id !== "sun");

  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: OVERVIEW.clone().multiplyScalar(2.6).toArray(), fov: 45, near: 0.1, far: 3000 }}
      gl={{ antialias: true }}
    >
      <color attach="background" args={["#000509"]} />
      <ambientLight intensity={0.12} />
      <Stars radius={600} depth={200} count={6000} factor={6} saturation={0} fade speed={0.4} />
      <Clock clock={clock} speed={speed} onTick={onTick} />
      {sun && <Sun body={sun} registry={registry} showLabels={showLabels} selected={selectedId === "sun"} onSelect={onSelect} />}
      {planets.map((body) => (
        <Planet
          key={body.id}
          body={body}
          clock={clock}
          registry={registry}
          selected={selectedId === body.id}
          showLabels={showLabels}
          showOrbits={showOrbits}
          onSelect={onSelect}
        />
      ))}
      <OrbitControls makeDefault enableDamping dampingFactor={0.08} minDistance={2} maxDistance={600} />
      <CameraRig registry={registry} selectedId={selectedId} resetKey={resetKey} />
      {showLabels && <LabelDeclutter registry={registry} selectedId={selectedId} />}
    </Canvas>
  );
};

export default SolarScene;
