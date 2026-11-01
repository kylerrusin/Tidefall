import * as THREE from "three";
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { connection } from "./client";
import { controls } from "./controls";
export function FieldEffects() {
  const aim = useRef<THREE.Group>(null),
    lines = useRef<THREE.LineSegments>(null),
    ring = useRef<THREE.Group>(null);
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(4 * 14 * 6), 3).setUsage(
        THREE.DynamicDrawUsage,
      ),
    );
    return g;
  }, []);
  useFrame(({ clock }) => {
    if (aim.current) {
      aim.current.visible =
        controls.enabled && controls.slot === 3 && controls.aim.valid;
      aim.current.position.set(controls.aim.x, controls.aim.y, controls.aim.z);
      aim.current.rotation.y = clock.elapsedTime * 0.5;
    }
    if (ring.current) ring.current.rotation.y = clock.elapsedTime * 0.25;
    const state = connection.state;
    if (!state) return;
    const positions = geometry.attributes.position as THREE.BufferAttribute;
    let n = 0;
    for (const a of state.anchors)
      for (const o of state.objects) {
        const d = Math.hypot(a.x - o.x, a.y - o.y, a.z - o.z);
        if (d > 28 || n >= 56) continue;
        positions.setXYZ(n * 2, a.x, a.y, a.z);
        positions.setXYZ(n * 2 + 1, o.x, o.y, o.z);
        n++;
      }
    positions.needsUpdate = true;
    geometry.setDrawRange(0, n * 2);
  });
  return (
    <>
      <group ref={aim}>
        <mesh>
          <icosahedronGeometry args={[0.2, 0]} />
          <meshBasicMaterial color="#b4ece1" transparent opacity={0.6} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.65, 0.7, 32]} />
          <meshBasicMaterial
            color="#b4ece1"
            transparent
            opacity={0.5}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>
      <lineSegments ref={lines} geometry={geometry} frustumCulled={false}>
        <lineBasicMaterial
          color="#9ed7ce"
          transparent
          opacity={0.18}
          depthWrite={false}
        />
      </lineSegments>
      <group ref={ring} />
    </>
  );
}
