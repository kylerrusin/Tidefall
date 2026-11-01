import {meshGeologyAt} from './mesh-geology';
import {caveData} from './caves';
import {ROCK_INDICES,REFERENCE_SAMPLE_Y} from './rock-asset';
import RAPIER from "@dimforge/rapier3d-compat";
import {substrateChunkMesh,substrateSurface} from './geological-substrate';
import {facility} from './facility';
import {hubParts} from './hub';

import { Euler, Quaternion } from "three";
import { GRAVITY, LANDER, ground,geology } from "./model";
import { planetForSeed } from "./planets";
import { terrainMesh, caveMesh, structures, rockPlacements, ROCK_VERTICES } from "./geometry";
export { terrainMesh, caveMesh, structures, rockPlacements } from "./geometry";
let initialization: Promise<void> | undefined;
type ColliderGeology={kind:'terrain'|'rock';identity?:string;caveSeed?:number;substrateSeed?:number;materialAt?:ReturnType<typeof meshGeologyAt>};
const identities=new WeakMap<RAPIER.World,Map<number,ColliderGeology>>();
export const physicsIdentity=(world:RAPIER.World,handle:number,point?:{x:number;y?:number;z:number},_featureId?:number)=>{const data=identities.get(world)?.get(handle);if(data?.materialAt&&point?.y!==undefined)return {kind:'rock' as const,identity:data.materialAt(point)};if(data?.caveSeed!==undefined&&point)return {kind:'rock' as const,identity:caveData(data.caveSeed).unitAt({x:point.x,y:point.y??0,z:point.z})};return data?.substrateSeed!==undefined&&point?{kind:'rock' as const,identity:substrateSurface(point.x,point.z,data.substrateSeed)?.unitId}:data;};
export const initPhysics = () => (initialization ??= RAPIER.init());
// Use the same unit polyhedron and transform as the instanced render mesh.
export function rockCollider(r: ReturnType<typeof rockPlacements>[number],seed=42) {
  const vertices = Float32Array.from(ROCK_VERTICES, (v, i) => v * r.size * (i % 3 === 1 ? 0.8 : 1));
  const q = new Quaternion().setFromEuler(new Euler(0.1, r.angle, 0.12));
  return RAPIER.ColliderDesc.trimesh(vertices,ROCK_INDICES,RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES_TWO_SIDED)
    .setTranslation(r.x, r.y, r.z)
    .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w })
    .setFriction(geology(r.x,r.z,seed).friction);
}
export function createStaticWorld(seed: number) {
  const world = new RAPIER.World({ x: 0, y: -planetForSeed(seed).gravity, z: 0 });
  const materials=new Map<number,ColliderGeology>();identities.set(world,materials);
  world.timestep = 1 / 60;
  for (const [i, mesh] of [terrainMesh(seed), caveMesh(seed)].entries()){
    const collider=world.createCollider(
      RAPIER.ColliderDesc.trimesh(
        mesh.vertices,
        mesh.indices,
        i === 0
          ? RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES
          : RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES_TWO_SIDED,
      ).setFriction(0.85),
    );materials.set(collider.handle,i===0?{kind:'terrain'}:{kind:'rock',caveSeed:seed,materialAt:meshGeologyAt(caveData(seed).mesh)});}
  const cave=caveData(seed);world.createCollider(RAPIER.ColliderDesc.cuboid(1.4,.7,.07).setTranslation(cave.entrance.x+6,cave.entrance.y+1.5,cave.entrance.z-1));
  for(const station of cave.stations){const side=station.id%2?1:-1;world.createCollider(RAPIER.ColliderDesc.cuboid(.35,.3,.325).setTranslation(station.x-side*1.8,station.y+.31,station.z));world.createCollider(RAPIER.ColliderDesc.cuboid(.25,.09,.125).setTranslation(station.x+side*2.1,station.y+2.7,station.z));world.createCollider(RAPIER.ColliderDesc.cylinder(.1,.11).setTranslation(station.x-side*1.8,station.y+.75,station.z+.12));world.createCollider(RAPIER.ColliderDesc.cuboid(.018,.8,.018).setTranslation(station.x+side*2.1,station.y+1.8,station.z));}
  for (const s of [...structures(seed),...facility(seed).parts])
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(s.sx, s.sy, s.sz).setTranslation(
        s.x,
        s.y,
        s.z,
      ).setRotation(new Quaternion().setFromEuler(new Euler(s.rx??0,0,0))),
    );
  for(const room of facility(seed).rooms)if(room.sample){const vertices=Float32Array.from(ROCK_VERTICES,(v,i)=>v*.18+(i%3===0?room.x:i%3===1?facility(seed).y+REFERENCE_SAMPLE_Y:room.z));const c=world.createCollider(RAPIER.ColliderDesc.trimesh(vertices,ROCK_INDICES,RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES_TWO_SIDED));materials.set(c.handle,{kind:'rock',identity:room.sample});}
  for (const r of rockPlacements(seed)){const collider=world.createCollider(rockCollider(r,seed));materials.set(collider.handle,{kind:'rock',identity:r.unitId});}
  for(const part of hubParts(seed))world.createCollider(RAPIER.ColliderDesc.convexHull(part.vertices)!.setFriction(.8));
  for(let cz=0;cz<8;cz++)for(let cx=0;cx<8;cx++){const mesh=substrateChunkMesh(seed,cx,cz,0,false);if(!mesh.indices.length)continue;const c=world.createCollider(RAPIER.ColliderDesc.trimesh(mesh.vertices,mesh.indices,RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES_TWO_SIDED).setFriction(.85));materials.set(c.handle,{kind:"rock",substrateSeed:seed,materialAt:meshGeologyAt(mesh)});}
  return world;
}
