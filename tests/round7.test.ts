import test,{before} from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import {Expedition,initPhysics} from "../src/simulation";
import {ground,astronomy,GRAVITY,ORBIT,orbitSafety} from "../src/model";
import {shelterPlacements,footprint} from "../src/placement";
import {terrainApron,structures} from "../src/geometry";
import {muzzlePosition,RIFLE_OFFSET,MUZZLE_LOCAL} from "../src/weapon";
import {thermalStep,exposure} from "../src/survival";
import {Water} from "../src/water";
import {COMBAT,CREATURE_TYPES} from "../src/combat";
import {PLANETS} from "../src/planets";
import {replenishMedical} from "../src/resources";
import {observedCatalog,catalogAt,selectCelestial} from "../src/astronomy-catalog";
import {equatorialPosition} from "../src/sky-math";
before(async()=>initPhysics());
function start(r:Expedition){for(const p of r.players.values())r.action(p.id,"ready");r.action(r.host,"start");}

test("shelter footprint relocation, footings and collision parts support both worlds without center-only placement",()=>{
  for(const seed of [42,-43,7841,-7842])for(const s of shelterPlacements(seed)){
    assert.ok(s.range<=2.8);assert.ok(s.y>=footprint(s.x,s.z,3.2,seed).max+.21);
    for(const support of s.supports){assert.ok(support.bottom<=support.groundMin-.17);assert.ok(support.top>=support.groundMax);}
    for(const part of s.parts)assert.ok(structures(seed).some(p=>p.x===part.x&&p.y===part.y&&p.z===part.z&&p.sy===part.sy));
    assert.ok(s.parts.some(p=>p.role==="floor"));assert.ok(s.parts.filter(p=>p.role==="foundation").length>=4);
  }
});
test("distant terrain stitches every boundary vertex and has upward-facing continuous rings",()=>{
  for(const seed of [42,-43]){const data=terrainApron(seed);for(let i=0;i<512;i++){const k=i*3;assert.ok(Math.abs(data.vertices[k+1]-ground(data.vertices[k],data.vertices[k+2],seed))<1e-3);}
    for(let i=0;i<data.indices.length;i+=3){const a=data.indices[i]*3,b=data.indices[i+1]*3,c=data.indices[i+2]*3;const y=(data.vertices[b+2]-data.vertices[a+2])*(data.vertices[c]-data.vertices[a])-(data.vertices[b]-data.vertices[a])*(data.vertices[c+2]-data.vertices[a+2]);assert.ok(y>0);}
    assert.ok(Math.max(...data.vertices)>1100);
  }
});
test("rendered muzzle transform matches the server for full yaw and extreme pitch",()=>{
  const camera=new THREE.PerspectiveCamera(),point=new THREE.Vector3();camera.position.set(9,24,-80);
  for(const yaw of [-7,-1,0,2,8])for(const pitch of [-1.48,0,1.48]){
    camera.rotation.set(-pitch,Math.PI+yaw,0,"YXZ");camera.updateMatrixWorld();point.set(RIFLE_OFFSET.x+MUZZLE_LOCAL.x,RIFLE_OFFSET.y+MUZZLE_LOCAL.y,RIFLE_OFFSET.z+MUZZLE_LOCAL.z).applyMatrix4(camera.matrixWorld);
    const authoritative=muzzlePosition(camera.position,yaw,pitch);assert.ok(point.distanceTo(new THREE.Vector3(authoritative.x,authoritative.y,authoritative.z))<1e-10);
  }
});
test("two-stage rifle aiming converges at near, middle and far targets",()=>{
  const r=new Expedition("MUZZLE"),p=r.join();start(r);for(const d of [2,20,70]){
    const target=r.world.createCollider(RAPIER.ColliderDesc.ball(.35).setTranslation(p.x,p.y+.65,p.z+d));r.world.step();r.time+=.4;r.action(p.id,"fire",{yaw:0,pitch:0});const pulse=r.pulses.at(-1)!;
    assert.ok(pulse.hit);assert.ok(Math.abs(pulse.to.x-p.x)<.03);assert.ok(Math.abs(pulse.to.z-(p.z+d-.35))<.04);assert.deepEqual(pulse.from,muzzlePosition({x:p.x,y:p.y+.65,z:p.z},0,0));r.world.removeCollider(target,true);
  }r.dispose();
});
test("muzzle-side obstruction stops a shot even when the camera ray sees beyond it",()=>{
  const r=new Expedition("WALL"),p=r.join();start(r);
  r.world.createCollider(RAPIER.ColliderDesc.cuboid(.1,.25,.07).setTranslation(p.x-.25,p.y+.45,p.z+.8));r.world.step();r.action(p.id,"fire",{yaw:0,pitch:0});const shot=r.pulses.at(-1)!;assert.ok(shot.hit);assert.ok(shot.to.z<p.z+.9);r.dispose();
});
test("ordinary cold exposure takes minutes, and warm shelter/thermal equipment reverses it",()=>{
  let core=37;for(let i=0;i<120;i++)core=thermalStep(core,-15,false,20,false,false,1);assert.ok(core>35.5&&core<37);
  const cold=core;for(let i=0;i<120;i++)core=thermalStep(core,18,false,20,true,true,1,false,0,.4,true);assert.ok(core>cold+.5);
  const r=new Expedition("COLD"),p=r.join();for(let i=0;i<180;i++)exposure(p,{level:-100,depth:0},430,1,42);assert.equal(p.health,100);assert.notEqual(p.coldStage,"critical");r.dispose();
});
test("H medical use is immediate, full-health safe, authoritative and cooldown-limited",()=>{
  const r=new Expedition("MED"),p=r.join();start(r);p.medicine=2;r.action(p.id,"medical");assert.equal(p.medicine,2);p.health=20;r.action(p.id,"medical");assert.equal(p.health,52);assert.equal(p.medicine,1);for(let i=0;i<20;i++)r.action(p.id,"medical");assert.equal(p.health,52);r.time+=1;r.action(p.id,"medical");assert.equal(p.health,84);assert.equal(p.medicine,0);r.dispose();
});
test("medical director rotates valid sites, reuses bounded slots and never duplicates a generation",()=>{
  const r=new Expedition("RESPAWN"),p=r.join();start(r);const first=r.supplies.find(s=>s.id.startsWith("med-"))!;assert.ok(first);const generation=first.generation!;
  Object.assign(p,{x:first.x,y:first.y+1,z:first.z});r.bodies.get(p.id)!.setTranslation(p,true);r.world.step();r.action(p.id,"interact");assert.equal(first.takenBy,p.id);
  replenishMedical(r,true);Object.assign(p,{x:0,y:24,z:-120});r.bodies.get(p.id)!.setTranslation(p,true);r.world.step();for(let i=0;i<12;i++){r.time+=130;replenishMedical(r,true);}
  assert.ok(first.generation!>generation);assert.ok(r.supplies.filter(s=>s.id.startsWith("med-")).length<=5);
  for(const supply of r.supplies.filter(s=>s.id.startsWith("med-")&&!s.takenBy&&s.active!==false)){assert.ok(r.water.sample(supply.x,supply.z).depth<.3);assert.ok(supply.y>=ground(supply.x,supply.z,r.seed)+.16);}
  r.dispose();
});
test("coastal xenobiology and volcanic survey machines have distinct habitats, movement and attack budgets",()=>{
  const coast=new Expedition("COAST",42),volcano=new Expedition("ROBOT",-43);
  assert.deepEqual(new Set(coast.stalkers.map(s=>s.kind)),new Set(["stalker","ridgeback","ambusher","grazer","scuttler","skimmer"]));assert.deepEqual(new Set(volcano.stalkers.map(s=>s.kind)),new Set(["surveyor","sentinel"]));
  const drone=volcano.stalkers[0];assert.ok(drone.y-ground(drone.x,drone.z,-43)>2.5);assert.ok(CREATURE_TYPES.surveyor.projectileSpeed>CREATURE_TYPES.stalker.projectileSpeed);assert.ok(CREATURE_TYPES.sentinel.heatLimit>2000);
  assert.ok(Math.ceil(100/COMBAT.stalker.meleeDamage)>=3&&Math.ceil(100/COMBAT.stalker.meleeDamage)<=5);coast.dispose();volcano.dispose();
});
test("geological displacement is local, volume-accounted, finite, and propagates faster in deeper water",()=>{
  const arrivals:number[]=[];for(const depth of [4,16]){
    const w=new Water(42,65,5,new Array(65*65).fill(0),depth),initial=w.volume();w.disturbSurface(0,0,1,10);assert.ok(Math.abs(w.volume()-initial-w.sourceVolume)<1e-6);assert.equal(w.sample(60,0).level,depth);
    let arrival=Infinity;for(let i=1;i<=320;i++){w.advance(.05,depth);if(Math.abs(w.sample(60,0).level-depth)>.01){arrival=i*.05;break;}}
    arrivals.push(arrival);assert.ok(Number.isFinite(arrival));assert.ok([...w.h].every(h=>Number.isFinite(h)&&h>=0));
  }assert.ok(arrivals[1]<arrivals[0]*.8,JSON.stringify(arrivals));
});
test("tsunami trigger is authoritative, distinct from the tide and absent on the dry planet",()=>{
  const r=new Expedition("QUAKE"),p=r.join();start(r);r.time=r.tsunami!.triggerAt-.001;r.step();assert.equal(r.tsunami!.triggered,true);assert.equal(r.snapshot().tsunami!.triggered,true);assert.equal(r.tsunami!.id,1);const volume=r.water.sourceVolume;r.step();assert.equal(r.water.sourceVolume,volume);const dry=new Expedition("DRY",-43);assert.equal(dry.snapshot().tsunami,null);dry.dispose();r.dispose();
});
test("measured mass/radius drive gravity and the hypothetical moon passes instant orbit screening",()=>{
  for(const p of Object.values(PLANETS)){const g=6.6743e-11*p.observed.massKg/p.observed.radiusM**2;assert.equal(g,p.gravity);assert.ok(p.scenario.includes("Hypothetical")||p.scenario.includes("Fictional"));}
  assert.equal(GRAVITY,PLANETS.tidefall.gravity);assert.ok(ORBIT.distance>orbitSafety().roche&&ORBIT.distance<orbitSafety().stable);assert.ok(astronomy(420).level-astronomy(180).level>20);
});
test("catalog directions subtract the observing host and labels select one real, correctly transformed object",()=>{
  const coast=observedCatalog(42),volcano=observedCatalog(-43);assert.ok(coast.length>=50&&coast.length<=200);const sirius=coast.findIndex(s=>s.name==="Sirius");assert.ok(sirius>=0);
  const earth=equatorialPosition(101.287,-16.716,1),v=coast.vectors![sirius];assert.ok(Math.acos(Math.max(-1,Math.min(1,earth.x*v.x+earth.y*v.y+earth.z*v.z)))>.1);assert.notEqual(coast[sirius].magnitude,volcano.find(s=>s.name==="Sirius")!.magnitude);
  const visible=catalogAt(42,100).find(s=>s.direction.y>.3)!;assert.equal(selectCelestial([visible],visible.direction,0,.05,0,true)!.id,visible.id);assert.equal(selectCelestial([{...visible,magnitude:9}],visible.direction,1,.3,1,false),null);
});
