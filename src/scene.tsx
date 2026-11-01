import {ExcavationView,SamplingImpact} from './SamplingView';
import {stellarSpectrum} from './planet-physics';
import {shadowAnchor} from './shadow-anchor';
import {regionalPalette} from './regional-palette';
import {CLOUD_GLSL} from './cloud-shader';
import {cloudNoise} from './cloud-noise';
import {qaSunDirection,terrainQA} from './terrain-qa';
import {TerrainQAProbe} from './TerrainQAProbe';
import {LandingHub} from './HubView';
import {RenderMetrics} from './RenderMetrics';
import {LavaView} from './LavaView';
import {cabinWorld} from './cabin';
import {shipRotation} from './extraction';
import {ExtractionShip} from "./ExtractionShip";
import {InspectionProbe} from "./inspection";
import {
  Terrain,
  TerrainContinuation,
  Ocean,
  Cave,
  Vegetation,
  Sky,
  DistantRidges,
} from "./landscape";
import {ROCK_GEOMETRY} from "./rock-asset";
import { rockPlacements } from "./geometry";
import {OrbitalView} from './OrbitalView';
import {FacilityView} from './FacilityView';
import {GEOLOGY,SURFACE_TREATMENTS} from './geological-catalog';
import { VisibilityDiagnostics } from "./VisibilityDiagnostics";
import { supportElevation } from "./geometry";
import { refreshInstanceBounds } from "./instance-bounds";
import { geologicalMaterial, environmentUniforms } from "./materials";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, memo } from "react";
import { connection } from "./client";
import {
  DX,
  GRID,
  LANDER,
  MATERIALS,
  SITES,
  Snapshot,
  astronomy,
  cliffs,
  ground,
  surfaceAt,
  hash,
  terrain,
} from "./model";
import { Water } from "./water";
import { controls } from "./controls";
export { controls } from "./controls";
import { CameraRig } from "./CameraRig";
import { AstronomicalSky } from "./AstronomicalSky";
import { Gravel } from "./Gravel";
import { FirstPersonRifle, renderedMuzzle } from "./FirstPersonRifle";
import { CreatureView } from "./CreatureView";
import { CreatureDiagnostics } from "./CreatureDiagnostics";
import { NightStars, WeatherEffects, ThermalTerrain, SuitLight } from "./Atmosphere";
import { solarState,weatherAt } from "./climate";
import { planetForSeed } from "./planets";
import { celestial, celestialPosition, STAR_DIRECTION } from "./celestial";
import { SHELTERS, shelterPlacements, environment } from "./survival";
import { diagnostics } from "./presentation";
const COLORS = ["#e4f2ef", "#f5aa58", "#be9cff", "#6ce8d1"];
const CAMERA_OPTIONS = { fov: 74, near: 0.06, far: 1400 };
function Moon() {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#b9b8bb";
    ctx.fillRect(0, 0, 1024, 512);
    for (let i = 0; i < 18; i++) {
      ctx.beginPath();
      ctx.ellipse(
        hash(52, i, 1) * 1024,
        hash(52, i, 2) * 512,
        25 + hash(52, i, 3) * 85,
        14 + hash(52, i, 4) * 45,
        hash(52, i, 5) * 3,
        0,
        Math.PI * 2,
      );
      ctx.fillStyle = "rgba(66,76,83,.18)";
      ctx.fill();
    }
    for (let i = 0; i < 9000; i++) {
      const x = hash(71, i, 1) * 1024,
        y = hash(71, i, 2) * 512,
        r = 0.5 + hash(71, i, 3) ** 6 * 24;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${i % 3 === 0 ? "222,218,215" : "76,81,104"},${0.03 + hash(71, i, 4) * 0.14})`;
      if (r > 8) {
        const bowl = ctx.createRadialGradient(
          x - r * 0.18,
          y - r * 0.18,
          r * 0.05,
          x,
          y,
          r,
        );
        bowl.addColorStop(0, "rgba(63,67,76,.32)");
        bowl.addColorStop(0.75, "rgba(101,103,110,.12)");
        bowl.addColorStop(0.88, "rgba(221,213,197,.3)");
        bowl.addColorStop(1, "rgba(80,83,93,.1)");
        ctx.fillStyle = bowl;
      }
      ctx.fill();
      if (r > 5) {
        ctx.strokeStyle = "rgba(243,232,219,.17)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  const ref = useRef<THREE.Group>(null);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        depthWrite: false,
        uniforms: {
          map: { value: texture },cloudNoise:{value:cloudNoise},starTint:{value:new THREE.Color()},aerosol:{value:.08},clouds:{value:0},cloudTime:environmentUniforms.time,daylight:{value:1},column:{value:.24},eye:{value:new THREE.Vector3()},wind:{value:new THREE.Vector2()},
          star: {
            value: new THREE.Vector3(
              STAR_DIRECTION.x,
              STAR_DIRECTION.y,
              STAR_DIRECTION.z,
            ).normalize(),
          },
        },
        vertexShader: `varying vec2 vUv;varying vec3 n,moonRay;void main(){moonRay=(modelMatrix*vec4(position,1.)).xyz-cameraPosition;vUv=uv;n=normalize(mat3(modelMatrix)*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_Position.z=gl_Position.w*.999999;}`,
        fragmentShader:
          `uniform sampler2D map;uniform vec3 star,eye,starTint;uniform vec2 wind;uniform float clouds,cloudTime,daylight,column,aerosol;varying vec2 vUv;varying vec3 n,moonRay;${CLOUD_GLSL}
void main(){vec3 albedo=texture2D(map,vUv).rgb;float lit=max(0.,dot(normalize(n),star));vec3 color=albedo*(.055+lit*1.3);vec3 ray=normalize(moonRay);vec3 attenuation=exp(-column*vec3(.55,1.1,2.6)/max(.08,ray.y+.08));float mu=dot(ray,star),rayleigh=.059683*(1.+mu*mu),mie=.079577*(1.-.49)/pow(max(.03,1.+.49-1.4*mu),1.5);color=color*attenuation+vec3(.007,.012,.025)+(1.-attenuation)*starTint*(rayleigh*6.+mie*aerosol*4.)*daylight;vec4 bank=cloudLayer(ray,eye,star,wind,cloudTime,clouds,daylight,8.);color=mix(color,bank.rgb,bank.a);gl_FragColor=vec4(color,1.); #include <colorspace_fragment>}`.replace(
            "; #include",
            ";\n#include",
          ),
      }),
    [texture],
  );
  useEffect(
    () => () => {
      material.dispose();
      texture.dispose();
    },
    [material, texture],
  );
  const projected = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera }) => {
    if (ref.current) {
      ref.current.visible=(connection.state?.seed??42)>=0;
      const star=qaSunDirection(solarState(connection.state?.time??0,connection.state?.seed??42).direction);
      material.uniforms.star.value.set(star.x,star.y,star.z);const state=connection.state,w=weatherAt(state?.time??0,state?.seed??42,state?.extraction.timeline.duration);material.uniforms.clouds.value=import.meta.env.DEV&&terrainQA.active&&terrainQA.cloudCover>=0?terrainQA.cloudCover:w.clouds;material.uniforms.daylight.value=w.solar.daylight;const profile=planetForSeed(state?.seed??42);material.uniforms.column.value=profile.opticalDepth;material.uniforms.aerosol.value=profile.aerosol;material.uniforms.starTint.value.setRGB(...stellarSpectrum(profile.observed.st_teff));material.uniforms.eye.value.copy(camera.position);material.uniforms.wind.value.set(w.windX,w.windZ);
      const p = celestialPosition(camera.position, connection.state?.time ?? 0);
      ref.current.position.set(p.x, p.y, p.z);
      projected.copy(ref.current.position).project(camera);
      diagnostics.moonScreen =
        projected.x.toFixed(2) + ", " + projected.y.toFixed(2);
    }
  });
  return (
    <group ref={ref}>
      <mesh renderOrder={-90} frustumCulled={false} material={material}>
        <sphereGeometry args={[celestial(0).radius, 64, 40]} />
      </mesh>
    </group>
  );
}
function Scenery({ seed }: { seed: number }) {
  const rock = useRef<THREE.InstancedMesh>(null),
    crystal = useRef<THREE.InstancedMesh>(null),
    placements = useMemo(() => rockPlacements(seed), [seed]);
  const mat = useMemo(() => geologicalMaterial("white", true,false,true), []);
  useEffect(() => {
    const o = new THREE.Object3D(),
      color = new THREE.Color();
    placements.forEach((p, i) => {
      o.position.set(p.x, p.y, p.z);
      o.scale.set(p.size, p.size * 0.8, p.size);
      o.rotation.set(0.1, p.angle, 0.12);
      o.updateMatrix();
      rock.current!.setMatrixAt(i, o.matrix);
      rock.current!.setColorAt(i, color.setRGB(...regionalPalette(GEOLOGY[p.unitId].color,seed,p.x,p.z) as [number,number,number],THREE.SRGBColorSpace));
    });
    refreshInstanceBounds(rock.current!);
    const styles=Float32Array.from(placements.flatMap(p=>{const u=GEOLOGY[p.unitId];return [SURFACE_TREATMENTS[u.treatment],u.porosity,.2];}));rock.current!.geometry.setAttribute('surfaceStyle',new THREE.InstancedBufferAttribute(styles,3));
    for (let i = 0; i < 65; i++) {
      const a = hash(seed, i, 21) * Math.PI * 2,
        r = 3 + hash(seed, i, 22) * 12,
        x = 68 + Math.cos(a) * r,
        z = 2 + Math.sin(a) * r;
      o.position.set(0,0,0);
      o.scale.set(
        0.2 + hash(seed, i, 23) * 0.4,
        0.8 + hash(seed, i, 24) * 2.3,
        0.25,
      );
      if(surfaceAt(x,z,seed).slope>.8)o.scale.setScalar(0);
      o.rotation.set(0.15, a, 0.2);
      o.updateMatrix();
      const contact=supportElevation(x,z,crystal.current!.geometry.attributes.position.array,o.matrix,.12+o.scale.y*.22,seed);
      o.position.set(x,contact,z);o.updateMatrix();
      crystal.current!.setMatrixAt(i, o.matrix);
    }
    refreshInstanceBounds(crystal.current!);
  }, [seed, placements]);
  return (
    <>
      <instancedMesh
        ref={rock}
        name="static-rocks"
        userData={{inspection:'rock',identities:placements.map(p=>p.unitId)}}
        args={[undefined, undefined, placements.length]}
        material={mat}
        castShadow
        receiveShadow
      >
        <primitive object={ROCK_GEOMETRY} attach="geometry"/>
      </instancedMesh>
      <instancedMesh ref={crystal} userData={{inspection:'mineral',identity:seed<0?'TDF-LT-035':'TDF-MN-027'}} args={[undefined, undefined, 65]}>
        <octahedronGeometry args={[1, 0]} />
        <meshStandardMaterial
          color={seed<0?"#d4b457":"#d4c591"}
          emissive={seed<0?"#a16422":"#a0d7a0"}
          emissiveIntensity={0.28}
          roughness={0.35}
          metalness={0.2}
        />
      </instancedMesh>
      {import.meta.env.DEV && <VisibilityDiagnostics mesh={rock}/>}
      <Vegetation seed={seed} />

      <FacilityView seed={seed}/>
      <Cave seed={seed} />
      <DistantRidges seed={seed} />
      <Observatory seed={seed} />
      <LandingHub seed={seed} />
      <Steam seed={seed} />
      <SurvivalScenery seed={seed} />
    </>
  );
}
function PulseView({ from, to, hit, kind, shooter,normal,unitId }: {normal?:{x:number;y:number;z:number};unitId?:string; shooter?:string; from: { x: number; y: number; z: number }; to: { x: number; y: number; z: number }; hit: boolean; kind?: string }) {
  const geometry = useMemo(() => new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(from.x, from.y, from.z), new THREE.Vector3(to.x, to.y, to.z),
  ]), [from.x, from.y, from.z, to.x, to.y, to.z]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useFrame(()=>{if(shooter===connection.id){const p=geometry.attributes.position as THREE.BufferAttribute;p.setXYZ(0,renderedMuzzle.x,renderedMuzzle.y,renderedMuzzle.z);p.needsUpdate=true;geometry.computeBoundingSphere();}});
  return <>
    <lineSegments geometry={geometry}><lineBasicMaterial color="#b4fff0" transparent opacity={0.85} /></lineSegments>
    {kind==="sample"&&<SamplingImpact pulse={{id:0,shooter:shooter??"",from,to,hit,kind:"sample",normal,unitId,expires:(connection.state?.pulses.find(p=>p.shooter===shooter&&p.to.x===to.x)?.expires??0)}}/>}
    {hit && kind!=="sample" && kind!=="sample-reject" && <mesh position={[to.x, to.y, to.z]}><sphereGeometry args={[kind === "creature" ? 0.26 : 0.17, 8, 6]} /><meshBasicMaterial color={kind === "creature" ? "#9bffc3" : kind === "object" ? "#ffdb96" : "#d9e5df"} /></mesh>}
  </>;
}
function ProjectileView({id}:{id:number}) {
  const ion=connection.state?.projectiles.find(p=>p.id===id)?.kind==="ion";
  const ref=useRef<THREE.Group>(null);
  useFrame(()=>{const s=connection.state,latest=s?.projectiles.find(p=>p.id===id);if(!ref.current)return;ref.current.visible=!!latest;const p=connection.history.sampleProjectile(id,performance.now()/1000)??latest;if(p)ref.current.position.set(p.x,p.y,p.z);});
  return <group ref={ref}><mesh><sphereGeometry args={[.18,10,8]}/><meshBasicMaterial color={ion?"#8fdaff":"#ffd59c"}/></mesh><mesh scale={1.7}><sphereGeometry args={[.18,8,6]}/><meshBasicMaterial color={ion?"#327ecc":"#ffae68"} transparent opacity={.18} depthWrite={false}/></mesh></group>;
}
function PhysicsDebug() {
  const ref = useRef<THREE.LineSegments>(null), elapsed = useRef(0);
  const geometry = useMemo(() => new THREE.BufferGeometry(), []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useFrame((_, dt) => {
    if (!ref.current) return;
    ref.current.visible = import.meta.env.DEV && controls.physicsDebug;
    if (!ref.current.visible || !connection.prediction) return;
    elapsed.current += dt;
    if (elapsed.current < 0.25) return;
    elapsed.current = 0;
    const lines = connection.prediction.world.debugRender();
    geometry.setAttribute("position", new THREE.BufferAttribute(lines.vertices, 3));
    // Rapier colors are RGBA; Three.js line materials consume RGB here.
    const rgb = new Float32Array(lines.colors.length / 4 * 3);
    for (let i = 0; i < rgb.length / 3; i++) rgb.set(lines.colors.subarray(i * 4, i * 4 + 3), i * 3);
    geometry.setAttribute("color", new THREE.BufferAttribute(rgb, 3));
    geometry.computeBoundingSphere();
  });
  return <lineSegments ref={ref} geometry={geometry} frustumCulled={false} renderOrder={50}><lineBasicMaterial vertexColors depthTest={false} /></lineSegments>;
}
function Observatory({ seed }: { seed: number }) {
  const y = ground(8, 72, seed);
  return (
    <group position={[8, y, 72]}>
      {[-1, 1].flatMap((s) =>
        [-8, 4].map((z) => (
          <mesh
            key={s + ":" + z}
            position={[s * 7, ground(8 + s * 7, 72 + z, seed) - y + 8, z]}
            castShadow
          >
            <boxGeometry args={[2.2, 16, 2.2]} />
            <meshStandardMaterial
              color="#7b8888"
              metalness={0.45}
              roughness={0.5}
            />
          </mesh>
        )),
      )}
      <mesh position={[0, 16, 0]} rotation={[0.14, 0.12, -0.15]} castShadow>
        <torusGeometry args={[10, 0.8, 8, 64, Math.PI * 1.8]} />
        <meshStandardMaterial
          color="#798988"
          metalness={0.45}
          roughness={0.48}
        />
      </mesh>
      <mesh position={[0, 9, 0]} rotation={[0.14, 0.12, -0.15]}>
        <torusGeometry args={[8.7, 0.08, 5, 64, Math.PI * 1.6]} />
        <meshStandardMaterial
          color="#f1bd75"
          emissive="#b37e3c"
          emissiveIntensity={0.15}
        />
      </mesh>
      <mesh position={[0, 1, 0]}>
        <cylinderGeometry args={[1.5, 2, 2, 10]} />
        <meshStandardMaterial
          color="#526b74"
          metalness={0.6}
          roughness={0.35}
        />
      </mesh>
    </group>
  );
}
function Steam({ seed }: { seed: number }) {
  const ref = useRef<THREE.InstancedMesh>(null),
    dummy = useMemo(() => new THREE.Object3D(), []),
    base = useMemo(
      () =>
        Array.from({ length: 28 }, (_, i) => {
          const x = 68 + Math.sin(i * 4) * 3,
            z = 2 + Math.cos(i * 5) * 3;
          return { x, z, y: ground(x, z, seed) };
        }),
      [seed],
    );
  useFrame(({ clock }) => {
    for (let i = 0; i < base.length; i++) {
      const t = (clock.elapsedTime * 0.12 + i / base.length) % 1,
        p = base[i];
      dummy.position.set(p.x + Math.sin(t * 6 + i) * t * 2, p.y + t * 13, p.z);
      dummy.scale.setScalar(0.3 + t * 1.6);
      dummy.updateMatrix();
      ref.current!.setMatrixAt(i, dummy.matrix);
    }
    ref.current!.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, 28]}>
      <sphereGeometry args={[1, 6, 4]} />
      <meshBasicMaterial
        color="#c3d4cc"
        transparent
        opacity={0.08}
        depthWrite={false}
      />
    </instancedMesh>
  );
}
function Astronaut({ color = 0, id }: { color?: number; id?: string }) {
  const limbs = useRef<Array<THREE.Group | null>>([]),
    jet = useRef<THREE.Group>(null);
  useFrame(({ clock }, dt) => {
    const p = id
        ? id === connection.id
          ? connection.presentation
          : connection.history.sample(id, performance.now() / 1000)
        : null,
      speed = p ? Math.hypot(p.vx, p.vz) : 0,
      phase = clock.elapsedTime * (speed > 7 ? 12 : 8);
    for (let i = 0; i < 4; i++) {
      const limb = limbs.current[i];
      if (!limb) continue;
      const desired =
        p?.cabin?.seat!=null?(i<2?.35:-1.1):p && !p.grounded
          ? i < 2
            ? -0.25
            : 0.25
          : Math.sin(phase + (i % 2) * Math.PI) *
            (i < 2 ? 0.45 : 0.65) *
            Math.min(1, speed / 5);
      limb.rotation.x = THREE.MathUtils.lerp(
        limb.rotation.x,
        desired,
        1 - Math.exp(-dt * 15),
      );
    }
    if (jet.current) {
      jet.current.visible = !!p?.thrusting;
      jet.current.scale.y = 0.8 + Math.sin(clock.elapsedTime * 45) * 0.2;
    }
  });
  return (
    <group>
      <mesh position={[0, 0.12, 0]} castShadow>
        <capsuleGeometry args={[0.32, 0.52, 4, 8]} />
        <meshStandardMaterial color={COLORS[color]} roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.81, 0]} castShadow>
        <sphereGeometry args={[0.36, 16, 12]} />
        <meshStandardMaterial
          color={COLORS[color]}
          roughness={0.4}
          metalness={0.25}
        />
      </mesh>
      <mesh position={[0, 0.82, 0.22]}>
        <sphereGeometry args={[0.29, 16, 10, 0, Math.PI]} />
        <meshStandardMaterial
          color="#192e3b"
          metalness={0.75}
          roughness={0.16}
        />
      </mesh>
      <mesh position={[0, 0.18, -0.35]}>
        <boxGeometry args={[0.48, 0.7, 0.3]} />
        <meshStandardMaterial color="#525d68" />
      </mesh>
      {[-1, 1].map((sign, i) => (
        <group key={sign}>
          <group
            ref={(v) => {
              limbs.current[i] = v;
            }}
            position={[sign * 0.43, 0.38, 0]}
          >
            <mesh position={[0, -0.28, 0]}>
              <capsuleGeometry args={[0.13, 0.5, 3, 6]} />
              <meshStandardMaterial color={COLORS[color]} />
            </mesh>
          </group>
          <group
            ref={(v) => {
              limbs.current[i + 2] = v;
            }}
            position={[sign * 0.2, -0.25, 0]}
          >
            <mesh position={[0, -0.3, 0]}>
              <capsuleGeometry args={[0.16, 0.5, 3, 6]} />
              <meshStandardMaterial color="#465660" />
            </mesh>
            <mesh position={[0, -0.67, 0.1]}>
              <boxGeometry args={[0.3, 0.2, 0.5]} />
              <meshStandardMaterial color="#293a45" />
            </mesh>
          </group>
        </group>
      ))}
      <group ref={jet}>
        {[-1, 1].map((sign) => (
          <mesh
            key={sign}
            position={[sign * 0.17, -0.62, -0.4]}
            rotation={[Math.PI, 0, 0]}
          >
            <coneGeometry args={[0.11, 0.8, 8]} />
            <meshBasicMaterial color="#ace8e8" transparent opacity={0.75} />
          </mesh>
        ))}
      </group>
      <mesh position={[0, 0.2, 0.34]}>
        <boxGeometry args={[0.15, 0.13, 0.04]} />
        <meshBasicMaterial color="#b7e9d4" />
      </mesh>
      <pointLight
        position={[0, 0.4, 0.5]}
        color="#c4e1c9"
        intensity={0.8}
        distance={6}
      />
    </group>
  );
}
function Explorer({ id }: { id: string }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    const p =
      id === connection.id
        ? connection.presentation
        : connection.history.sample(id, performance.now() / 1000);
    if (!p || !ref.current) return;
    ref.current.position.set(p.x, p.y, p.z);
    ref.current.rotation.set(0,p.yaw,0);
    if(p.cabin&&connection.state?.extraction.site){const e=connection.state.extraction,c=connection.history.sample(id,performance.now()/1000)?.cabin??p.cabin,pos=cabinWorld(c,connection.frameTime,e.site!,e.timeline),q=shipRotation(connection.frameTime,e.timeline);ref.current.position.set(pos.x,pos.y,pos.z);ref.current.quaternion.premultiply(new THREE.Quaternion(q.x,q.y,q.z,q.w));}
    ref.current.visible =
      id !== connection.id && id !== controls.spectating && (p.alive||!!p.cabin);
  });
  const p = connection.state?.players.find((p) => p.id === id);
  return (
    <group ref={ref}>
      <Astronaut color={p?.color} id={id} />
      {id !== connection.id && (
        <mesh position={[0, 2, 0]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.18, 0.45, 4]} />
          <meshBasicMaterial color={COLORS[p?.color ?? 0]} />
        </mesh>
      )}
    </group>
  );
}
function PhysicsObject({ id }: { id: number }) {
  const ref = useRef<THREE.Mesh>(null);
  const o = connection.state!.objects.find((o) => o.id === id)!;
  useFrame((_, dt) => {
    const target = connection.history.sampleObject(
      id,
      performance.now() / 1000,
    );
    if (ref.current && target) {
      ref.current.position.set(target.x, target.y, target.z);
      if(target.rotation)ref.current.quaternion.set(target.rotation.x,target.rotation.y,target.rotation.z,target.rotation.w);
    }
  });
  return (
    <mesh
      ref={ref}
      name="physical-object"
      userData={{ physicalObjectId: id }}
      castShadow
    >
      {o.material === "crate" ? (
        <boxGeometry args={[o.radius * 2, o.radius * 1.3, o.radius * 2]} />
      ) : (
        <dodecahedronGeometry args={[o.radius, 1]} />
      )}
      <meshStandardMaterial
        color={o.unitId?new THREE.Color().setRGB(...GEOLOGY[o.unitId].color as [number,number,number],THREE.SRGBColorSpace):MATERIALS[o.material].color}
        roughness={0.9}
      />
    </mesh>
  );
}
function SurvivalScenery({ seed }: { seed: number }) {
  const supplies = connection.state?.supplies ?? [];
  return (
    <>
      {shelterPlacements(seed).map(s=><group key={s.id} userData={{inspection:"shelter",identity:s.name}}>
        {s.parts.map((part,i)=><mesh key={i} position={[part.x,part.y,part.z]} castShadow receiveShadow><boxGeometry args={[part.sx*2,part.sy*2,part.sz*2]}/><meshStandardMaterial color={part.role==="foundation"?"#424e52":part.role==="floor"?"#777b6e":"#63777b"} roughness={.85}/></mesh>)}
        <mesh position={[s.x,s.y+2.7,s.z-3.13]}><boxGeometry args={[1.6,.12,.06]}/><meshBasicMaterial color="#b4d9be"/></mesh>
      </group>)}
      {supplies
        .filter((s) => !s.takenBy)
        .map((s) => (
          <SupplyView key={s.id} id={s.id} />
        ))}
    </>
  );
}
function SupplyView({ id }: { id: string }) {
  const ref = useRef<THREE.Group>(null),
    s = connection.state?.supplies.find((s) => s.id === id);
  useFrame(() => {
    const latest = connection.state?.supplies.find((s) => s.id === id);
    if (ref.current && latest)
      ref.current.position.set(latest.x, latest.y, latest.z);
  });
  if (!s || s.takenBy || s.active===false) return null;
  const color =
    s.kind === "oxygen"||s.kind==="coolant"
      ? "#a8d8d5"
      : s.kind === "insulation"
        ? "#dcad66"
        : s.kind==="bio"?"#88cba1":"#b3a0cd";
  if(s.objectId!==undefined && s.objectId>=14)return <group ref={ref} position={[s.x,s.y,s.z]}><mesh rotation={[-Math.PI/2,0,0]} position={[0,.23,0]}><ringGeometry args={[.3,.34,24]}/><meshBasicMaterial color={s.kind==="bio"?"#9de7b5":"#e5b96f"} transparent opacity={.65}/></mesh></group>;
  return (
    <group ref={ref} position={[s.x, s.y, s.z]} userData={{supplyId:id}}>
      <mesh castShadow>
        {s.kind === "oxygen" || s.kind==="coolant" ? (
          <cylinderGeometry args={[0.18, 0.18, 0.7, 12]} />
        ) : (
          <boxGeometry args={[0.5, 0.38, 0.5]} />
        )}
        <meshStandardMaterial color={color} metalness={0.35} roughness={0.5} />
      </mesh>
      {s.kind==="bio"&&<group position={[0,0,-.258]}><mesh><boxGeometry args={[.17,.045,.01]}/><meshBasicMaterial color="#e6f4e8"/></mesh><mesh><boxGeometry args={[.045,.17,.01]}/><meshBasicMaterial color="#e6f4e8"/></mesh></group>}
      <mesh position={[0, 0.12, s.kind==="oxygen"||s.kind==="coolant"?-.19:-.257]}>
        <boxGeometry args={[0.13, 0.2, 0.03]} />
        <meshBasicMaterial color="#243d43" />
      </mesh>
      <mesh position={[0, 0.5, 0]}>
        <sphereGeometry args={[0.035, 8, 6]} />
        <meshBasicMaterial color={color} />
      </mesh>
    </group>
  );
}
function World({ state }: { state: Snapshot | null }) {
  const seed = state?.seed ?? 42;
  const sun = useRef<THREE.DirectionalLight>(null);
  const ambient=useRef<THREE.HemisphereLight>(null);
  const fogColors = useMemo(
    () => ({
      clear: new THREE.Color("#718d98"),
      storm: new THREE.Color("#526975"),
      front: new THREE.Color("#92a6ad"),
      pyrax:new THREE.Color("#b28c79"),night:new THREE.Color("#101b30"),
    }),
    [],
  );
  useFrame(({ clock, scene }) => {
    const current=connection.state,time=current?current.time+Math.min(.12,(performance.now()-connection.lastState)/1000):clock.elapsedTime;
    environmentUniforms.time.value = time;
    const weather = environment(time,current?.seed??42,current?.extraction.timeline.duration),planet=planetForSeed(current?.seed??42);
    environmentUniforms.tide.value = weather.sea;
    environmentUniforms.storm.value = weather.storm;
    environmentUniforms.thermal.value = planet.water?0:1;
    const fog = scene.fog as THREE.Fog;
    if (fog) {
      fog.color
        .copy(fogColors.clear)
        .lerp(fogColors.storm, weather.storm)
        .lerp(fogColors.front, weather.front * 0.6);
      if(!planet.water)fog.color.lerp(fogColors.pyrax,.6);
      fog.color.lerp(fogColors.night,weather.solar.night*.9);
      fog.near = 160 - weather.storm * 70 - weather.front * 40;
      fog.far = 720 - weather.storm * 300 - weather.front * 160;
    }
    if(sun.current){
      const dir=qaSunDirection(weather.solar.direction);const p=connection.presentation,anchor=shadowAnchor(p??{x:0,y:10,z:0},dir),tx=anchor.x,tz=anchor.z,ty=anchor.y;
      sun.current.target.position.set(tx,ty,tz);sun.current.target.updateMatrixWorld();
      sun.current.position.set(tx+dir.x*160,ty+dir.y*160,tz+dir.z*160);
      sun.current.intensity=2.8*Math.max(0,dir.y)*(1-weather.storm*.65)*Math.min(3.2,Math.sqrt(planet.irradiation));
    }
    if(ambient.current)ambient.current.intensity=.23+weather.solar.daylight*1.25;
  });
  return (
    <>
      <color attach="background" args={["#344458"]} />
      <fog attach="fog" args={["#718d98", 160, 720]} />
      <hemisphereLight ref={ambient} args={["#bfd6df", "#636452", 1.6]} />
      <directionalLight
        ref={sun}
        position={[-100, 160, -80]}
        color="#ffe1bc"
        intensity={3}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-64}
        shadow-camera-right={64}
        shadow-camera-top={64}
        shadow-camera-bottom={-64}
        shadow-camera-near={1}
        shadow-camera-far={360}
        shadow-bias={-0.00004}
        shadow-normalBias={.035}
        shadow-radius={2}
      />
      <Sky />
      <OrbitalView/>
      <NightStars />
      <AstronomicalSky seed={seed}/>
      <SuitLight />
      <WeatherEffects />
      <Moon />
      <Terrain seed={seed} />
      <TerrainContinuation seed={seed}/>
      <Scenery seed={seed} />
      <Gravel seed={seed}/>
      <Ocean seed={seed} />
      {seed<0 && <LavaView seed={seed}/>}
      <CameraRig />{import.meta.env.DEV&&<><RenderMetrics/><TerrainQAProbe/></>}
      <FirstPersonRifle />
      <ExcavationView/>
      <ExtractionShip/>
      <InspectionProbe/>
      {import.meta.env.DEV && <PhysicsDebug />}
      {import.meta.env.DEV && <CreatureDiagnostics />}
      {state?.players
        .filter((p) => p.alive||p.cabin)
        .map((p) => (
          <Explorer key={p.id} id={p.id} />
        ))}
      <group name="interactables">
        {state?.objects.filter(o=>o.active!==false).map((o) => (
          <PhysicsObject key={`${seed}-${o.id}`} id={o.id} />
        ))}
      </group>
      {state?.stalkers.map(s => <CreatureView key={s.id+':'+(s.generation??0)} id={s.id} />)}
      {state?.pulses.map(p => <PulseView key={p.id} {...p} />)}
      {state?.projectiles.map(p => <ProjectileView key={p.id} id={p.id}/>)}
      {state?.anchors.map((a) => (
        <group key={a.owner} position={[a.x, a.y, a.z]}>
          <mesh>
            <icosahedronGeometry args={[0.28, 1]} />
            <meshBasicMaterial color={a.sign > 0 ? "#8aeedd" : "#d89cff"} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <torusGeometry args={[1.5, 0.025, 6, 64]} />
            <meshBasicMaterial color={a.sign > 0 ? "#8aeedd" : "#d89cff"} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[28, 0.035, 4, 96]} />
            <meshBasicMaterial
              color={a.sign > 0 ? "#8aeedd" : "#d89cff"}
              transparent
              opacity={0.12}
              depthWrite={false}
            />
          </mesh>
          <pointLight color="#94ffe4" intensity={12} distance={10} />
        </group>
      ))}
    </>
  );
}
function GameSceneComponent({
  state,
  quality,
}: {
  state: Snapshot | null;
  quality: boolean;
}) {
  return (
    <Canvas
      shadows={quality ? { type: THREE.PCFShadowMap } : false}
      dpr={quality ? [1, 1.25] : 1}
      camera={CAMERA_OPTIONS}
      gl={{ antialias: quality, powerPreference: "high-performance" }}
    >
      <World key={`${state?.code??"preview"}:${state?.seed??42}:${state?.status==="ready"?"lobby":"surface"}`} state={state} />
    </Canvas>
  );
}

const sceneKey = (s: Snapshot | null) =>
  s
    ? [
        s.seed,
        s.status,
        s.pulses.map(p=>p.id).join(","),
        s.projectiles.map(p=>p.id).join(","),
        s.stalkers.map(s=>s.id+':'+s.kind+':'+(s.generation??0)).join(","),
        s.objects.filter(o=>o.active!==false).map(o=>o.id).join(","),

        s.players
          .map((p) => p.id + ":" + p.connected + ":" + p.alive+":"+!!p.cabin)
          .join(","),
        s.supplies.map((a) => a.id+":"+a.takenBy+":"+a.active).join(","),
        s.anchors
          .map((a) => [a.owner, a.sign, a.x, a.y, a.z].join(":"))
          .join(","),
      ].join("|")
    : "preview";
export const GameScene = memo(
  GameSceneComponent,
  (a, b) => a.quality === b.quality && sceneKey(a.state) === sceneKey(b.state),
);
