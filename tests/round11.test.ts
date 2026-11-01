import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {terrainMesh,terrainApron} from '../src/geometry';
import {geology,ground} from '../src/model';
import {geologicalField} from '../src/geological-fields';
import {biosphere,GROWTH_FORMS} from '../src/biology';
import {growthGeometry} from '../src/Biosphere';
import {solidHeight} from '../src/surface-query';
import {shorelineBuffers,updateShoreline} from '../src/shoreline';
import {oceanContinuationBuffers,updateOceanContinuation} from '../src/ocean-continuation';
import {facility} from '../src/facility';
import {facilityLights,suitLampPower} from '../src/facility-lighting';
import {weatherAt} from '../src/climate';
import {formations,formationMesh,formationContactBlend} from '../src/formations';

test('volcanic substrate preserves its authored regional landforms beneath local relief',()=>{const m=terrainMesh(-43);assert.equal(m.vertices.length/3,129*129);assert.ok(m.vertices.every(Number.isFinite));assert.equal(ground(0,-105,-43),23);});

test('surface fields preserve within-unit continuity and slope-dependent competent exposure',()=>{
 let samples=0,maxJump=0;
 for(const seed of [42,-43])for(const x of [-90,-60,0,55,100]){let previous=geologicalField(x,15,0,.32,seed);for(let h=.025;h<65;h+=.025){const next=geologicalField(x,15,h,.32,seed);if(previous.unitId===next.unitId&&previous.appearance.bedrockId===next.appearance.bedrockId&&previous.appearance.sedimentId===next.appearance.sedimentId){samples++;maxJump=Math.max(maxJump,...next.color.map((v,k)=>Math.abs(v-previous.color[k])));}previous=next;}}
 assert.ok(samples>20000);assert.ok(maxJump<.006,`${maxJump} within-unit appearance jump`);
 const flat=geologicalField(0,15,4,.02,42),cliff=geologicalField(0,15,4,2,42);assert.ok(flat.appearance.states.sediment>.8);assert.ok(cliff.appearance.rock>flat.appearance.rock);
});

test('plants form bounded habitat clusters with root support, varied size and usable tissue coordinates',()=>{
 const list=biosphere(42),near=list.filter((p,i)=>list.some((q,j)=>i!==j&&Math.hypot(p.x-q.x,p.z-q.z)<4));assert.ok(near.length/list.length>.8);assert.ok(new Set(list.map(p=>p.cluster)).size>=25);assert.ok(Math.max(...list.map(p=>p.size))-Math.min(...list.map(p=>p.size))>.6);assert.deepEqual(biosphere(-43),[]);
 for(const p of list)assert.ok(Math.abs(p.y+.025-solidHeight(p.x,p.z,42))<1e-6);
 for(const form of GROWTH_FORMS){const g=growthGeometry({...list[0],form});assert.equal(g.attributes.growthUv.count,g.attributes.position.count);assert.equal(g.attributes.growthHeight.count,g.attributes.position.count);assert.ok(Array.from(g.attributes.growthUv.array).every(Number.isFinite));assert.ok(Array.from(g.attributes.growthHeight.array).every(v=>v>=0&&v<=1));g.dispose();}
});

test('procedural outcrop skirts use parent appearance and fade continuously into exposed rock',()=>{
 for(const f of formations(42)){const mesh=formationMesh(f,42);for(let p=0;p<mesh.vertices.length;p+=3){const x=mesh.vertices[p],y=mesh.vertices[p+1],z=mesh.vertices[p+2];if(y<=ground(x,z,42))assert.equal(formationContactBlend(x,y,z,42),0);}}
 const x=-114,z=-37,bed=ground(x+60,z,42);assert.equal(formationContactBlend(x+60,bed,z,42),0);let previous=0;for(let h=0;h<=1;h+=.01){const next=formationContactBlend(x+60,bed+h,z,42);assert.ok(next>=previous&&next-previous<.025);previous=next;}assert.equal(previous,1);
});

test('ocean continuation covers every side of the numerical square without rectangular gaps',()=>{
 const out=oceanContinuationBuffers(42),levels=new Float64Array(65*65).fill(10);out.points.forEach(p=>p.bed=-20);updateOceanContinuation(out,levels,10);
 const contains=(x:number,z:number)=>{for(let i=0;i<out.count;i+=3){const p=out.position,a=i*3,b=a+3,c=a+6,det=(p[b+2]-p[c+2])*(p[a]-p[c])+(p[c]-p[b])*(p[a+2]-p[c+2]);if(Math.abs(det)<1e-8)continue;const u=((p[b+2]-p[c+2])*(x-p[c])+(p[c]-p[b])*(z-p[c+2]))/det,v=((p[c+2]-p[a+2])*(x-p[c])+(p[a]-p[c])*(z-p[c+2]))/det;if(u>=-1e-6&&v>=-1e-6&&u+v<=1.000001)return true;}return false;};
 for(const distance of [160.01,180,300,700])for(const offset of [-90,0,90])for(const [x,z]of [[distance,offset],[-distance,offset],[offset,distance],[offset,-distance]])assert.ok(contains(x,z),`water absent at ${x},${z}`);
 assert.ok(out.count<=out.depth.length);assert.ok(out.depth.subarray(0,out.count).every(v=>v>=0));
});

test('near and continued water share exact inner-boundary mean elevation and optical depth',()=>{
 const levels=Float64Array.from({length:65*65},(_,k)=>6+(k%65)*.007+Math.floor(k/65)*.013),near=shorelineBuffers(42),far=oceanContinuationBuffers(42);updateShoreline(near,levels);updateOceanContinuation(far,levels,7);
 for(let i=0;i<512;i++){const p=far.nodes[i],match=near.nodes.find(q=>Math.abs(p.x-q.x)<1e-5&&Math.abs(p.z-q.z)<1e-5);assert.ok(match);assert.ok(Math.abs(p.y-match.y)<1e-8);assert.ok(Math.abs(p.depth-match.depth)<1e-8);}
 const dry=new Float64Array(65*65).fill(-99);assert.doesNotThrow(()=>updateOceanContinuation(far,dry,-10));assert.ok(far.position.subarray(0,far.count*3).every(Number.isFinite));
});

test('facility lighting is tied to visible overhead fixtures and bounded inside its own compartment',()=>{
 for(const seed of [42,-43]){const f=facility(seed),lamps=facilityLights(seed),height=lamps[0].y-f.y;assert.equal(lamps.length,f.rooms.length+3);for(const lamp of lamps){assert.equal(lamp.distance,seed<0?9:4.2);assert.equal(lamp.power,seed<0?(lamp.x===f.x?55:45):(lamp.x===f.x?26:20));const radius=Math.tan(lamp.angle)*height;if(lamp.x===f.x)assert.ok(radius<(seed<0?3.3:2));else assert.ok(radius<(seed<0?6.3:4));}}
 assert.ok(suitLampPower(3,true)<suitLampPower(3,false));assert.ok(suitLampPower(.21,true)<.001);
 for(const d of [.05,.21,1,3,8,20]){assert.ok(suitLampPower(d,true,-43)>=.65);assert.equal(suitLampPower(d,true,-43),suitLampPower(d,false,-43));}
 for(let t=0;t<240;t+=5)assert.equal(weatherAt(t,-43,240).clouds,0,'Pyrax dry atmosphere must bypass cloud changes');
});
