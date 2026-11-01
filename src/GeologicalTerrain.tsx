import {regionalPalette} from './regional-palette';
import {useMemo,useEffect,useRef} from 'react';
import {useFrame} from '@react-three/fiber';
import * as THREE from 'three';
import {toCreasedNormals} from 'three/addons/utils/BufferGeometryUtils.js';
import {terrainChunkMesh,substrateChunkMesh,substrateData} from './geological-substrate';
import {geologicalShape} from './geological-shapes';
import {terrainSurfaceMaterial} from './materials';
import {applyGeologicalSurface} from './geological-surface';
import {geology} from './model';
import {GEOLOGY} from './geological-catalog';
import type {MeshData} from './geometry';
export const substrateDiagnostics={chunks:64,lods:[0,0,0],instances:0,bufferBytes:0,fragmentBufferBytes:0,bodyBufferBytes:0,generationMs:0};
const rawGeometry=(mesh:MeshData)=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(mesh.vertices,3));g.setIndex(new THREE.BufferAttribute(mesh.indices,1));g.computeVertexNormals();return g;};
function GeologicalChunk({seed,x,z,groundMaterial,rockMaterial}:{seed:number;x:number;z:number;groundMaterial:THREE.Material;rockMaterial:THREE.Material}){
 const ref=useRef<THREE.Group>(null),level=useRef(0),geometries=useMemo(()=>{
  const start=performance.now();const levels=[0,1,2].map(lod=>{
   const terrain=terrainChunkMesh(seed,x,z,lod),land=rawGeometry(terrain),p=land.getAttribute('position'),normals=new Float32Array(p.count*3);
   for(let i=0;i<p.count;i++){const n=geology(p.getX(i),p.getZ(i),seed).normal;normals.set([n.x,n.y,n.z],i*3);}land.setAttribute('normal',new THREE.BufferAttribute(normals,3));applyGeologicalSurface(land,seed,{smooth:true,lod});land.computeBoundingBox();land.computeBoundingSphere();
   const body=substrateChunkMesh(seed,x,z,lod),g=rawGeometry(body);applyGeologicalSurface(g,seed,{smooth:true,lod,unitIds:body.units,contactWeights:body.contacts});const rock=toCreasedNormals(g,Math.PI*.3);g.dispose();rock.computeBoundingBox();rock.computeBoundingSphere();rock.userData.faceRanges=body.faceRanges;
   substrateDiagnostics.bufferBytes+=[land,rock].reduce((sum,g)=>sum+Object.values(g.attributes).reduce((n,a)=>n+a.array.byteLength,0)+(g.index?.array.byteLength??0),0);return {land,rock};
  });substrateDiagnostics.generationMs+=performance.now()-start;return levels;
 },[seed,x,z]);
 useEffect(()=>()=>geometries.forEach(g=>{g.land.dispose();g.rock.dispose();}),[geometries]);
 useFrame(({camera})=>{const distance=Math.hypot(camera.position.x-(-140+x*40),camera.position.z-(-140+z*40));const next=distance<75?0:distance<155?1:2;if(next!==level.current&&(next<level.current||distance>(level.current===0?83:163)))level.current=next;if(ref.current)ref.current.userData.lod=level.current;ref.current?.children.forEach((child,i)=>child.visible=i===level.current);});
 return <group ref={ref} name={'geological-chunk-'+x+'-'+z}>{geometries.map((g,i)=><group key={i} visible={i===0}><mesh name={'terrain-chunk-'+x+'-'+z} geometry={g.land} material={groundMaterial} userData={{inspection:'terrain'}} receiveShadow/><mesh name={'substrate-volume-'+x+'-'+z} geometry={g.rock} material={rockMaterial} userData={{inspection:'rock',faceRanges:g.rock.userData.faceRanges}} castShadow={i===0} receiveShadow/></group>)}</group>;
}
function SubstrateFragments({seed}:{seed:number}){
 const groups=useRef<(THREE.InstancedMesh|null)[]>([]),elapsed=useRef(0),lastCamera=useRef({x:Infinity,z:Infinity}),data=useMemo(()=>{
  const bodies=substrateData(seed).bodies.filter(b=>b.site.fragment),families=[...new Set(bodies.map(b=>b.site.family))],geometries=families.flatMap(family=>Array.from({length:6},(_,variant)=>[0,1,2].map(lod=>{const g=rawGeometry(geologicalShape(family,variant,lod));g.computeBoundingBox();g.computeBoundingSphere();return {family,variant,lod,g};})).flat()),material=new THREE.MeshStandardMaterial({color:'white',roughness:.94});material.userData.geological=true;
  const records=bodies.map(b=>{const s=b.site,c=Math.cos(s.strike),t=Math.sin(s.strike),matrix=new THREE.Matrix4().set(c*s.sx,0,t*s.sz,s.x,(b.gx*c-b.gz*t)*s.sx,s.sy,(b.gx*t+b.gz*c)*s.sz,b.height,-t*s.sx,0,c*s.sz,s.z,0,0,0,1),unit=GEOLOGY[s.unitId];return {site:s,matrix,color:new THREE.Color().setRGB(...regionalPalette(unit.color,seed,s.x,s.z) as [number,number,number],THREE.SRGBColorSpace)};});substrateDiagnostics.fragmentBufferBytes=geometries.reduce((n,{g})=>n+Object.values(g.attributes).reduce((n,a)=>n+a.array.byteLength,0)+(g.index?.array.byteLength??0),0)+geometries.length*Math.max(1,bodies.length)*76;substrateDiagnostics.bodyBufferBytes=substrateData(seed).bufferBytes;return {records,geometries,material,capacity:Math.max(1,bodies.length)};
 },[seed]);
 useEffect(()=>{lastCamera.current={x:Infinity,z:Infinity};return()=>{data.geometries.forEach(x=>x.g.dispose());data.material.dispose();};},[data]);
 useFrame(({camera},dt)=>{elapsed.current+=dt;if(elapsed.current<.25)return;elapsed.current=0;if(Math.hypot(camera.position.x-lastCamera.current.x,camera.position.z-lastCamera.current.z)<2)return;lastCamera.current.x=camera.position.x;lastCamera.current.z=camera.position.z;const counts=data.geometries.map(()=>0),identities=data.geometries.map(()=>[] as string[]);for(const record of data.records){const d=Math.hypot(camera.position.x-record.site.x,camera.position.z-record.site.z),lod=d<65?0:d<145?1:2,index=data.geometries.findIndex(g=>g.family===record.site.family&&g.variant===record.site.variant&&g.lod===lod),mesh=groups.current[index];if(!mesh)continue;const i=counts[index]++;mesh.setMatrixAt(i,record.matrix);mesh.setColorAt(i,record.color);identities[index].push(record.site.unitId);}groups.current.forEach((mesh,i)=>{if(!mesh)return;mesh.count=counts[i];mesh.userData.identities=identities[i];mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;mesh.computeBoundingBox();mesh.computeBoundingSphere();});substrateDiagnostics.instances=data.records.length;});
 return <>{data.geometries.map((g,i)=><instancedMesh key={i} name={'substrate-fragments-'+g.family+'-'+g.variant+'-'+g.lod} ref={m=>{groups.current[i]=m;}} args={[g.g,data.material,data.capacity]} count={0} userData={{inspection:'rock',identities:[]}} receiveShadow/>)}</>;
}
export function GeologicalTerrain({seed}:{seed:number}){
 const root=useRef<THREE.Group>(null);useFrame(()=>{const lods=[0,0,0];root.current?.children.forEach(child=>{if(child.name.startsWith("geological-chunk-"))lods[child.userData.lod??0]++;});substrateDiagnostics.lods=lods;});
 const materials=useMemo(()=>{substrateDiagnostics.bufferBytes=0;substrateDiagnostics.generationMs=0;return {ground:terrainSurfaceMaterial(),rock:terrainSurfaceMaterial()};},[seed]);useEffect(()=>()=>{materials.ground.dispose();materials.rock.dispose();},[materials]);
 return <group ref={root} name="global-geological-substrate">{Array.from({length:64},(_,i)=><GeologicalChunk key={i} seed={seed} x={i%8} z={Math.floor(i/8)} groundMaterial={materials.ground} rockMaterial={materials.rock}/>)}<SubstrateFragments seed={seed}/></group>;
}
