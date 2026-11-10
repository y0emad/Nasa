import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Lightformer, OrbitControls, Stars } from "@react-three/drei";
import { Bloom, EffectComposer, ToneMapping } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import { AdditiveBlending, Vector3 } from "three";
import { Spacecraft } from "./Rocket";
import { glowTexture, usePlanetTexture } from "../solar/textures";
import { graphicsProfile } from "../graphics";

const SUN = new Vector3(90, 35, 70);

const Earth = ({ reducedMotion }) => {
  const ref = useRef();
  const texture = usePlanetTexture("earth");
  useFrame((_, delta) => {
    if (!reducedMotion) ref.current.rotation.y += delta * 0.02;
  });
  return (
    <group position={[-34, -16, -70]}>
      <mesh ref={ref} rotation={[0, 0, 0.41]}>
        <sphereGeometry args={[7, 64, 64]} />
        <meshStandardMaterial key={texture ? "map" : "flat"} map={texture} color={texture ? "#ffffff" : "#2c5a8c"} roughness={0.85} />
      </mesh>
      <mesh scale={1.04}>
        <sphereGeometry args={[7, 48, 48]} />
        <meshBasicMaterial color="#5aa2ff" transparent opacity={0.12} blending={AdditiveBlending} depthWrite={false} />
      </mesh>
    </group>
  );
};

const Sun = () => (
  <group position={SUN}>
    <mesh>
      <sphereGeometry args={[3, 32, 32]} />
      <meshBasicMaterial color="#fff6e0" toneMapped={false} />
    </mesh>
    <sprite scale={[40, 40, 1]}>
      <spriteMaterial map={glowTexture()} blending={AdditiveBlending} depthWrite={false} transparent toneMapped={false} />
    </sprite>
  </group>
);

const Craft = ({ reducedMotion }) => {
  const ref = useRef();
  const deploy = useRef(1);
  useFrame((state) => {
    if (reducedMotion) return;
    const t = state.clock.elapsedTime;
    ref.current.rotation.set(Math.sin(t * 0.1) * 0.08, t * 0.06, 0.35 + Math.sin(t * 0.13) * 0.05);
  });
  return (
    <group ref={ref} rotation={[0, 0, 0.35]}>
      <group position={[0, -0.4, 0]}>
        <Spacecraft deploy={deploy} shadows={false} />
      </group>
    </group>
  );
};

const CruiseScene = () => {
  const quality = useMemo(graphicsProfile, []);
  const sunLight = useMemo(() => SUN.clone().normalize().multiplyScalar(20), []);
  return (
    <Canvas dpr={quality.dpr} camera={{ position: [3.4, 1.6, 5.2], fov: 45, near: 0.05, far: 2000 }} gl={{ antialias: quality.antialias }}>
      <color attach="background" args={["#000207"]} />
      <Environment resolution={64} frames={1}>
        <Lightformer form="circle" intensity={6} color="#fff3dc" position={sunLight} scale={6} />
        <Lightformer form="rect" intensity={1.2} color="#4f7fc4" position={[-20, -8, -40]} scale={[30, 30, 1]} />
        <Lightformer form="ring" intensity={0.8} color="#ffffff" position={[0, 10, 10]} scale={12} />
      </Environment>
      <ambientLight intensity={0.25} />
      <directionalLight position={sunLight} intensity={3} color="#fff3dc" />
      <Stars radius={500} depth={200} count={Math.round(7000 * quality.stars)} factor={5} saturation={0} fade speed={quality.reducedMotion ? 0 : 0.3} />
      <Sun />
      <Earth reducedMotion={quality.reducedMotion} />
      <Craft reducedMotion={quality.reducedMotion} />
      <OrbitControls
        enablePan={false}
        minDistance={2.5}
        maxDistance={14}
        autoRotate={!quality.reducedMotion}
        autoRotateSpeed={0.25}
        enableDamping
      />
      {!quality.low && (
        <EffectComposer multisampling={4} disableNormalPass>
          <Bloom mipmapBlur intensity={0.8} luminanceThreshold={1} />
          <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        </EffectComposer>
      )}
    </Canvas>
  );
};

export default CruiseScene;
