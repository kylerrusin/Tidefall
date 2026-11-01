import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import {terrainMesh,terrainApron,TERRAIN_APRON_RINGS,TERRAIN_RING_VERTICES,type MeshData} from '../src/geometry';
import {ground,terrain,distantTerrainHeight,regionalLandform} from '../src/model';
import {terrainSurfaceMaterial} from '../src/materials';
import {applyGeologicalSurface} from '../src/geological-surface';
import {createStaticWorld,initPhysics,physicsIdentity} from '../src/world';
import {facility} from '../src/facility';
import {shelterPlacements} from '../src/placement';

export function slopes(mesh:MeshData){
 const result:number[]=[];
 for(let k=0;k<mesh.indices.length;k+=3){const [i,j,l]=Array.from(mesh.indices.subarray(k,k+3),v=>v*3),p=mesh.vertices,ax=p[j]-p[i],ay=p[j+1]-p[i+1],az=p[j+2]-p[i+2],bx=p[l]-p[i],by=p[l+1]-p[i+1],bz=p[l+2]-p[i+2];result.push(Math.atan2(Math.hypot(ay*bz-az*by,ax*by-ay*bx),Math.abs(az*bx-ax*bz))*180/Math.PI);}
 return result.sort((a,b)=>a-b);
}

test('smooth landscape material uses vertex colour and retains independent inspection fields',()=>{
 const m=terrainSurfaceMaterial();assert.ok(m instanceof THREE.MeshStandardMaterial);assert.equal(m.vertexColors,true);assert.equal(m.map,null);assert.equal(m.normalMap,null);assert.equal(m.bumpMap,null);assert.equal(m.displacementMap,null);assert.equal(m.roughness,.94);
 const data=terrainMesh(42),g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(data.vertices,3));g.setIndex(new THREE.BufferAttribute(data.indices,1));g.computeVertexNormals();applyGeologicalSurface(g,42,{smooth:true});
 for(const name of ['color','surfaceField','bedrockId','unitColor'])assert.equal(g.getAttribute(name).count,g.getAttribute('position').count);g.dispose();m.dispose();
});

test('coastal landforms retain relief while avoiding constructed steep walls',()=>{
 const near=terrainMesh(42),angles=slopes(near),far=slopes(terrainApron(42));
 assert.ok(angles.filter(v=>v<15).length/angles.length>.60);assert.ok(angles[Math.floor(angles.length*.95)]<35);assert.ok(angles.filter(v=>v>50).length/angles.length<.01);assert.ok(far[Math.floor(far.length*.99)]<30);
 const h=Array.from(near.vertices).filter((_,i)=>i%3===1);assert.ok(Math.max(...h)-Math.min(...h)>35);assert.equal(ground(0,-105,42),23);
 for(const z of [-120,-40,40,100])for(const side of [-1,1])assert.ok(Math.abs(terrain(side*159,z,42)-terrain(side*131,z,42))<14,'no 38 m coastal border ramp');
});

test('distant rings are deterministic, asymmetric, bounded and joined exactly to every near edge',()=>{
 for(const seed of [42,-43]){const m=terrainApron(seed);assert.deepEqual(m,terrainApron(seed));assert.equal(m.vertices.length/3,TERRAIN_APRON_RINGS.length*TERRAIN_RING_VERTICES);assert.equal(m.indices.length/3,11264);
  for(let i=0;i<TERRAIN_RING_VERTICES;i++){const k=i*3,x=m.vertices[k],z=m.vertices[k+2];assert.equal(m.vertices[k+1],Math.fround(terrain(x,z,seed)));const r=Math.max(Math.abs(x),Math.abs(z)),outside=distantTerrainHeight(x*(r+.001)/r,z*(r+.001)/r,seed);assert.ok(Math.abs(outside-terrain(x,z,seed))<.01);}
  assert.ok(m.vertices.every(Number.isFinite));
 }
 let asymmetry=0;for(let z=-900;z<900;z+=73)asymmetry+=Math.abs(regionalLandform(430,z,42)-regionalLandform(-430,z,42));assert.ok(asymmetry>100);assert.notEqual(regionalLandform(430,-500,42),regionalLandform(430,-500,43));
});

test('reconstructed coastal terrain triangles agree with physical collision and structure supports',async()=>{
 await initPhysics();const world=createStaticWorld(42);world.step();let terrainHits=0;
 for(let z=-145;z<145;z+=23.7)for(let x=-145;x<145;x+=26.3){const y=ground(x,z,42),hit=world.castRay(new RAPIER.Ray({x,y:y+70,z},{x:0,y:-1,z:0}),100,true);assert.ok(hit);if(physicsIdentity(world,hit.collider.handle)?.kind==='terrain'){assert.ok(Math.abs(y-(y+70-hit.timeOfImpact))<.001);terrainHits++;}}
 assert.ok(terrainHits>65);world.free();
 const f=facility(42);for(let z=-19;z<=19;z++)for(let x=-10;x<=10;x++)assert.ok(f.y-ground(f.x+x,f.z+z,42)>=.349);
 for(const s of shelterPlacements(42))for(const support of s.supports){assert.ok(support.bottom<support.groundMin);assert.ok(support.top>support.groundMax);}
});
