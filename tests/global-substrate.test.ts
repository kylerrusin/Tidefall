import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import {ROCK_FAMILIES} from '../src/domain/substrate';
import {geologicalShape} from '../src/geological-shapes';
import {substrateData,substrateBodyMesh,substrateChunkMesh,substrateSurface,terrainChunkMesh,substrateCoverage} from '../src/geological-substrate';
import {worldSubstrate,ground,regionalTerrainHeight} from '../src/model';
import {substrateClearance,substrateReliefAt} from '../src/substrate-field';
import {terrainSurfaceMaterial} from '../src/materials';
import {applyGeologicalSurface,BEDROCK_IDS} from '../src/geological-surface';
import {initPhysics,createStaticWorld,physicsIdentity} from '../src/world';
import {LAVA_N,LAVA_X,LAVA_Z,LAVA_DX,EXTRACTION_SITES} from '../src/domain/world-sites';
import {LavaField} from '../src/lava';

test('six original shape families have closed outward-wound meshes, geometric variants and cheaper LODs',()=>{
 for(const family of ROCK_FAMILIES){const hashes=new Set<string>();for(let variant=0;variant<6;variant++){
  const levels=[0,1,2].map(lod=>geologicalShape(family,variant,lod));assert.ok(levels[0].indices.length>levels[1].indices.length&&levels[1].indices.length>levels[2].indices.length,`${family}/${variant} LOD`);
  hashes.add(createHash('sha256').update(Buffer.from(levels[0].vertices.buffer)).digest('hex'));
  for(const mesh of levels){assert.ok(mesh.vertices.every(Number.isFinite));const edges=new Map<string,number>();let volume=0;for(let k=0;k<mesh.indices.length;k+=3){const ids=Array.from(mesh.indices.subarray(k,k+3));for(let i=0;i<3;i++){const a=ids[i],b=ids[(i+1)%3],key=Math.min(a,b)+':'+Math.max(a,b);edges.set(key,(edges.get(key)??0)+1);}const [a,b,c]=ids.map(i=>i*3),p=mesh.vertices;volume+=p[a]*(p[b+1]*p[c+2]-p[b+2]*p[c+1])+p[a+1]*(p[b+2]*p[c]-p[b]*p[c+2])+p[a+2]*(p[b]*p[c+1]-p[b+1]*p[c]);}assert.ok([...edges.values()].every(n=>n===2));assert.ok(volume>0,`${family} inward mesh`);}
 }assert.equal(hashes.size,6);}
});

test('every playable chunk on both planets and two seeds uses coherent globally owned substrate',()=>{
 for(const seed of [42,-43,47,-48]){const field=worldSubstrate(seed),data=substrateData(seed),coverage=substrateCoverage(seed);assert.equal(coverage.length,64);assert.ok(coverage.every(c=>c.processed));assert.ok(data.bodies.filter(b=>!b.site.fragment).length>250);assert.equal(new Set(field.sites.map(s=>s.id)).size,field.sites.length);assert.equal(substrateData(seed),data);assert.equal(worldSubstrate(seed),field);
  for(const c of coverage){assert.ok(c.heightMax>=c.heightMin);if(!c.bodies)assert.ok(c.protectedFraction>.35,`unexplained empty chunk ${seed}/${c.x}/${c.z}`);assert.equal(substrateChunkMesh(seed,c.x,c.z),substrateChunkMesh(seed,c.x,c.z));}
  assert.ok(coverage.filter(c=>c.visibleVolumeSampleFraction>.02).length>45);const families=new Set(field.sites.filter(s=>!s.fragment).map(s=>s.family));assert.ok(seed<0?families.has('volcanic')&&!families.has('rounded'):families.has('rounded')&&families.has('shelf')&&!families.has('volcanic'));
  for(const site of field.sites)assert.equal(site.chunkX,Math.min(7,Math.max(0,Math.floor((site.x+160)/40))));
 }
});

test('terrain chunk borders retain identical fine samples across mixed LODs and near geometry matches collision terrain',()=>{
 for(const seed of [42,-43])for(let cz=0;cz<8;cz++)for(let cx=0;cx<8;cx++){
  for(let lod=0;lod<3;lod++){const m=terrainChunkMesh(seed,cx,cz,lod);for(let k=0;k<m.vertices.length;k+=3)assert.ok(Math.abs(m.vertices[k+1]-ground(m.vertices[k],m.vertices[k+2],seed))<.00001);if(cx<7){const other=terrainChunkMesh(seed,cx+1,cz,(lod+1)%3),edge=-120+cx*40,values=(p:Float32Array)=>{const r=[];for(let k=0;k<p.length;k+=3)if(p[k]===edge)r.push([p[k+2],p[k+1]]);return r.sort((a,b)=>a[0]-b[0]);};assert.deepEqual(values(m.vertices),values(other.vertices));assert.equal(values(m.vertices).length,17);}}
 }
});

test('rock bases fit their complete footprints, preserve authored access and retain per-body inspection identity',()=>{
 for(const seed of [42,-43])for(const body of substrateData(seed).bodies){const local=geologicalShape(body.site.family,body.site.variant),m=body.mesh;for(let k=0;k<m.vertices.length;k+=3)if(local.vertices[k+1]<=.02)assert.ok(m.vertices[k+1]<ground(m.vertices[k],m.vertices[k+2],seed)+.00002,'hovering basal vertex');if(body.site.fragment)continue;
  const cx=body.site.chunkX,cz=body.site.chunkZ,chunk=substrateChunkMesh(seed,cx,cz,0,false);assert.ok(chunk.units.includes(body.site.unitId));assert.ok(substrateClearance(body.site.x,body.site.z,seed)>.84);
 }
 for(const seed of [42,-43])for(const [x,z]of EXTRACTION_SITES){assert.equal(substrateReliefAt(x,z,worldSubstrate(seed)),0);assert.equal(substrateSurface(x,z,seed),null);}
 assert.equal(createHash('sha256').update(Buffer.from(new LavaField(-43,false).bed.buffer)).digest('hex'),'78566dd6c561492a4305a3d9aaf905c281c3b7eb2a3d72987d54b1acf1157b34');
 for(let j=0;j<LAVA_N;j++)for(let i=0;i<LAVA_N;i++){const x=LAVA_X+i*LAVA_DX,z=LAVA_Z+j*LAVA_DX;assert.equal(substrateSurface(x,z,-43),null);}
});

test('rendered bedrock attributes and exact static triangle ray hits share unit, surface and support',async()=>{
 await initPhysics();for(const seed of [42,-43]){const world=createStaticWorld(seed);world.step();let samples=0;for(const body of substrateData(seed).bodies.filter(b=>!b.site.fragment).filter((_,i)=>i%13===0)){
  const {x,z}=body.site,q=substrateSurface(x,z,seed);if(!q||q.height<ground(x,z,seed))continue;
  const hit=world.castRay(new RAPIER.Ray({x,y:q.height+30,z},{x:0,y:-1,z:0}),60,true,undefined,undefined,undefined,undefined,c=>Boolean((physicsIdentity(world,c.handle) as {substrateSeed?:number})?.substrateSeed));assert.ok(hit);assert.ok(Math.abs(30-hit.timeOfImpact)<.002);const identity=physicsIdentity(world,hit.collider.handle,{x,z});assert.equal(identity?.identity,q.unitId);samples++;
 }assert.ok(samples>15);world.free();const b=substrateData(seed).bodies.find(b=>!b.site.fragment)!,m=substrateBodyMesh(b,0),g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(m.vertices,3));g.setIndex(new THREE.BufferAttribute(m.indices,1));g.computeVertexNormals();applyGeologicalSurface(g,seed,{smooth:true,unitIds:Array(m.vertices.length/3).fill(b.site.unitId)});for(let i=0;i<g.attributes.position.count;i++)assert.equal(BEDROCK_IDS[g.getAttribute('bedrockId').getX(i)],b.site.unitId);g.dispose();}
});

test('the restrained historical material retains two texture channels without fine grain, cavity or procedural bump',()=>{
 const m=terrainSurfaceMaterial(),shader={...THREE.ShaderLib.standard,uniforms:{...THREE.ShaderLib.standard.uniforms}};m.onBeforeCompile(shader as never,{} as never);assert.ok(shader.uniforms.pbrAlbedo);assert.ok(shader.uniforms.pbrRough);assert.equal((shader.fragmentShader.match(/texture2D\(/g)??[]).length,2);for(const term of ['geoNoise','geoCavity','pbrNormal','geoRelief'])assert.ok(!shader.fragmentShader.includes(term));m.dispose();
});
