import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Line, Sky } from "@react-three/drei";
import { AdditiveBlending, BackSide, CanvasTexture, Color, MathUtils, Object3D, Quaternion, Vector3 } from "three";
import { concreteSurface, groundSurface, waterNormals } from "./surfaces";
import { usePlanetTexture } from "../solar/textures";

export const SUN_DIRECTION = new Vector3(-0.8, 0.05, 0.3).normalize();
export const HAZE = new Color("#575a68");
export const EARTH_RADIUS = 20000;

export const TOWER_X = -2.3;
const TOWER_HEIGHT = 17.5;

const SKY = { turbidity: 9, rayleigh: 2.6, mieCoefficient: 0.005, mieDirectionalG: 0.9 };

const radialFade = (() => {
  let texture = null;
  return () => {
    if (texture) return texture;
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 256;
    const ctx = c.getContext("2d");
    const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, "#fff");
    g.addColorStop(0.7, "#fff");
    g.addColorStop(1, "#000");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
    texture = new CanvasTexture(c);
    return texture;
  };
})();

const gradientVertex = `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const gradientFragment = `
  uniform vec3 uSun;
  uniform float uAir;
  varying vec3 vDir;
  void main() {
    float h = max(vDir.y, 0.0);
    vec3 zenith = vec3(0.12, 0.2, 0.36);
    vec3 horizon = vec3(0.78, 0.62, 0.52);
    vec3 color = mix(horizon, zenith, pow(h, 0.45));
    float sun = pow(max(dot(vDir, uSun), 0.0), 24.0);
    color += vec3(1.0, 0.6, 0.3) * sun * 0.8;
    gl_FragColor = vec4(color * uAir, 1.0);
  }
`;

const GradientSky = ({ skyRef }) => {
  const uniforms = useMemo(() => ({ uSun: { value: SUN_DIRECTION.clone() }, uAir: { value: 1 } }), []);
  return (
    <mesh ref={skyRef} renderOrder={-10}>
      <sphereGeometry args={[900, 32, 16]} />
      <shaderMaterial args={[{ uniforms, vertexShader: gradientVertex, fragmentShader: gradientFragment }]} side={BackSide} depthWrite={false} />
    </mesh>
  );
};

export const SkyDome = ({ sim, low }) => {
  const group = useRef();
  const sky = useRef();
  const { camera } = useThree();
  const sun = useMemo(() => SUN_DIRECTION.clone().multiplyScalar(100), []);
  useFrame(() => {
    group.current.position.copy(camera.position);
    const air = 1 - MathUtils.clamp((sim.current.altitude - 40) / 300, 0, 1);
    const uniforms = sky.current?.material?.uniforms;
    if (!uniforms) return;
    sky.current.visible = air > 0.03;
    if (low) {
      uniforms.uAir.value = air;
      return;
    }
    uniforms.rayleigh.value = Math.max(0.05, SKY.rayleigh * air);
    uniforms.mieCoefficient.value = Math.max(0.0002, SKY.mieCoefficient * air);
    uniforms.turbidity.value = Math.max(1, SKY.turbidity * air);
  });
  return (
    <group ref={group}>
      {low ? <GradientSky skyRef={sky} /> : <Sky ref={sky} renderOrder={-10} distance={900} sunPosition={sun} {...SKY} />}
    </group>
  );
};

export const EnvironmentSky = () => {
  const sun = useMemo(() => SUN_DIRECTION.clone().multiplyScalar(100), []);
  return <Sky distance={50} sunPosition={sun} {...SKY} />;
};

const Ground = ({ shadows }) => {
  const grass = groundSurface();
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow={shadows}>
      <circleGeometry args={[1400, 96]} />
      <meshStandardMaterial
        map={grass.map}
        normalMap={grass.normalMap}
        color="#8a8f80"
        roughness={1}
        alphaMap={radialFade()}
        transparent
      />
    </mesh>
  );
};

const KSC = { lat: 28.6, lon: -80.6 };

const surfacePoint = (lat, lon) => {
  const phi = ((lon + 180) / 360) * Math.PI * 2;
  const theta = ((90 - lat) / 180) * Math.PI;
  return new Vector3(-Math.cos(phi) * Math.sin(theta), Math.cos(theta), Math.sin(phi) * Math.sin(theta));
};

const atmosphereVertex = `
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vNormal = normalize(mat3(modelMatrix) * normal);
    vView = normalize(cameraPosition - world.xyz);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const atmosphereFragment = `
  uniform float uStrength;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    float rim = pow(1.0 - abs(dot(vNormal, vView)), 4.0);
    gl_FragColor = vec4(vec3(0.35, 0.6, 1.0) * rim * uStrength, rim * uStrength);
  }
`;

const Planet = ({ sim }) => {
  const texture = usePlanetTexture("earth");
  const atmosphere = useRef();
  const quaternion = useMemo(() => {
    const up = surfacePoint(KSC.lat, KSC.lon);
    const east = surfacePoint(KSC.lat, KSC.lon + 0.5).sub(up).normalize();
    const align = new Quaternion().setFromUnitVectors(up, new Vector3(0, 1, 0));
    east.applyQuaternion(align).setY(0).normalize();
    const turn = new Quaternion().setFromUnitVectors(east, new Vector3(0, 0, -1));
    return turn.multiply(align);
  }, []);
  const uniforms = useMemo(() => ({ uStrength: { value: 0 } }), []);
  useFrame(() => {
    uniforms.uStrength.value = MathUtils.clamp((sim.current.altitude - 120) / 300, 0, 1) * 1.4;
    atmosphere.current.visible = uniforms.uStrength.value > 0.01;
  });
  return (
    <group position={[0, -EARTH_RADIUS - 30, 0]}>
      <mesh quaternion={quaternion}>
        <sphereGeometry args={[EARTH_RADIUS, 128, 96]} />
        <meshStandardMaterial key={texture ? "map" : "flat"} map={texture} color={texture ? "#ffffff" : "#20406a"} roughness={0.9} />
      </mesh>
      <mesh ref={atmosphere} scale={1.012}>
        <sphereGeometry args={[EARTH_RADIUS, 96, 64]} />
        <shaderMaterial
          args={[{ uniforms, vertexShader: atmosphereVertex, fragmentShader: atmosphereFragment }]}
          transparent
          depthWrite={false}
          blending={AdditiveBlending}
          side={BackSide}
        />
      </mesh>
    </group>
  );
};

const Ocean = () => {
  const normals = waterNormals();
  useFrame((_, delta) => {
    normals.offset.x += delta * 0.004;
    normals.offset.y += delta * 0.002;
  });
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.3, -900]}>
        <planeGeometry args={[2400, 1400]} />
        <meshStandardMaterial
          color="#0d2a3e"
          roughness={0.14}
          metalness={0.25}
          normalMap={normals}
          normalScale={[0.35, 0.35]}
          alphaMap={radialFade()}
          transparent
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.2, -196]}>
        <planeGeometry args={[1600, 26]} />
        <meshStandardMaterial color="#a8997a" roughness={1} />
      </mesh>
    </group>
  );
};

const Pad = ({ shadows }) => {
  const concrete = concreteSurface();
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} receiveShadow={shadows}>
        <circleGeometry args={[30, 96]} />
        <meshStandardMaterial map={concrete.map} normalMap={concrete.normalMap} color="#9a9890" roughness={0.95} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.035, 0]}>
        <circleGeometry args={[7, 48]} />
        <meshBasicMaterial color="#1b1814" alphaMap={radialFade()} transparent opacity={0.55} depthWrite={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-12, 0.025, 60]} receiveShadow={shadows}>
        <planeGeometry args={[14, 70]} />
        <meshStandardMaterial color="#77736b" roughness={1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[6.2, 0.04, 0]}>
        <planeGeometry args={[12, 2.8]} />
        <meshBasicMaterial color="#050505" />
      </mesh>
      {[-1.6, 1.6].map((z) => (
        <mesh key={z} position={[6.2, 0.35, z]} receiveShadow={shadows} castShadow={shadows}>
          <boxGeometry args={[12, 0.7, 0.4]} />
          <meshStandardMaterial map={concrete.map} color="#9a9890" roughness={0.95} />
        </mesh>
      ))}
      <mesh position={[0.4, 0.3, 0]} rotation={[0, 0, -0.5]}>
        <boxGeometry args={[1.6, 0.25, 2.6]} />
        <meshStandardMaterial color="#3d3a36" metalness={0.5} roughness={0.7} />
      </mesh>
    </group>
  );
};

const LaunchMount = ({ shadows }) => (
  <group>
    {[
      [-0.8, -0.8],
      [0.8, -0.8],
      [-0.8, 0.8],
      [0.8, 0.8],
    ].map(([x, z]) => (
      <mesh key={`${x}${z}`} position={[x, 0.45, z]} castShadow={shadows} receiveShadow={shadows}>
        <boxGeometry args={[0.28, 0.9, 0.28]} />
        <meshStandardMaterial color="#5d6064" metalness={0.6} roughness={0.55} />
      </mesh>
    ))}
    {[0, Math.PI / 2].map((r) =>
      [-0.8, 0.8].map((offset) => (
        <mesh key={`${r}${offset}`} position={r ? [offset, 0.86, 0] : [0, 0.86, offset]} rotation={[0, r, 0]} castShadow={shadows}>
          <boxGeometry args={[1.88, 0.16, 0.22]} />
          <meshStandardMaterial color="#6b6e72" metalness={0.6} roughness={0.5} />
        </mesh>
      )),
    )}
    {[0, 1, 2, 3].map((n) => {
      const a = (n * Math.PI) / 2 + Math.PI / 4;
      return (
        <mesh key={n} position={[Math.cos(a) * 0.52, 0.98, Math.sin(a) * 0.52]} rotation={[0, -a, 0]} castShadow={shadows}>
          <boxGeometry args={[0.16, 0.22, 0.12]} />
          <meshStandardMaterial color="#2d3034" metalness={0.7} roughness={0.45} />
        </mesh>
      );
    })}
  </group>
);

const Brace = ({ from, to, size = 0.05, color = "#8a3c24" }) => {
  const { position, quaternion, length } = useMemo(() => {
    const a = new Vector3(...from);
    const b = new Vector3(...to);
    const o = new Object3D();
    o.position.copy(a).add(b).multiplyScalar(0.5);
    o.lookAt(b);
    return { position: o.position.toArray(), quaternion: o.quaternion.toArray(), length: a.distanceTo(b) };
  }, [from, to]);
  return (
    <mesh position={position} quaternion={quaternion}>
      <boxGeometry args={[size, size, length]} />
      <meshStandardMaterial color={color} roughness={0.75} metalness={0.3} />
    </mesh>
  );
};

const Tower = ({ sim, shadows }) => {
  const arm = useRef();
  const beacon = useRef();
  const group = useRef();
  const levels = useMemo(() => {
    const list = [];
    for (let y = 0; y < TOWER_HEIGHT - 1; y += 1.75) list.push(y);
    return list;
  }, []);
  useLayoutEffect(() => {
    group.current.traverse((child) => {
      if (child.isMesh) child.castShadow = shadows;
    });
  }, [shadows]);
  useFrame((state) => {
    const k = MathUtils.clamp((sim.current.t - 3) / 1.2, 0, 1);
    arm.current.rotation.y = MathUtils.lerp(0, -1.3, k * k * (3 - 2 * k));
    beacon.current.material.emissiveIntensity = Math.sin(state.clock.elapsedTime * 4) > 0 ? 4 : 0.2;
  });
  const h = 0.6;
  return (
    <group ref={group} position={[TOWER_X, 0, 0]}>
      {[
        [-h, -h],
        [h, -h],
        [-h, h],
        [h, h],
      ].map(([x, z]) => (
        <mesh key={`${x}${z}`} position={[x, TOWER_HEIGHT / 2, z]}>
          <boxGeometry args={[0.12, TOWER_HEIGHT, 0.12]} />
          <meshStandardMaterial color="#8a3c24" roughness={0.75} metalness={0.3} />
        </mesh>
      ))}
      {levels.map((y) => (
        <group key={y}>
          <mesh position={[0, y + 0.05, 0]}>
            <boxGeometry args={[1.32, 0.08, 1.32]} />
            <meshStandardMaterial color="#5f6266" roughness={0.8} metalness={0.4} />
          </mesh>
          <Brace from={[-h, y, h]} to={[h, y + 1.75, h]} />
          <Brace from={[h, y, h]} to={[-h, y + 1.75, h]} />
          <Brace from={[h, y, -h]} to={[h, y + 1.75, h]} />
          <Brace from={[h, y, h]} to={[h, y + 1.75, -h]} />
          <Brace from={[-h, y, -h]} to={[h, y + 1.75, -h]} />
          <mesh position={[h + 0.04, y + 1.2, h + 0.04]}>
            <boxGeometry args={[0.08, 0.08, 0.08]} />
            <meshStandardMaterial color="#fff2c4" emissive="#ffd88a" emissiveIntensity={3} toneMapped={false} />
          </mesh>
        </group>
      ))}
      <group ref={arm} position={[h, 12.8, 0]}>
        <mesh position={[0.75, 0, 0]}>
          <boxGeometry args={[1.5, 0.24, 0.34]} />
          <meshStandardMaterial color="#9aa0a6" metalness={0.5} roughness={0.5} />
        </mesh>
        <mesh position={[1.45, 0, 0]}>
          <boxGeometry args={[0.2, 0.36, 0.44]} />
          <meshStandardMaterial color="#e9ecef" roughness={0.6} />
        </mesh>
      </group>
      <mesh position={[h + 0.55, 15.2, 0]}>
        <boxGeometry args={[1.1, 0.3, 0.42]} />
        <meshStandardMaterial color="#e3e6e9" roughness={0.6} metalness={0.2} />
      </mesh>
      <mesh position={[0, TOWER_HEIGHT + 1.6, 0]}>
        <cylinderGeometry args={[0.04, 0.08, 3.2, 8]} />
        <meshStandardMaterial color="#c4c8cc" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh ref={beacon} position={[0, TOWER_HEIGHT + 0.15, 0]}>
        <sphereGeometry args={[0.12, 12, 12]} />
        <meshStandardMaterial color="#ff2a2a" emissive="#ff2a2a" emissiveIntensity={1} toneMapped={false} />
      </mesh>
    </group>
  );
};

const MASTS = [
  [-26, -24],
  [30, -20],
  [-36, 16],
];
const MAST_HEIGHT = 38;

const sag = (a, b, drop, steps = 16) => {
  const points = [];
  for (let i = 0; i <= steps; i++) {
    const k = i / steps;
    const p = new Vector3().lerpVectors(a, b, k);
    p.y -= Math.sin(k * Math.PI) * drop;
    points.push(p);
  }
  return points;
};

const LightningMasts = () => {
  const wires = useMemo(() => {
    const tops = MASTS.map(([x, z]) => new Vector3(x, MAST_HEIGHT, z));
    const list = [];
    for (let i = 0; i < tops.length; i++) {
      list.push(sag(tops[i], tops[(i + 1) % tops.length], 5));
      list.push(sag(tops[i], new Vector3(tops[i].x * 2.2, 0, tops[i].z * 2.2), 3));
    }
    return list;
  }, []);
  return (
    <group>
      {MASTS.map(([x, z]) => (
        <group key={`${x}${z}`} position={[x, 0, z]}>
          <mesh position={[0, MAST_HEIGHT / 2, 0]}>
            <cylinderGeometry args={[0.16, 0.42, MAST_HEIGHT, 12]} />
            <meshStandardMaterial color="#8c9196" roughness={0.7} metalness={0.3} />
          </mesh>
          <mesh position={[0, MAST_HEIGHT + 0.3, 0]}>
            <sphereGeometry args={[0.09, 8, 8]} />
            <meshStandardMaterial color="#ff3a2a" emissive="#ff3a2a" emissiveIntensity={3} toneMapped={false} />
          </mesh>
        </group>
      ))}
      {wires.map((points, i) => (
        <Line key={i} points={points} color="#1d2024" lineWidth={1} transparent opacity={0.6} />
      ))}
    </group>
  );
};

const WaterTower = () => (
  <group position={[-34, 0, -30]}>
    {[
      [-2, -2],
      [2, -2],
      [-2, 2],
      [2, 2],
    ].map(([x, z]) => (
      <mesh key={`${x}${z}`} position={[x * 0.7, 7, z * 0.7]} rotation={[z * 0.03, 0, -x * 0.03]}>
        <cylinderGeometry args={[0.18, 0.22, 14, 8]} />
        <meshStandardMaterial color="#c9ccd0" metalness={0.5} roughness={0.5} />
      </mesh>
    ))}
    <mesh position={[0, 15.6, 0]}>
      <sphereGeometry args={[3.2, 32, 24]} />
      <meshStandardMaterial color="#e9ecef" metalness={0.35} roughness={0.35} />
    </mesh>
    <mesh position={[0, 7, 0]}>
      <cylinderGeometry args={[0.4, 0.4, 14, 10]} />
      <meshStandardMaterial color="#bfc3c7" metalness={0.5} roughness={0.5} />
    </mesh>
  </group>
);

const POLES = [
  [-15, 10],
  [14, -15],
  [-13, -16],
  [18, 5],
];

const PoleLight = ({ x, z, lit }) => {
  const light = useRef();
  const { scene } = useThree();
  useLayoutEffect(() => {
    if (!light.current) return undefined;
    const target = light.current.target;
    target.position.set(0, 7, 0);
    scene.add(target);
    return () => scene.remove(target);
  }, [scene, lit]);
  const a = Math.atan2(-x, -z);
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 5, 0]}>
        <cylinderGeometry args={[0.08, 0.12, 10, 8]} />
        <meshStandardMaterial color="#7d8186" metalness={0.6} roughness={0.5} />
      </mesh>
      <mesh position={[0, 10.1, 0]} rotation={[0.5, a, 0]}>
        <boxGeometry args={[1.2, 0.5, 0.15]} />
        <meshStandardMaterial color="#fff6dc" emissive="#ffe7b0" emissiveIntensity={4} toneMapped={false} />
      </mesh>
      {lit && (
        <spotLight ref={light} position={[0, 10, 0]} color="#ffeccc" intensity={260} angle={0.32} penumbra={0.7} decay={1.6} distance={80} />
      )}
    </group>
  );
};

const LightPoles = ({ count }) => (
  <group>
    {POLES.map(([x, z], i) => (
      <PoleLight key={`${x}${z}`} x={x} z={z} lit={i < count} />
    ))}
  </group>
);

const Buildings = () => (
  <group>
    {[
      { p: [72, 0, -64], s: [30, 14, 22], c: "#a9aba9" },
      { p: [-86, 0, 46], s: [24, 10, 34], c: "#9fa09c" },
      { p: [-210, 0, 170], s: [56, 64, 46], c: "#b5b6b3" },
      { p: [150, 0, 120], s: [18, 8, 18], c: "#8f908c" },
    ].map(({ p, s, c }) => (
      <group key={p.join()} position={[p[0], s[1] / 2, p[2]]}>
        <mesh>
          <boxGeometry args={s} />
          <meshStandardMaterial color={c} roughness={0.85} metalness={0.1} />
        </mesh>
        <mesh position={[0, s[1] / 2 + 0.05, 0]}>
          <boxGeometry args={[s[0] * 1.02, 0.4, s[2] * 1.02]} />
          <meshStandardMaterial color="#5d5f62" roughness={0.7} />
        </mesh>
      </group>
    ))}
  </group>
);

const Trees = ({ count }) => {
  const mesh = useRef();
  useLayoutEffect(() => {
    const o = new Object3D();
    let seed = 11;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    let placed = 0;
    while (placed < count) {
      const a = rand() * Math.PI * 2;
      const r = 80 + rand() * 240;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      if (z < -170 || (Math.abs(x + 12) < 14 && z > 20)) continue;
      const s = 2 + rand() * 3.5;
      o.position.set(x, s * 0.45, z);
      o.scale.set(s * 1.3, s * (0.5 + rand() * 0.4), s * 1.3);
      o.rotation.set(rand() * 0.4, rand() * Math.PI, rand() * 0.4);
      o.updateMatrix();
      mesh.current.setMatrixAt(placed, o.matrix);
      mesh.current.setColorAt(placed, new Color().setHSL(0.24 + rand() * 0.07, 0.25, 0.03 + rand() * 0.03));
      placed++;
    }
    mesh.current.instanceMatrix.needsUpdate = true;
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true;
  }, [count]);
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, count]}>
      <icosahedronGeometry args={[1, 1]} />
      <meshStandardMaterial roughness={1} flatShading />
    </instancedMesh>
  );
};

export const LaunchSite = ({ sim, quality }) => (
  <group>
    <Ground shadows={!quality.low} />
    <Ocean />
    <Planet sim={sim} />
    <Pad shadows={!quality.low} />
    <LaunchMount shadows={!quality.low} />
    <Tower sim={sim} shadows={!quality.low} />
    <LightningMasts />
    <WaterTower />
    <LightPoles count={0} />
    <Buildings />
    <Trees count={quality.low ? 160 : 420} />
  </group>
);
