import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import {applyGeologicalSurface} from '../src/geological-surface';
import {geologicalField} from '../src/geological-fields';
import {terrainApron} from '../src/geometry';
import {geology,ground} from '../src/model';
import {heroOutcrops,heroHeight,simplifyOutcrop} from '../src/hero-outcrop';
import {formationSurface} from '../src/formations';
import {initPhysics,createStaticWorld,physicsIdentity} from '../src/world';
import {solidHeight} from '../src/surface-query';
import {rockPositions} from '../src/data/rock-face-packed';
import {geologicalMaterial} from '../src/materials';
await initPhysics();
const hash=(m:{vertices:Float32Array;indices:Uint32Array})=>createHash('sha256').update(new Uint8Array(m.vertices.buffer)).update(new Uint8Array(m.indices.buffer)).digest('hex');

test('moderate geological shader retains projection, roughness and bounded normal detail',()=>{const m=geologicalMaterial('white',true,true,true,0,true),shader={...THREE.ShaderLib.standard,uniforms:{...THREE.ShaderLib.standard.uniforms}};m.onBeforeCompile(shader as never,{} as never);assert.ok(shader.fragmentShader.includes('.06*pbrReady'));assert.ok(shader.fragmentShader.includes('(photoLuma-.07219)*1.4'));assert.ok(shader.fragmentShader.includes('geoUvX'));m.dispose();});

test('apron-only classification uses the actual mesh normals beyond the clamped playable square',()=>{
 let changed=0;
 for(const seed of [42,-43]){const m=terrainApron(seed),before=hash(m),g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(m.vertices,3));g.setIndex(new THREE.BufferAttribute(m.indices,1));assert.throws(()=>applyGeologicalSurface(g,seed,{apron:true}),/normals/);g.computeVertexNormals();applyGeologicalSurface(g,seed,{apron:true,lod:2});const p=g.getAttribute('position'),n=g.getAttribute('normal'),field=g.getAttribute('surfaceField');
  for(let i=512;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),slope=Math.hypot(n.getX(i),n.getZ(i))/Math.max(1e-5,Math.abs(n.getY(i))),actual=geologicalField(x,z,y,slope,seed),legacy=geologicalField(x,z,y,geology(x,z,seed).slope,seed);assert.ok(Math.abs(field.getX(i)-actual.appearance.inputs.deposition)<1e-6);assert.ok(Math.abs(field.getY(i)-actual.appearance.inputs.weathering)<1e-6);assert.ok(Math.abs(field.getZ(i)-actual.appearance.inputs.competence)<1e-6);if(Math.abs(actual.appearance.inputs.deposition-legacy.appearance.inputs.deposition)>.001)changed++;}
  assert.equal(hash(m),before);g.dispose();
 }assert.ok(changed>20,`only ${changed} classifications distinguish actual and clamped slopes`);
});


test('original volcanic rock meshes retain their bytes, while marine rocks resupport without deformation',()=>{
 const expected=['43bebf1a5df4fd73cd8c6f7d9ec9435b33c235d52a2fe04b29d63c6555e62f29','bd558d2d6a210f659626e6095a609dc71fbdb0d0c9a5fce418e0d8e439717421'];assert.deepEqual(heroOutcrops(-43).map(h=>hash(h.mesh)),expected);
 const data=Buffer.from(rockPositions,'base64'),raw=new Float32Array(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength));
 for(const seed of [42,-43])for(const h of heroOutcrops(seed)){const lifts:number[]=[];let maxBase=-Infinity;for(let i=0;i<raw.length;i+=3){const localY=(raw[i+1]+.03436)*h.scale;lifts.push(h.mesh.vertices[i+1]-localY);if(localY<.55)maxBase=Math.max(maxBase,ground(h.mesh.vertices[i],h.mesh.vertices[i+2],seed)-localY);}assert.ok(Math.max(...lifts)-Math.min(...lifts)<.00002);assert.ok(Math.abs(lifts[0]-(maxBase-.35))<.00002);}
});

test('only the original two imported exposures remain, with bounded existing LODs',()=>{
 for(const seed of [42,-43]){const list=heroOutcrops(seed);assert.equal(list.length,2);assert.deepEqual(list.map(h=>[h.x,h.z]),[[28,-85],[73,-43]]);for(const h of list){assert.equal(h.mesh.indices.length/3,20174);assert.ok(h.mesh.vertices.every(Number.isFinite));const medium=simplifyOutcrop(h.mesh,.2),far=simplifyOutcrop(h.mesh,.45);assert.ok(medium.indices.length/3<6000);assert.ok(far.indices.length/3<1600);assert.ok(far.indices.length<medium.indices.length);}}
});

test('retired reference rocks have no colliders in the playable world',()=>{const world=createStaticWorld(42);for(const h of heroOutcrops(42)){const hit=world.castRay(new RAPIER.Ray({x:h.x,y:ground(h.x,h.z,42)+50,z:h.z},{x:0,y:-1,z:0}),100,true,undefined,undefined,undefined,undefined,c=>physicsIdentity(world,c.handle)?.identity===h.unitId);assert.equal(hit,null);}world.free();});
