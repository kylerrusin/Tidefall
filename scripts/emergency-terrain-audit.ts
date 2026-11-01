import {mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {terrainMesh,terrainApron} from '../src/geometry';
import {heroOutcrops,simplifyOutcrop} from '../src/hero-outcrop';
import {geology} from '../src/model';
import {geologicalField} from '../src/geological-fields';
import {terrainCameras} from '../src/terrain-qa';
const hash=(m:{vertices:Float32Array;indices:Uint32Array})=>createHash('sha256').update(new Uint8Array(m.vertices.buffer)).update(new Uint8Array(m.indices.buffer)).digest('hex');
const worlds=[42,-43].map(seed=>{const near=terrainMesh(seed),apron=terrainApron(seed),g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(apron.vertices,3));g.setIndex(new THREE.BufferAttribute(apron.indices,1));g.computeVertexNormals();const p=g.getAttribute('position'),n=g.getAttribute('normal');let mismatchedSlopes=0,changedDeposition=0,maxSlopeError=0;
 for(let i=512;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),actual=Math.hypot(n.getX(i),n.getZ(i))/Math.max(1e-5,Math.abs(n.getY(i))),old=geology(x,z,seed).slope,error=Math.abs(actual-old);if(error>.01)mismatchedSlopes++;maxSlopeError=Math.max(maxSlopeError,error);if(Math.abs(geologicalField(x,z,y,actual,seed).appearance.inputs.deposition-geologicalField(x,z,y,old,seed).appearance.inputs.deposition)>.001)changedDeposition++;}
 const result={seed,nearHash:hash(near),apronHash:hash(apron),apronTriangles:apron.indices.length/3,mismatchedSlopes,changedDeposition,maxSlopeError,outcrops:heroOutcrops(seed).map(h=>({id:h.id,x:h.x,z:h.z,scale:h.scale,angle:h.angle,unitId:h.unitId,hash:hash(h.mesh),triangles:[h.mesh,simplifyOutcrop(h.mesh,.2),simplifyOutcrop(h.mesh,.45)].map(m=>m.indices.length/3)}))};g.dispose();return result;});
mkdirSync('evidence/emergency',{recursive:true});writeFileSync('evidence/emergency/audit.json',JSON.stringify({baseline:'7b9454dcefa34a0a1c7204ee66603041644bcebb',worlds,cameras:terrainCameras()},null,2)+'\n');console.log(JSON.stringify(worlds,null,2));
