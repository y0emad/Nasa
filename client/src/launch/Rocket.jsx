import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { AdditiveBlending, DoubleSide, ExtrudeGeometry, LatheGeometry, Shape, Vector2 } from "three";
import {
  boosterSurface,
  carbonSurface,
  fairingSurface,
  frostAlpha,
  goldFoilSurface,
  gridFinAlpha,
  nozzleSurface,
  solarCellSurface,
  upperStageSurface,
} from "./surfaces";
import { graphicsProfile } from "../graphics";

const LOW = graphicsProfile().low;

export const BODY_RADIUS = 0.42;
export const STAGE1_LENGTH = 9.4;
export const INTERSTAGE = 0.7;
export const STAGE1_HEIGHT = STAGE1_LENGTH + INTERSTAGE;
export const FAIRING_BASE = 2.22;
export const SPACECRAFT_BASE = 2.44;

const useShadows = (enabled) => {
  const ref = useRef();
  useLayoutEffect(() => {
    ref.current?.traverse((child) => {
      if (child.isMesh) child.castShadow = enabled && !child.material.transparent;
    });
  }, [enabled]);
  return ref;
};

const nozzleGeometry = (length, throat, exit) => {
  const points = [];
  for (let i = 0; i <= 20; i++) {
    const k = i / 20;
    points.push(new Vector2(throat + (exit - throat) * Math.pow(k, 0.65), -k * length));
  }
  return new LatheGeometry(points, 32);
};

const fairingProfile = () => {
  const points = [new Vector2(0.425, 0), new Vector2(0.47, 0.1), new Vector2(0.52, 0.28), new Vector2(0.52, 1.8)];
  for (let i = 1; i <= 24; i++) {
    const k = i / 24;
    points.push(new Vector2(Math.max(0.0001, 0.52 * Math.sqrt(1 - Math.pow(k, 2.1))), 1.8 + 1.9 * k));
  }
  return points;
};

const legGeometry = () => {
  const shape = new Shape();
  shape.moveTo(-0.11, 0);
  shape.lineTo(0.11, 0);
  shape.lineTo(0.06, 2.5);
  shape.lineTo(-0.06, 2.5);
  shape.closePath();
  return new ExtrudeGeometry(shape, { depth: 0.07, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 1 });
};

const plumeVertex = `
  varying vec2 vUv;
  varying float vEdge;
  void main() {
    vUv = uv;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vec3 n = normalize(normalMatrix * normal);
    vEdge = abs(dot(n, normalize(-mv.xyz)));
    gl_Position = projectionMatrix * mv;
  }
`;

const plumeFragment = `
  uniform float uThrottle;
  uniform float uTime;
  uniform float uDiamonds;
  uniform vec3 uCore;
  uniform vec3 uOuter;
  varying vec2 vUv;
  varying float vEdge;
  void main() {
    float along = vUv.y;
    float edge = pow(vEdge, 1.6);
    float flicker = 0.9 + 0.1 * sin(uTime * 60.0 + along * 20.0);
    float diamonds = uDiamonds * smoothstep(0.55, 1.0, sin(along * 34.0)) * smoothstep(0.25, 0.9, along);
    vec3 color = mix(uOuter, uCore, clamp(along * along * edge + diamonds, 0.0, 1.0));
    float alpha = pow(along, 1.4) * edge * uThrottle * flicker + diamonds * edge * 0.6 * uThrottle;
    gl_FragColor = vec4(color * 1.6, clamp(alpha, 0.0, 1.0));
  }
`;

const Plume = ({ sim, stage, length, top, bottom, core, outer }) => {
  const mesh = useRef();
  const uniforms = useMemo(
    () => ({
      uThrottle: { value: 0 },
      uTime: { value: 0 },
      uDiamonds: { value: 0 },
      uCore: { value: core },
      uOuter: { value: outer },
    }),
    [core, outer],
  );
  useFrame((state) => {
    const throttle = stage === 1 ? sim.current.throttle1 : sim.current.throttle2;
    uniforms.uThrottle.value = throttle;
    uniforms.uTime.value = state.clock.elapsedTime;
    uniforms.uDiamonds.value = stage === 1 ? Math.max(0, 1 - sim.current.altitude / 120) * throttle : 0;
    const spread = stage === 1 ? 1 + Math.min(1.6, sim.current.altitude / 160) : 1;
    mesh.current.scale.set(spread, (0.92 + Math.random() * 0.16) * Math.max(0.05, throttle), spread);
    mesh.current.visible = throttle > 0.01;
  });
  return (
    <mesh ref={mesh}>
      <cylinderGeometry args={[top, bottom, length, 32, 1, true]} />
      <shaderMaterial
        args={[{ uniforms, vertexShader: plumeVertex, fragmentShader: plumeFragment }]}
        transparent
        depthWrite={false}
        blending={AdditiveBlending}
        side={DoubleSide}
        toneMapped={false}
      />
    </mesh>
  );
};

const Paint = ({ surface, ...props }) =>
  LOW ? (
    <meshStandardMaterial
      map={surface.map}
      roughnessMap={surface.roughnessMap}
      roughness={1}
      metalness={0.05}
      {...props}
    />
  ) : (
  <meshPhysicalMaterial
    map={surface.map}
    roughnessMap={surface.roughnessMap}
    normalMap={surface.normalMap}
    normalScale={[0.6, 0.6]}
    roughness={1}
    metalness={0.05}
    clearcoat={0.35}
    clearcoatRoughness={0.4}
    {...props}
  />
);

const Carbon = (props) => {
  const carbon = carbonSurface();
  return (
    <meshStandardMaterial
      map={carbon.map}
      roughnessMap={carbon.roughnessMap}
      normalMap={carbon.normalMap}
      roughness={1}
      metalness={0.2}
      {...props}
    />
  );
};

const GridFin = () => (
  <group>
    <mesh>
      <planeGeometry args={[0.34, 0.3]} />
      <meshStandardMaterial
        color="#8b9198"
        metalness={0.85}
        roughness={0.38}
        alphaMap={gridFinAlpha()}
        alphaTest={0.5}
        side={DoubleSide}
      />
    </mesh>
    <mesh position={[0, -0.17, -0.02]}>
      <boxGeometry args={[0.1, 0.05, 0.06]} />
      <meshStandardMaterial color="#3a3f45" metalness={0.7} roughness={0.5} />
    </mesh>
  </group>
);

const FROST_HEIGHT = 3.6;

const Frost = ({ sim }) => {
  const material = useRef();
  useFrame(() => {
    const melt = Math.max(0, sim.current.t - 6) / 14;
    material.current.opacity = Math.max(0, 0.85 - melt);
    material.current.visible = material.current.opacity > 0.02;
  });
  return (
    <mesh position={[0, STAGE1_LENGTH - FROST_HEIGHT / 2 - 0.35, 0]}>
      <cylinderGeometry args={[BODY_RADIUS + 0.004, BODY_RADIUS + 0.004, FROST_HEIGHT, 48, 1, true]} />
      <meshStandardMaterial
        ref={material}
        color="#f4f8ff"
        roughness={0.95}
        alphaMap={frostAlpha()}
        transparent
        depthWrite={false}
      />
    </mesh>
  );
};

export const StageOneModel = ({ sim, label, shadows = true }) => {
  const ref = useShadows(shadows);
  const body = useMemo(() => boosterSurface(label), [label]);
  const merlin = nozzleSurface("merlin", "#3b3530", "#6e5a4c");
  const nozzle = useMemo(() => nozzleGeometry(0.42, 0.05, 0.12), []);
  const leg = useMemo(() => legGeometry(), []);
  const engines = useMemo(() => {
    const list = [[0, 0]];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      list.push([Math.cos(a) * 0.27, Math.sin(a) * 0.27]);
    }
    return list;
  }, []);
  return (
    <group ref={ref}>
      <mesh position={[0, 0.05, 0]}>
        <cylinderGeometry args={[BODY_RADIUS * 0.99, BODY_RADIUS, 0.14, 48]} />
        <meshStandardMaterial color="#26282b" roughness={0.85} metalness={0.3} />
      </mesh>
      {engines.map(([x, z]) => (
        <group key={`${x}${z}`} position={[x, 0, z]}>
          <mesh position={[0, 0.04, 0]}>
            <cylinderGeometry args={[0.045, 0.06, 0.1, 16]} />
            <meshStandardMaterial color="#4a4744" metalness={0.8} roughness={0.45} />
          </mesh>
          <mesh geometry={nozzle}>
            <meshStandardMaterial
              map={merlin.map}
              normalMap={merlin.normalMap}
              roughnessMap={merlin.roughnessMap}
              roughness={1}
              metalness={0.85}
              side={DoubleSide}
            />
          </mesh>
        </group>
      ))}
      <mesh position={[0, STAGE1_LENGTH / 2 + 0.1, 0]}>
        <cylinderGeometry args={[BODY_RADIUS, BODY_RADIUS, STAGE1_LENGTH - 0.1, 64, 1, true]} />
        <Paint surface={body} />
      </mesh>
      <Frost sim={sim} />
      <mesh position={[0, STAGE1_LENGTH + INTERSTAGE / 2, 0]}>
        <cylinderGeometry args={[BODY_RADIUS, BODY_RADIUS, INTERSTAGE, 64]} />
        <Carbon />
      </mesh>
      {[0, 1, 2, 3].map((n) => (
        <group key={`leg${n}`} rotation={[0, (n * Math.PI) / 2 + Math.PI / 4, 0]}>
          <mesh geometry={leg} position={[0, 0.12, BODY_RADIUS - 0.01]}>
            <Carbon />
          </mesh>
          <mesh position={[0, 0.16, BODY_RADIUS + 0.06]}>
            <boxGeometry args={[0.24, 0.12, 0.1]} />
            <meshStandardMaterial color="#c9ccd0" metalness={0.6} roughness={0.4} />
          </mesh>
        </group>
      ))}
      {[0, 1, 2, 3].map((n) => (
        <group key={`fin${n}`} rotation={[0, (n * Math.PI) / 2, 0]}>
          <group position={[0, STAGE1_LENGTH + 0.36, BODY_RADIUS + 0.035]}>
            <GridFin />
          </group>
        </group>
      ))}
      <group position={[0, -2.02, 0]}>
        <Plume sim={sim} stage={1} length={3.2} top={0.34} bottom={0.75} core={[1, 0.96, 0.82]} outer={[1, 0.45, 0.08]} />
      </group>
    </group>
  );
};

export const StageTwoModel = ({ sim, shadows = true }) => {
  const ref = useShadows(shadows);
  const body = upperStageSurface();
  const niobium = nozzleSurface("mvac", "#2e2b2a", "#5a4a40");
  const mvac = useMemo(() => nozzleGeometry(0.9, 0.08, 0.36), []);
  const glow = useRef();
  useFrame(() => {
    glow.current.emissiveIntensity = Math.max(sim.current.throttle2, sim.current.mvacHeat ?? 0) * 2.2;
  });
  return (
    <group ref={ref}>
      <mesh geometry={mvac} position={[0, 0.05, 0]}>
        <meshStandardMaterial
          ref={glow}
          map={niobium.map}
          normalMap={niobium.normalMap}
          roughness={0.45}
          metalness={0.9}
          emissive="#ff5a12"
          emissiveMap={niobium.map}
          emissiveIntensity={0}
          side={DoubleSide}
        />
      </mesh>
      <mesh position={[0, 1.2, 0]}>
        <cylinderGeometry args={[BODY_RADIUS, BODY_RADIUS, 2.3, 64, 1, true]} />
        <Paint surface={body} />
      </mesh>
      <mesh position={[0, 2.38, 0]}>
        <cylinderGeometry args={[0.22, BODY_RADIUS, 0.12, 48]} />
        <meshStandardMaterial color="#2b2e32" metalness={0.6} roughness={0.5} />
      </mesh>
      <group position={[0, -3.05, 0]}>
        <Plume sim={sim} stage={2} length={4.4} top={0.34} bottom={2.4} core={[0.85, 0.92, 1]} outer={[0.25, 0.45, 1]} />
      </group>
    </group>
  );
};

export const FairingHalf = ({ side, shadows = true }) => {
  const ref = useShadows(shadows);
  const surface = fairingSurface();
  const geometry = useMemo(() => new LatheGeometry(fairingProfile(), 32, side > 0 ? 0 : Math.PI, Math.PI), [side]);
  return (
    <group ref={ref}>
      <mesh geometry={geometry}>
        <Paint surface={surface} side={DoubleSide} />
      </mesh>
    </group>
  );
};

const PANEL_LENGTH = 1.9;

export const Spacecraft = ({ deploy, shadows = true }) => {
  const ref = useShadows(shadows);
  const gold = goldFoilSurface();
  const cells = solarCellSurface();
  const left = useRef();
  const right = useRef();
  const dish = useMemo(() => {
    const points = [];
    for (let i = 0; i <= 12; i++) {
      const k = i / 12;
      points.push(new Vector2(0.001 + k * 0.2, k * k * 0.08));
    }
    return new LatheGeometry(points, 32);
  }, []);

  useFrame(() => {
    const k = Math.min(1, Math.max(0, deploy.current ?? 0));
    const ease = k * k * (3 - 2 * k);
    [right, left].forEach((wing, i) => {
      if (!wing.current) return;
      wing.current.scale.set(0.06 + ease * 0.94, 1, 1);
      wing.current.rotation.x = (1 - ease) * (i ? -1 : 1) * 0.6;
    });
  });

  return (
    <group ref={ref}>
      <mesh position={[0, 0.35, 0]}>
        <boxGeometry args={[0.5, 0.62, 0.5]} />
        <meshStandardMaterial
          map={gold.map}
          normalMap={gold.normalMap}
          roughnessMap={gold.roughnessMap}
          color="#ffd27a"
          metalness={0.7}
          roughness={0.75}
        />
      </mesh>
      <mesh position={[0, 0.02, 0]}>
        <cylinderGeometry args={[0.2, 0.22, 0.06, 32]} />
        <meshStandardMaterial color="#9aa0a6" metalness={0.8} roughness={0.35} />
      </mesh>
      <mesh geometry={dish} position={[0, 0.68, 0]}>
        <meshStandardMaterial color="#e8eaec" metalness={0.3} roughness={0.4} side={DoubleSide} />
      </mesh>
      <mesh position={[0, 0.74, 0]}>
        <cylinderGeometry args={[0.012, 0.012, 0.16, 8]} />
        <meshStandardMaterial color="#cfd3d7" metalness={0.8} roughness={0.3} />
      </mesh>
      {[1, -1].map((dir) => (
        <group key={dir} position={[dir * 0.25, 0.35, 0]}>
          <mesh position={[dir * 0.08, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.015, 0.015, 0.16, 8]} />
            <meshStandardMaterial color="#b9bec4" metalness={0.8} roughness={0.35} />
          </mesh>
          <group ref={dir > 0 ? right : left} position={[dir * 0.16, 0, 0]}>
            <mesh position={[(dir * PANEL_LENGTH) / 2, 0, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 2]}>
              <planeGeometry args={[0.42, PANEL_LENGTH]} />
              <meshStandardMaterial
                map={cells.map}
                normalMap={cells.normalMap}
                roughnessMap={cells.roughnessMap}
                metalness={0.6}
                roughness={1}
                side={DoubleSide}
              />
            </mesh>
          </group>
        </group>
      ))}
    </group>
  );
};
