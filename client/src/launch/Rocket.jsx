import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { AdditiveBlending, CanvasTexture, DoubleSide, LatheGeometry, SRGBColorSpace, Vector2 } from "three";

export const BODY_RADIUS = 0.42;
export const STAGE1_LENGTH = 9.4;
export const INTERSTAGE = 0.7;
export const STAGE1_HEIGHT = STAGE1_LENGTH + INTERSTAGE;

const bodyTexture = (label, { soot = false, height = 1024 } = {}) => {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  const base = ctx.createLinearGradient(0, 0, 512, 0);
  base.addColorStop(0, "#d9dde1");
  base.addColorStop(0.5, "#f4f6f8");
  base.addColorStop(1, "#d9dde1");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 512, height);

  ctx.strokeStyle = "rgba(90, 100, 110, 0.18)";
  ctx.lineWidth = 2;
  for (let x = 0; x <= 512; x += 64) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y <= height; y += height / 9) {
    ctx.fillStyle = "rgba(80, 90, 100, 0.22)";
    ctx.fillRect(0, y, 512, 3);
  }

  if (soot) {
    const g = ctx.createLinearGradient(0, height, 0, height * 0.55);
    g.addColorStop(0, "rgba(30, 24, 20, 0.85)");
    g.addColorStop(0.35, "rgba(45, 38, 32, 0.4)");
    g.addColorStop(1, "rgba(60, 50, 40, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, height * 0.55, 512, height * 0.45);
    for (let i = 0; i < 160; i++) {
      ctx.fillStyle = `rgba(35, 28, 22, ${Math.random() * 0.25})`;
      const x = Math.random() * 512;
      const y = height * 0.62 + Math.random() * height * 0.38;
      ctx.fillRect(x, y, 2 + Math.random() * 6, 20 + Math.random() * 90);
    }
  }

  if (label) {
    ctx.save();
    ctx.translate(52, height * (soot ? 0.5 : 0.62));
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = "#14181c";
    ctx.font = `700 ${soot ? 46 : 40}px "Titillium Web", Arial, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label.toUpperCase().slice(0, 18), 0, 0, height * 0.42);
    ctx.restore();
  }

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
};

const nozzleGeometry = (length, throat, exit) => {
  const points = [];
  for (let i = 0; i <= 16; i++) {
    const k = i / 16;
    points.push(new Vector2(throat + (exit - throat) * Math.pow(k, 0.7), -k * length));
  }
  return new LatheGeometry(points, 28);
};

const fairingGeometry = (radius, length) => {
  const points = [new Vector2(0.0001, length)];
  for (let i = 1; i <= 24; i++) {
    const k = i / 24;
    points.push(new Vector2(radius * Math.sqrt(1 - Math.pow(1 - k, 2.2)), length * (1 - k)));
  }
  return new LatheGeometry(points, 40);
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
    gl_FragColor = vec4(color, clamp(alpha, 0.0, 1.0));
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
    <mesh ref={mesh} position={[0, 0, 0]}>
      <cylinderGeometry args={[top, bottom, length, 32, 1, true]} />
      <shaderMaterial
        args={[{ uniforms, vertexShader: plumeVertex, fragmentShader: plumeFragment }]}
        transparent
        depthWrite={false}
        blending={AdditiveBlending}
        side={DoubleSide}
      />
    </mesh>
  );
};

const Metal = (props) => <meshStandardMaterial color="#2a2d31" roughness={0.45} metalness={0.85} {...props} />;
const Carbon = (props) => <meshStandardMaterial color="#15171a" roughness={0.7} metalness={0.2} {...props} />;

export const StageOneModel = ({ sim, label }) => {
  const texture = useMemo(() => bodyTexture(label, { soot: true }), [label]);
  const nozzle = useMemo(() => nozzleGeometry(0.42, 0.05, 0.12), []);
  const engines = useMemo(() => {
    const list = [[0, 0]];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      list.push([Math.cos(a) * 0.27, Math.sin(a) * 0.27]);
    }
    return list;
  }, []);
  return (
    <group>
      <mesh position={[0, 0.05, 0]}>
        <cylinderGeometry args={[BODY_RADIUS * 0.98, BODY_RADIUS, 0.12, 32]} />
        <Carbon />
      </mesh>
      {engines.map(([x, z]) => (
        <mesh key={`${x}${z}`} geometry={nozzle} position={[x, 0, z]}>
          <Metal side={DoubleSide} />
        </mesh>
      ))}
      <mesh position={[0, STAGE1_LENGTH / 2 + 0.1, 0]}>
        <cylinderGeometry args={[BODY_RADIUS, BODY_RADIUS, STAGE1_LENGTH - 0.1, 48, 1, true]} />
        <meshStandardMaterial map={texture} roughness={0.5} metalness={0.15} />
      </mesh>
      <mesh position={[0, STAGE1_LENGTH + INTERSTAGE / 2, 0]}>
        <cylinderGeometry args={[BODY_RADIUS, BODY_RADIUS, INTERSTAGE, 48]} />
        <Carbon />
      </mesh>
      {[0, 1, 2, 3].map((n) => {
        const a = (n * Math.PI) / 2 + Math.PI / 4;
        return (
          <group key={`leg${n}`} rotation={[0, a, 0]}>
            <mesh position={[0, 1.55, BODY_RADIUS + 0.03]}>
              <boxGeometry args={[0.16, 2.8, 0.06]} />
              <Carbon />
            </mesh>
            <mesh position={[0, 0.3, BODY_RADIUS + 0.06]}>
              <boxGeometry args={[0.22, 0.3, 0.1]} />
              <Metal />
            </mesh>
          </group>
        );
      })}
      {[0, 1, 2, 3].map((n) => (
        <group key={`fin${n}`} rotation={[0, (n * Math.PI) / 2, 0]}>
          <mesh position={[0, STAGE1_LENGTH + 0.25, BODY_RADIUS + 0.16]} rotation={[0.12, 0, 0]}>
            <boxGeometry args={[0.34, 0.04, 0.28]} />
            <meshStandardMaterial color="#4a5058" roughness={0.45} metalness={0.8} />
          </mesh>
        </group>
      ))}
      <group position={[0, -0.42, 0]}>
        <group position={[0, -1.6, 0]}>
          <Plume sim={sim} stage={1} length={3.2} top={0.34} bottom={0.75} core={[1, 0.96, 0.82]} outer={[1, 0.45, 0.08]} />
        </group>
      </group>
    </group>
  );
};

export const StageTwoModel = ({ sim, label }) => {
  const texture = useMemo(() => bodyTexture(null, { height: 512 }), []);
  const fairingTexture = useMemo(() => bodyTexture(label ? "MISSION" : null, { height: 512 }), [label]);
  const mvac = useMemo(() => nozzleGeometry(0.9, 0.08, 0.36), []);
  const fairing = useMemo(() => fairingGeometry(0.52, 1.9), []);
  return (
    <group>
      <mesh geometry={mvac} position={[0, 0.05, 0]}>
        <meshStandardMaterial color="#3b2b22" roughness={0.35} metalness={0.9} side={DoubleSide} />
      </mesh>
      <mesh position={[0, 1.2, 0]}>
        <cylinderGeometry args={[BODY_RADIUS, BODY_RADIUS, 2.3, 48, 1, true]} />
        <meshStandardMaterial map={texture} roughness={0.5} metalness={0.15} />
      </mesh>
      <mesh position={[0, 2.35, 0]}>
        <cylinderGeometry args={[0.52, BODY_RADIUS, 0.25, 48]} />
        <meshStandardMaterial color="#e9edf0" roughness={0.5} />
      </mesh>
      <mesh position={[0, 3.25, 0]}>
        <cylinderGeometry args={[0.52, 0.52, 1.55, 48, 1, true]} />
        <meshStandardMaterial map={fairingTexture} roughness={0.45} metalness={0.1} />
      </mesh>
      <mesh geometry={fairing} position={[0, 4.02, 0]}>
        <meshStandardMaterial color="#eef1f3" roughness={0.45} metalness={0.1} />
      </mesh>
      <group position={[0, -0.85, 0]}>
        <group position={[0, -2.2, 0]}>
          <Plume sim={sim} stage={2} length={4.4} top={0.34} bottom={2.4} core={[0.85, 0.92, 1]} outer={[0.25, 0.45, 1]} />
        </group>
      </group>
    </group>
  );
};

export const ROCKET_HEIGHT = STAGE1_HEIGHT + 5.95;
