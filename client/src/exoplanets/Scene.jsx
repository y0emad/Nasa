import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, Line, OrbitControls, Stars } from "@react-three/drei";
import { AdditiveBlending, CanvasTexture, Color, DoubleSide, SRGBColorSpace, Vector3 } from "three";
import { graphicsProfile } from "../graphics";

export const orbitUnits = (au) => 8 + au * 26;
export const starUnits = (radiusSun) => 2 + radiusSun * 2.4;
export const planetUnits = (radiusEarth) => 0.9 * Math.pow(radiusEarth, 0.7);
export const habitableZone = (luminositySun) => ({
  innerAu: Math.sqrt(luminositySun / 1.11),
  outerAu: Math.sqrt(luminositySun / 0.36),
});
export const secondsPerOrbit = (periodDays) => 8 + periodDays / 20;

export const planetLook = (planet) => {
  if (planet.radiusEarth > 1.7) return "mini-neptune";
  if (planet.equilibriumTempK < 230) return "icy";
  if (planet.equilibriumTempK > 262) return "arid";
  return "temperate";
};

const LOOKS = {
  icy: { low: "#6d8fb3", high: "#f2f8ff", cloud: 0.3, bands: 0, ice: 0.18 },
  temperate: { low: "#1f4f8a", high: "#5f8f4a", cloud: 0.55, bands: 0, ice: 0.74 },
  arid: { low: "#8a5a32", high: "#d8b07a", cloud: 0.2, bands: 0, ice: 0.94 },
  "mini-neptune": { low: "#3a6fa8", high: "#9fd0e8", cloud: 0.15, bands: 1, ice: 1 },
};

const planetVertex = `
  varying vec3 vPos;
  varying vec3 vNormal;
  varying vec3 vWorld;
  void main() {
    vPos = position;
    vNormal = normalize(mat3(modelMatrix) * normal);
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const planetFragment = `
  uniform vec3 uLow;
  uniform vec3 uHigh;
  uniform vec3 uStar;
  uniform vec3 uStarPos;
  uniform float uCloud;
  uniform float uBands;
  uniform float uIce;
  uniform float uTime;
  varying vec3 vPos;
  varying vec3 vNormal;
  varying vec3 vWorld;

  float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  float noise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
      mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y),
      f.z);
  }

  float fbm(vec3 p) {
    float value = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 5; i++) {
      value += amp * noise(p);
      p *= 2.03;
      amp *= 0.5;
    }
    return value;
  }

  void main() {
    vec3 p = normalize(vPos);
    float land = fbm(p * 2.6 + 3.1);
    vec3 surface;
    if (uBands > 0.5) {
      float band = sin(p.y * 14.0 + fbm(p * 3.0) * 3.0);
      surface = mix(uLow, uHigh, 0.5 + 0.5 * band);
    } else {
      float coast = smoothstep(0.48, 0.53, land);
      surface = mix(uLow, uHigh, coast);
      float ice = smoothstep(uIce, uIce + 0.16, abs(p.y) + (land - 0.5) * 0.35);
      surface = mix(surface, vec3(0.93, 0.96, 1.0), ice);
    }
    float clouds = smoothstep(0.55, 0.75, fbm(p * 4.0 + vec3(uTime * 0.02, 0.0, 0.0))) * uCloud;
    surface = mix(surface, vec3(1.0), clouds);
    vec3 toStar = normalize(uStarPos - vWorld);
    float light = max(dot(normalize(vNormal), toStar), 0.0);
    vec3 color = surface * (0.05 + light * uStar * 1.1);
    float rim = pow(1.0 - abs(dot(normalize(vNormal), normalize(cameraPosition - vWorld))), 3.0);
    color += uHigh * rim * 0.25 * (0.3 + light);
    gl_FragColor = vec4(color, 1.0);
  }
`;

const glow = (() => {
  let texture = null;
  return () => {
    if (texture) return texture;
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, "rgba(255, 255, 255, 0.95)");
    g.addColorStop(0.22, "rgba(255, 255, 255, 0.42)");
    g.addColorStop(0.55, "rgba(255, 255, 255, 0.1)");
    g.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
    texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    return texture;
  };
})();

const labelStyle = (accent) => ({
  pointerEvents: "none",
  whiteSpace: "nowrap",
  fontFamily: '"Titillium Web", sans-serif',
  fontSize: 12,
  letterSpacing: 1,
  textTransform: "uppercase",
  padding: "1px 6px",
  color: accent ? "#000909" : "#a1ecfb",
  background: accent ? "#a1ecfb" : "rgba(0, 20, 24, 0.55)",
  border: "1px solid rgba(161, 236, 251, 0.45)",
});

const Star = ({ planet }) => {
  const ref = useRef();
  const radius = starUnits(planet.star.radiusSun);
  const color = useMemo(() => new Color(planet.star.color), [planet.star.color]);
  useFrame((_, delta) => {
    ref.current.rotation.y += delta * 0.05;
  });
  return (
    <group>
      <mesh ref={ref}>
        <sphereGeometry args={[radius, 48, 48]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      <sprite scale={[radius * 6, radius * 6, 1]}>
        <spriteMaterial map={glow()} color={color} blending={AdditiveBlending} depthWrite={false} transparent toneMapped={false} />
      </sprite>
      <pointLight position={[0, 0, 0]} intensity={2.4} decay={0} color={color} />
      <Html position={[0, radius + 1.4, 0]} center zIndexRange={[20, 0]}>
        <span style={labelStyle(false)}>{planet.star.name}</span>
      </Html>
    </group>
  );
};

const HabitableZone = ({ planet, view }) => {
  const material = useRef();
  const { innerAu, outerAu } = habitableZone(planet.star.luminositySun);
  useFrame((_, delta) => {
    const target = view === "planet" ? 0 : 0.13;
    const m = material.current;
    m.opacity += (target - m.opacity) * Math.min(1, delta * 3);
    m.visible = m.opacity > 0.005;
  });
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[orbitUnits(innerAu), orbitUnits(outerAu), 128, 1]} />
      <meshBasicMaterial ref={material} color="#3ddc84" transparent opacity={0.13} side={DoubleSide} depthWrite={false} />
    </mesh>
  );
};

const Orbit = ({ radius }) => {
  const points = useMemo(() => {
    const list = [];
    for (let i = 0; i <= 160; i++) {
      const a = (i / 160) * Math.PI * 2;
      list.push([Math.cos(a) * radius, 0, Math.sin(a) * radius]);
    }
    return list;
  }, [radius]);
  return <Line points={points} color="#a1ecfb" lineWidth={1.2} transparent opacity={0.55} />;
};

const Planet = ({ planet, tracker, reducedMotion }) => {
  const group = useRef();
  const spin = useRef();
  const look = LOOKS[planetLook(planet)];
  const radius = planetUnits(planet.radiusEarth);
  const distance = orbitUnits(planet.orbitAu);
  const period = secondsPerOrbit(planet.orbitalPeriodDays);
  const uniforms = useMemo(
    () => ({
      uLow: { value: new Color(look.low) },
      uHigh: { value: new Color(look.high) },
      uStar: { value: new Color(planet.star.color) },
      uStarPos: { value: new Vector3() },
      uCloud: { value: look.cloud },
      uBands: { value: look.bands },
      uIce: { value: look.ice },
      uTime: { value: 0 },
    }),
    [look, planet.star.color],
  );

  useFrame((state, delta) => {
    const speed = reducedMotion ? 0.25 : 1;
    const a = 0.6 + (state.clock.elapsedTime * speed * Math.PI * 2) / period;
    group.current.position.set(Math.cos(a) * distance, 0, -Math.sin(a) * distance);
    spin.current.rotation.y += delta * 0.3 * speed;
    uniforms.uTime.value = state.clock.elapsedTime;
    tracker.position.copy(group.current.position);
    tracker.radius = radius;
  });

  return (
    <group ref={group}>
      <group rotation={[0, 0, 0.35]}>
        <mesh ref={spin}>
          <sphereGeometry args={[radius, 64, 64]} />
          <shaderMaterial args={[{ uniforms, vertexShader: planetVertex, fragmentShader: planetFragment }]} />
        </mesh>
      </group>
      <Html position={[0, radius + 1.3, 0]} center zIndexRange={[20, 0]}>
        <span style={labelStyle(true)}>{planet.name}</span>
      </Html>
    </group>
  );
};

const CameraRig = ({ planet, view, tracker, reducedMotion }) => {
  const { camera, controls, size } = useThree();
  const flying = useRef(0);
  const previous = useRef(new Vector3());
  const desired = useMemo(() => new Vector3(), []);
  const origin = useMemo(() => new Vector3(), []);

  useEffect(() => {
    flying.current = 2.4;
    previous.current.copy(tracker.position);
  }, [planet.id, view, tracker]);

  useEffect(() => {
    if (!controls) return;
    const stop = () => (flying.current = 0);
    controls.addEventListener("start", stop);
    return () => controls.removeEventListener("start", stop);
  }, [controls]);

  useFrame((_, delta) => {
    if (!controls) return;
    const close = view === "planet";
    if (close) {
      const move = tracker.position.clone().sub(previous.current);
      camera.position.add(move);
      controls.target.add(move);
    }
    previous.current.copy(tracker.position);

    if (flying.current > 0) {
      flying.current -= delta;
      const t = reducedMotion ? 1 : 1 - Math.pow(0.03, delta);
      if (close) {
        const dir = camera.position.clone().sub(tracker.position).setY(0).normalize();
        desired.copy(tracker.position).addScaledVector(dir, tracker.radius * 6).setY(tracker.position.y + tracker.radius * 2.2);
        controls.target.lerp(tracker.position, t);
      } else {
        const reach = orbitUnits(Math.max(planet.orbitAu, habitableZone(planet.star.luminositySun).outerAu));
        const fit = Math.max(1, 1.5 / (size.width / size.height));
        desired.set(0, reach * 1.05, reach * 1.55).multiplyScalar(fit);
        controls.target.lerp(origin, t);
      }
      camera.position.lerp(desired, t);
    }
    controls.update();
  });

  return null;
};

const ExoplanetScene = ({ planet, view }) => {
  const quality = useMemo(graphicsProfile, []);
  const tracker = useMemo(() => ({ position: new Vector3(), radius: 1 }), []);
  return (
    <Canvas
      dpr={quality.dpr}
      camera={{ position: quality.reducedMotion ? [0, 60, 90] : [0, 160, 260], fov: 45, near: 0.1, far: 3000 }}
      gl={{ antialias: quality.antialias }}
    >
      <color attach="background" args={["#000509"]} />
      <ambientLight intensity={0.08} />
      <Stars radius={600} depth={200} count={Math.round(5000 * quality.stars)} factor={6} saturation={0} fade speed={quality.reducedMotion ? 0 : 0.4} />
      <Star planet={planet} />
      <HabitableZone planet={planet} view={view} />
      <Orbit radius={orbitUnits(planet.orbitAu)} />
      <Planet key={planet.id} planet={planet} tracker={tracker} reducedMotion={quality.reducedMotion} />
      <OrbitControls makeDefault enableDamping dampingFactor={0.08} minDistance={1.5} maxDistance={500} />
      <CameraRig planet={planet} view={view} tracker={tracker} reducedMotion={quality.reducedMotion} />
    </Canvas>
  );
};

export default ExoplanetScene;
