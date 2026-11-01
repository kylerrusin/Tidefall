import {caveData} from './caves';
import {openCaveEntrance,inCaveOpening} from './cave-opening';
import {facility} from './facility';
import {solidHeight} from './surface-query';
import {geologicalField} from "./geological-fields";
import {
  TERRAIN_DX as DX,
  TERRAIN_GRID as GRID,
  GRAVITY,
  LANDER,
  SITES,
  ground,
  hash,
  terrain,
  distantTerrainHeight,
  worldSubstrate,
} from "./model";
import { shelterPlacements,type StructuralPart } from "./placement";
import { DodecahedronGeometry, Euler, Matrix4, Quaternion, Vector3 } from "three";
export {ROCK_GEOMETRY} from './rock-asset';
import {ROCK_CONTACT_VERTICES} from './rock-asset';
export const ROCK_VERTICES = ROCK_CONTACT_VERTICES;
export function supportElevation(x: number, z: number, vertices: ArrayLike<number>, transform: Matrix4, burial: number, seed: number) {
  const point=new Vector3();let y=-Infinity;
  for(let i=0;i<vertices.length;i+=3){
    point.set(vertices[i],vertices[i+1],vertices[i+2]).applyMatrix4(transform);
    y=Math.max(y,solidHeight(x+point.x,z+point.z,seed)-point.y);
  }
  return y-burial;
}
export type MeshData = { vertices: Float32Array; indices: Uint32Array };
/** Stitched square rings continue every perimeter vertex without a crack or abrupt terrain square. */
export const TERRAIN_APRON_RINGS=[160,185,215,250,295,355,435,540,680,850,1030,1200] as const;
export const TERRAIN_RING_VERTICES=512;
export function terrainApron(seed:number):MeshData{
  const vertices:number[]=[],indices:number[]=[],rings=TERRAIN_APRON_RINGS,count=TERRAIN_RING_VERTICES,sideCount=count/4;
  for(const radius of rings)for(let i=0;i<count;i++){
    const side=Math.floor(i/sideCount),t=(i%sideCount)/sideCount,edge=-1+2*t;
    const x=radius*(side===0?edge:side===1?1:side===2?-edge:-1),z=radius*(side===0?-1:side===1?edge:side===2?1:-edge);
    vertices.push(x,distantTerrainHeight(x,z,seed),z);
  }
  for(let ring=0;ring<rings.length-1;ring++)for(let i=0;i<count;i++){const a=ring*count+i,b=ring*count+(i+1)%count,c=a+count,d=b+count;indices.push(a,b,c,b,d,c);}
  return {vertices:new Float32Array(vertices),indices:new Uint32Array(indices)};
}
export function terrainMesh(seed: number): MeshData {
  const vertices: number[] = [],
    indices: number[] = [];
  for (let z = 0; z < GRID; z++)
    for (let x = 0; x < GRID; x++)
      vertices.push(
        x * DX - 160,
        terrain(x * DX - 160, z * DX - 160, seed),
        z * DX - 160,
      );
  for (let z = 0; z < GRID - 1; z++)
    for (let x = 0; x < GRID - 1; x++) {
      const a = z * GRID + x;
      indices.push(a, a + GRID, a + 1, a + 1, a + GRID, a + GRID + 1);
    }
  return openCaveEntrance({
    vertices: new Float32Array(vertices),
    indices: new Uint32Array(indices),
  });
}
/** Shared cached underground interior; the surface cut is handled separately. */
export function caveMesh(seed:number):MeshData{return caveData(seed).mesh;}
export function structures(seed: number):StructuralPart[] {
  const ruins = [-1, 1].flatMap((s) =>
    [64, 76].map((z) => ({
      x: 8 + s * 7,
      y: ground(8 + s * 7, z, seed) + 8,
      z,
      sx: 1.1,
      sy: 8,
      sz: 1.1,
    })),
  );
  return [
    ...ruins,
    ...shelterPlacements(seed).flatMap(s=>s.parts),
  ];
}
export function rockPlacements(seed: number) {
  const list: {
    x: number;
    y: number;
    z: number;
    size: number;
    angle: number;
    color: string;
    unitId:string;
    facies:string;
  }[] = [];
  for (let i = 0; i < 280; i++) {
    const x = (hash(seed, i, 1) - 0.5) * 310,
      z = hash(seed, i, 2) * 285 - 125;
    if (
      Math.hypot(x - LANDER.x, z - LANDER.z) < 24 ||
      SITES.some((s) => Math.hypot(x - s.x, z - s.z) < 10)
    )
      continue;
    if(shelterPlacements(seed).some(s=>Math.hypot(x-s.x,z-s.z)<8))continue;
    const f=facility(seed),floor=f.parts.find(p=>p.role==="floor");if(floor&&(Math.abs(x-f.x)<floor.sx+2&&Math.abs(z-f.z)<floor.sz+2||Math.abs(x-f.x)<4&&z<f.z-18&&z>f.z-(seed<0?43:29)))continue;
    if(inCaveOpening(x,z,3))continue;
    const h = ground(x, z, seed);
    if (h < -3 || (Math.abs(x) < 24 && z < 60 && hash(seed, i, 3) > 0.2))
      continue;
    const size = 0.35 + hash(seed, i, 3) ** 3 * (Math.abs(x) > 65 ? 4 : 2.3);
    if(size>1.3&&worldSubstrate(seed).sites.some(s=>!s.fragment&&Math.hypot((x-s.x)/(s.sx*1.4+size),(z-s.z)/(s.sz*1.4+size))<1))continue;
    const geo=geologicalField(x,z,h,.5,seed),angle=geo.strike+hash(seed,i,8)*.28;
    const talus=geo.weights.basalt+geo.weights.carbonate>.7&&geo.appearance.inputs.weathering>.4;
    if(seed>=0&&hash(seed,i,53)>(talus?.74:.57))continue;
    if(!talus&&list.some(r=>Math.hypot(r.x-x,r.z-z)<Math.max(2.4,(r.size+size)*1.6)))continue;
    const transform=new Matrix4().compose(new Vector3(),new Quaternion().setFromEuler(new Euler(.1,angle,.12)),new Vector3(size,size*.8,size));
    list.push({
      x,
      y: supportElevation(x,z,ROCK_VERTICES,transform,size*.2,seed),
      z,
      size,
      angle,
      unitId:geo.unitId,facies:geo.facies,
      color: "#"+geo.color.map(v=>Math.round(v*255).toString(16).padStart(2,"0")).join(""),
    });
  }
  return list;
}
