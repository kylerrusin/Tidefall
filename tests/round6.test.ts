import {solidSurface} from '../src/surface-query';
import test, {before} from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { refreshInstanceBounds } from "../src/instance-bounds";
import { rockPlacements, ROCK_VERTICES } from "../src/geometry";
import { CREATURE_TYPES } from "../src/combat";
import { ground, surfaceAt } from "../src/model";
import { Expedition, initPhysics } from "../src/simulation";
import { destinationSeed, planetForSeed } from "../src/planets";
import { solarState, weatherAt } from "../src/climate";
import { waveAt, WAVE_GLSL, WAVES } from "../src/waves";
import { waterAt } from "../src/water-contact";
import { hurtStalker } from "../src/creatures";
before(async()=>initPhysics());

test("late instance transforms invalidate old bounds; repaired bounds retain rocks through a camera orbit",()=>{
  const mesh=new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1,0),new THREE.MeshBasicMaterial(),3);
  mesh.computeBoundingSphere();const stale=mesh.boundingSphere!.clone();
  const positions=[new THREE.Vector3(120,24,90),new THREE.Vector3(-110,32,65),new THREE.Vector3(70,15,-130)];
  positions.forEach((p,i)=>mesh.setMatrixAt(i,new THREE.Matrix4().compose(p,new THREE.Quaternion(),new THREE.Vector3(3,2,4))));
  assert.equal(stale.containsPoint(positions[0]),false);refreshInstanceBounds(mesh);
  const camera=new THREE.PerspectiveCamera(74,16/9,.06,1400),frustum=new THREE.Frustum(),matrix=new THREE.Matrix4();
  for(const target of positions)for(let angle=0;angle<Math.PI*2;angle+=Math.PI/12){
    camera.position.set(target.x+Math.sin(angle)*12,target.y+4,target.z+Math.cos(angle)*12);camera.lookAt(target);camera.updateMatrixWorld();
    frustum.setFromProjectionMatrix(matrix.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
    assert.ok(frustum.intersectsSphere(mesh.boundingSphere!));assert.ok(mesh.boundingBox!.containsPoint(target));
  }
  assert.equal(mesh.frustumCulled,true);mesh.geometry.dispose();(mesh.material as THREE.Material).dispose();
});
test("geological supports use transformed contact vertices with documented partial burial",()=>{
  const point=new THREE.Vector3();
  for(const seed of [42,1701,-43,-1702])for(const rock of rockPlacements(seed)){
    const m=new THREE.Matrix4().compose(new THREE.Vector3(rock.x,rock.y,rock.z),new THREE.Quaternion().setFromEuler(new THREE.Euler(.1,rock.angle,.12)),new THREE.Vector3(rock.size,rock.size*.8,rock.size));
    let contact=Infinity;
    for(let i=0;i<ROCK_VERTICES.length;i+=3){point.set(ROCK_VERTICES[i],ROCK_VERTICES[i+1],ROCK_VERTICES[i+2]).applyMatrix4(m);contact=Math.min(contact,point.y-solidSurface(point.x,point.z,seed).height);}
    assert.ok(Math.abs(contact+rock.size*.2)<1e-5);
    const surface=surfaceAt(rock.x,rock.z,seed);assert.ok(Math.abs(Math.hypot(surface.normal.x,surface.normal.y,surface.normal.z)-1)<1e-10);
  }
});

test("both world namespaces have enclosed instance bounds from elevated, backward and sideways camera orbits",()=>{
  for(const seed of [42,-43]){
    const rocks=rockPlacements(seed),mesh=new THREE.InstancedMesh(new THREE.DodecahedronGeometry(),new THREE.MeshBasicMaterial(),rocks.length),matrix=new THREE.Matrix4();
    rocks.forEach((r,i)=>mesh.setMatrixAt(i,matrix.compose(new THREE.Vector3(r.x,r.y,r.z),new THREE.Quaternion().setFromEuler(new THREE.Euler(.1,r.angle,.12)),new THREE.Vector3(r.size,r.size*.8,r.size))));
    refreshInstanceBounds(mesh);mesh.updateMatrixWorld();
    const camera=new THREE.PerspectiveCamera(74,16/9,.06,1400),frustum=new THREE.Frustum();
    for(const r of [rocks[0],rocks[Math.floor(rocks.length/2)],rocks.at(-1)!])for(const elevation of [1,8,20])for(let i=0;i<36;i++){
      camera.position.set(r.x+Math.sin(i*Math.PI/18)*15,r.y+elevation,r.z+Math.cos(i*Math.PI/18)*15);camera.lookAt(r.x,r.y,r.z);camera.updateMatrixWorld();
      frustum.setFromProjectionMatrix(matrix.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));assert.ok(frustum.intersectsObject(mesh));
    }
    mesh.geometry.dispose();(mesh.material as THREE.Material).dispose();
  }
});
test("planet configuration drives distinct terrain, dry liquids, rigid gravity and jump trajectories",()=>{
  const heights:number[]=[];
  for(const seed of [42,destinationSeed(42,"pyrax")]){
    const r=new Expedition("PLANET",seed),p=r.join();r.action(p.id,"ready");r.action(p.id,"start");
    assert.equal(r.snapshot().planet,planetForSeed(seed).id);assert.equal(r.world.gravity.y,-planetForSeed(seed).gravity);
    if(seed<0)assert.ok(r.water.levels().every(v=>v===-100));
    for(let i=0;i<30;i++)r.step();const base=p.y;let apex=base;
    r.input(p.id,{x:0,z:0,yaw:0,jump:true,seq:1});r.step();r.input(p.id,{x:0,z:0,yaw:0,jump:false,seq:2});
    for(let i=0;i<75;i++){r.step();apex=Math.max(apex,p.y);}heights.push(apex-base);r.dispose();
  }
  assert.ok(heights[0]>heights[1]+.5,JSON.stringify(heights));assert.ok(Math.abs(ground(80,45,42)-ground(80,45,-43))>5);
});
test("synchronous rotation preserves local host altitude while weather changes temperature and surge",()=>{
  const day=solarState(0),nightTime=day.daySeconds*.6,night=solarState(nightTime);
  assert.ok(Math.abs(day.daylight-night.daylight)<1e-10);assert.equal(solarState(nightTime).physicalTime,nightTime*solarState(1).physicalTime);
  const calm=weatherAt(0),storm=weatherAt(1350);assert.ok(storm.wind>calm.wind*5&&storm.visibility<.4);assert.equal(storm.surge,3);
  assert.ok(weatherAt(1350).air<calm.air);assert.equal(weatherAt(1350,-43).sea,-100);assert.equal(weatherAt(1350,-43).rain,0);
});
test("finite depth waves share shader components and authoritative/predicted contact",()=>{
  for(const w of WAVES)assert.ok(WAVE_GLSL.includes((2*Math.PI/w.length).toFixed(9)));
  assert.equal(waveAt(0,0,1350,0).height,0);assert.equal(waveAt(0,0,1350,10,-43).height,0);
  let calm=0,storm=0;for(let i=0;i<200;i++){calm+=waveAt(i,0,0,10).height**2;storm+=waveAt(i,0,1350,10).height**2;}
  assert.ok(storm>calm*15);const r=new Expedition("WAVE",42);r.time=1350;const s=r.snapshot();
  const a=r.water.surface(0,140,r.time),b=waterAt(s,0,140);assert.ok(Math.abs(a.level-b.level)<.015);assert.ok(Math.abs(a.u-b.u)<.015);r.dispose();
});
test("wrong-world acknowledgments cannot unlock launch",()=>{
  const r=new Expedition("LOAD",-43),p=r.join();p.loaded=false;r.action(p.id,"ready");r.action(p.id,"loaded",{seed:42});r.action(p.id,"start");assert.equal(r.status,"ready");
  r.action(p.id,"loaded",{seed:-43});r.action(p.id,"start");assert.equal(r.status,"running");p.loaded=false;p.alive=false;
  r.action(p.id,"loaded",{seed:-43});assert.equal(p.loaded,true);assert.equal(p.alive,false);assert.equal(r.status,"running");r.dispose();
});
test("encounter habitat relocation is validated before allocating any actor or collider",()=>{
  const r=new Expedition("SPAWN",42),count=r.stalkers.length,bodies=r.world.bodies.len(),colliders=r.world.colliders.len();
  let tested=false;assert.throws(()=>r.addCreature({x:10,z:-104},"stalker",point=>{tested=true;assert.ok(Number.isFinite(point.y));return false;}),/visibility or distance/);
  assert.ok(tested);assert.equal(r.stalkers.length,count);assert.equal(r.world.bodies.len(),bodies);assert.equal(r.world.colliders.len(),colliders);r.dispose();
});
test("ridgeback rear tissue beats armor; repeated non-staggering armor hits preserve a committed charge",()=>{
  const r=new Expedition("ARMOR",42),p=r.join(),s=r.stalkers[2];r.time=10;s.yaw=0;
  const before=s.health;hurtStalker(r,s,p,{x:0,y:0,z:1},{...s,z:s.z+s.radius});const armor=before-s.health;
  s.state="windup";s.attackDone=false;s.staggerReadyAt=99;hurtStalker(r,s,p,{x:0,y:0,z:1},{...s,z:s.z+s.radius});assert.equal(s.attackDone,false);assert.equal(s.state,"windup");
  const hp=s.health;hurtStalker(r,s,p,{x:0,y:0,z:1},{...s,z:s.z-s.radius});assert.ok(hp-s.health>armor*3);assert.equal(s.state,"stagger");r.dispose();
});
test("ridgeback telegraphs a committed physical charge, travels and damages only once per impact",()=>{
  const r=new Expedition("CHARGE",42),p=r.join(),s=r.stalkers[2];r.action(p.id,"ready");r.action(p.id,"start");
  for(const other of r.stalkers.slice(0,2)){other.health=0;r.stalkerColliders[other.id].setEnabled(false);}
  Object.assign(p,{x:-10,z:-113,y:24});r.bodies.get(p.id)!.setTranslation(p,true);
  Object.assign(s,{x:-10,z:-106,y:24.4,yaw:Math.PI,state:"windup",until:9.3,targetId:p.id,attackKind:"charge",attackId:1,attackDone:false,lastKnown:{...p}});r.stalkerBodies[2].setTranslation(s,true);r.world.step();r.time=8.1;
  for(let i=0;i<55;i++)r.step();assert.equal(p.health,100);const z=s.z;
  for(let i=0;i<85;i++)r.step();assert.ok(s.z<z-3);assert.equal(p.health,100-CREATURE_TYPES.ridgeback.chargeDamage);assert.equal(r.damageEvents.filter(e=>e.attackId===1).length,1);r.dispose();
});
test("death produces one dynamic anatomical reward, exclusive pickup, finite lifetime and useful treatment",()=>{
  const r=new Expedition("LOOT",42),p=r.join(),q=r.join(),s=r.stalkers[0];r.action(p.id,"ready");r.action(q.id,"ready");r.action(p.id,"start");
  s.health=1;hurtStalker(r,s,p,{x:0,y:0,z:1});r.dropLoot(s);const drops=r.supplies.filter(v=>v.id===`loot-${s.id}-${s.generation??0}`);assert.equal(drops.length,1);
  const loot=drops[0],body=r.props[loot.objectId!];assert.ok(body.isDynamic());assert.equal(r.objects[loot.objectId!].material,"biomass");
  for(const player of [p,q])Object.assign(player,{x:loot.x,y:loot.y,z:loot.z});r.action(p.id,"interact");r.action(q.id,"interact");assert.equal(p.medicine+q.medicine,1);assert.equal(body.isEnabled(),false);
  p.health=50;r.action(p.id,"medical");assert.equal(p.health,82);assert.equal(p.medicine,0);
  r.dropLoot(r.stalkers[2]);const second=r.supplies.at(-1)!;r.time=second.expires!+1;r.step();assert.equal(second.active,false);assert.equal(r.props[second.objectId!].isEnabled(),false);r.dispose();
});
