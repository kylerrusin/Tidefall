import test, { before } from "node:test";
import assert from "node:assert/strict";
import RAPIER from "@dimforge/rapier3d-compat";
import { PerspectiveCamera, Vector3 } from "three";
import { Expedition, initPhysics } from "../src/simulation";
import { COMBAT, lookDirection, damageBearing, inVision } from "../src/combat";
import { creatureLOS, hearNoise } from "../src/creatures";
import { relativeLook, PointerSession } from "../src/pointer";
import { Feedback } from "../src/feedback";
import { findRoute } from "../src/navigation";
import { creaturePose } from "../src/creature-animation";
import { SnapshotBuffer } from "../src/presentation";
import { ground } from "../src/model";
before(async()=>initPhysics());
function encounter(range=12) {
  const r=new Expedition("ROUND5"),p=r.join(),s=r.stalkers[0];
  for(const other of r.stalkers.slice(1)){other.health=0;other.state="dead";r.stalkerColliders[other.id].setEnabled(false);}
  r.action(p.id,"ready");r.action(p.id,"start");r.time=8.1;
  p.z=-113;p.y=ground(p.x,p.z,r.seed)+1;r.bodies.get(p.id)!.setTranslation(p,true);
  Object.assign(s,{x:p.x,z:p.z+range,y:ground(p.x,p.z+range,r.seed)+.82,yaw:Math.PI,state:"idle",targetId:null});
  s.home={x:s.x,y:s.y,z:s.z};r.stalkerBodies[0].setTranslation(s,true);r.world.step();
  return {r,p,s};
}
function ticks(r:Expedition,count:number){for(let i=0;i<count;i++)r.step();}
test("relative movement and final rendered camera direction agree through full turns and pitch limits",()=>{
  let look={yaw:0,pitch:0};const camera=new PerspectiveCamera();
  for(let i=0;i<150;i++){
    look=relativeLook(look.yaw,look.pitch,40,i<75?-2:2,.0027,false);
    camera.rotation.set(-look.pitch,Math.PI+look.yaw,0,"YXZ");camera.updateMatrixWorld();
    const rendered=camera.getWorldDirection(new Vector3()),aim=lookDirection(look.yaw,look.pitch);
    assert.ok(rendered.distanceTo(new Vector3(aim.x,aim.y,aim.z))<1e-10);
  }
  const right=relativeLook(0,0,100,0,.003,false);assert.ok(lookDirection(right.yaw,0).x<0);
  assert.equal(relativeLook(0,0,0,10000,.003,false).pitch,85*Math.PI/180);
});
test("release and recapture ignore a stale rejected lock request",async()=>{
  let reject!:(e:Error)=>void;
  const pending=new Promise<void>((_,r)=>{reject=r;});let calls=0;
  const session=new PointerSession({request:()=>++calls===1?pending:Promise.resolve(),release:()=>{}},()=>{},()=>{});
  session.request();session.release();session.request();session.change(true);reject(new Error("old"));await Promise.resolve();
  assert.equal(session.state,"locked");
});
test("vision has range and field of view, and a visible player is noticed at 12m",()=>{
  const {r,p,s}=encounter();assert.ok(creatureLOS(r,s,p,r.colliders.get(p.id)));r.step();assert.equal(s.state,"alert");assert.equal(s.targetId,p.id);
  assert.equal(inVision(s,0,p),false);assert.equal(inVision(s,Math.PI,{...p,z:s.z-50}),false);r.dispose();
});
test("habitats remain dry and free of static colliders across shared seeds",()=>{
  for(const seed of [0,1,42,4081,82300,99999]){
    const r=new Expedition("HABITAT",seed);
    for(const s of r.stalkers){
      assert.ok(s.kind==='skimmer'?r.water.sample(s.x,s.z).depth>.7:r.water.sample(s.x,s.z).depth<=({stalker:1.8,ridgeback:1.1,ambusher:1.4,grazer:1,scuttler:.7,skimmer:30,surveyor:.1,sentinel:.1}[s.kind]));
      const hit=r.world.intersectionWithShape(s,{x:0,y:0,z:0,w:1},new RAPIER.Ball(Math.min(.7,s.radius)),RAPIER.QueryFilterFlags.EXCLUDE_KINEMATIC);
      assert.equal(hit,null,`seed ${seed}, creature ${s.id}`);
    }
    r.dispose();
  }
});
test("the initial encounter threatens a stationary player within the first twenty seconds",()=>{
  const r=new Expedition("FIRST30",42),p=r.join();r.action(p.id,"ready");r.action(p.id,"start");
  ticks(r,60*20);assert.ok(p.health<100,JSON.stringify(r.stalkers));assert.ok(r.stalkers.some(s=>s.attackId>0));r.dispose();
});
test("solid cover blocks perception, while gunfire causes investigation of a remembered location",()=>{
  const {r,p,s}=encounter();
  r.world.createCollider(RAPIER.ColliderDesc.cuboid(5,8,.4).setTranslation(p.x,p.y,p.z+6));r.world.step();
  assert.equal(creatureLOS(r,s,p,r.colliders.get(p.id)),false);r.step();assert.notEqual(s.state,"alert");
  r.action(p.id,"fire",{yaw:0,pitch:0});assert.equal(s.state,"suspicious");
  const heard={...s.lastKnown!};p.z-=3;r.bodies.get(p.id)!.setTranslation(p,true);ticks(r,45);
  assert.ok(["investigate","search"].includes(s.state),JSON.stringify({state:s.state,lastKnown:s.lastKnown,p,s}));assert.deepEqual(s.lastKnown,heard);r.dispose();
});
test("medium-range attacks have a visible windup, travel time, and one authoritative damage event",()=>{
  const {r,p,s}=encounter();
  for(let i=0;i<150&&s.state!=="windup";i++)r.step();
  assert.equal(s.state,"windup");assert.equal(s.attackKind,"ranged");assert.equal(p.health,100);
  const start=r.time;ticks(r,25);assert.equal(r.projectiles.length,0);assert.equal(p.health,100);
  for(let i=0;i<120&&!r.projectiles.length;i++)r.step();
  assert.ok(r.time-start>=COMBAT.stalker.rangedWindup-.03);assert.equal(r.projectiles.length,1);assert.equal(p.health,100);
  let collision="";
  for(let i=0;i<120&&p.health===100;i++){
    const v=r.projectiles[0];if(v){const h=r.world.castShape(v,{x:0,y:0,z:0,w:1},{x:v.vx,y:v.vy,z:v.vz},new RAPIER.Ball(.18),0,1/60,true,undefined,undefined,r.stalkerColliders[v.owner],r.stalkerBodies[v.owner]);if(h)collision=JSON.stringify({handle:h.collider.handle,player:r.colliders.get(p.id)!.handle,projectile:v,p,s});}
    r.step();
  }
  assert.equal(p.health,100-COMBAT.stalker.projectileDamage,collision);const damage=r.damageEvents.filter(e=>e.kind==="spore");assert.equal(damage.length,1);
  ticks(r,20);assert.equal(p.health,100-COMBAT.stalker.projectileDamage);assert.ok(damage[0].source);r.dispose();
});
test("a launched projectile is swept against cover and cannot damage through a wall",()=>{
  const {r,p,s}=encounter();
  for(let i=0;i<200&&!r.projectiles.length;i++)r.step();assert.equal(r.projectiles.length,1);
  r.world.createCollider(RAPIER.ColliderDesc.cuboid(5,8,.4).setTranslation(p.x,p.y,p.z+5));r.world.step();ticks(r,100);
  assert.equal(p.health,100);assert.equal(r.projectiles.length,0);assert.equal(r.damageEvents.filter(e=>e.kind==="spore").length,0);r.dispose();
});
test("close melee has windup, a bounded active strike, and cooldown",()=>{
  const {r,p,s}=encounter(1.9);
  for(let i=0;i<100&&s.state!=="windup";i++)r.step();assert.equal(s.attackKind,"melee");assert.equal(p.health,100);
  const began=r.time;ticks(r,20);assert.equal(p.health,100);
  for(let i=0;i<80&&p.health===100;i++)r.step();assert.equal(p.health,100-COMBAT.stalker.meleeDamage);assert.ok(r.time-began>=.68);
  const attack=s.attackId;ticks(r,30);assert.equal(p.health,100-COMBAT.stalker.meleeDamage);assert.equal(s.attackId,attack);r.dispose();
});
test("cover or a successful dodge during melee preparation prevents damage",()=>{
  const {r,p,s}=encounter(1.9);for(let i=0;i<100&&s.state!=="windup";i++)r.step();
  p.x-=6;r.bodies.get(p.id)!.setTranslation(p,true);ticks(r,55);assert.equal(p.health,100);r.dispose();
});
test("a late sidestep outside the committed melee arc avoids a strike while still in range",()=>{
  const {r,p,s}=encounter(1.9);for(let i=0;i<100&&s.state!=="windup";i++)r.step();
  ticks(r,31);p.x=s.x;p.z=s.z+1.9;r.bodies.get(p.id)!.setTranslation(p,true);ticks(r,20);
  assert.equal(p.health,100);r.dispose();
});
test("death cancels windup and owned projectiles; a dead creature cannot attack",()=>{
  const {r,p,s}=encounter();for(let i=0;i<150&&s.state!=="windup";i++)r.step();
  s.health=18;r.action(p.id,"fire",{yaw:Math.atan2(s.x-p.x,s.z-p.z),pitch:Math.atan2(p.y+.65-s.y,Math.hypot(s.x-p.x,s.z-p.z))});assert.equal(s.state,"dead");ticks(r,180);
  assert.equal(p.health,100);assert.equal(r.projectiles.length,0);assert.equal(r.stalkerColliders[0].isEnabled(),false);r.dispose();
});
test("A* routes around a simple obstacle without corner cutting",()=>{
  const route=findRoute({x:0,y:.82,z:0},{x:12,y:.82,z:0},()=>0,(a,b)=>!((Math.abs(b.x-6)<1&&Math.abs(b.z)<4)||(Math.min(a.x,b.x)<6&&Math.max(a.x,b.x)>6&&Math.abs(b.z)<4)));
  assert.ok(route.length>4);assert.ok(route.some(p=>Math.abs(p.z)>=6));assert.ok(Math.hypot(route.at(-1)!.x-12,route.at(-1)!.z)<=3);
});
test("an investigating creature moves around a physical wall instead of pushing through it",()=>{
  const {r,p,s}=encounter();
  r.world.createCollider(RAPIER.ColliderDesc.cuboid(2,5,.6).setTranslation(p.x,p.y,p.z+6));r.world.step();
  hearNoise(r,p,48);const start={x:s.x,z:s.z};let lateral=0;
  for(let i=0;i<360;i++){r.step();lateral=Math.max(lateral,Math.abs(s.x-start.x));}
  assert.ok(lateral>2,JSON.stringify({s,lateral}));assert.ok(Math.hypot(s.x-start.x,s.z-start.z)>4);
  assert.ok(s.y>=ground(s.x,s.z,r.seed)+.7);r.dispose();
});
test("damage bearings identify front, back, left and right with the FPS coordinate convention",()=>{
  const p={x:0,y:0,z:0};assert.equal(damageBearing({x:0,y:0,z:1},p,0),0);
  assert.ok(Math.abs(Math.abs(damageBearing({x:0,y:0,z:-1},p,0))-Math.PI)<1e-10);
  assert.equal(damageBearing({x:-1,y:0,z:0},p,0),Math.PI/2);
  assert.equal(damageBearing({x:1,y:0,z:0},p,0),-Math.PI/2);
});
test("repeated snapshots play damage and successful hit feedback exactly once; misses never confirm",()=>{
  const {r,p}=encounter();r.damage(p,12,{x:10,y:p.y,z:p.z},"claw",7);
  const f=new Feedback(),s=r.snapshot();assert.equal(f.consume(s,p.id,100).length,1);assert.equal(f.consume(s,p.id,120).length,0);
  s.pulses=[{id:0,shooter:p.id,from:p,to:p,hit:false,expires:10,kind:"miss"}];assert.equal(f.consume(s,p.id,130).length,0);
  s.pulses=[{...s.pulses[0],id:1,hit:true,kind:"creature"}];assert.equal(f.consume(s,p.id,140)[0].kind,"hit");assert.equal(f.consume(s,p.id,150).length,0);r.dispose();
});
test("animation poses distinguish charge, strike, stagger and death without moving the authoritative body",()=>{
  const {r,s}=encounter();const before={x:s.x,y:s.y,z:s.z};
  s.state="windup";s.attackKind="ranged";s.stateSince=1;s.until=2;
  assert.ok(creaturePose(s,1.8,2).charge>.7);assert.equal(creaturePose(s,1.8,2).ranged,true);
  s.state="stagger";assert.notEqual(creaturePose(s,1.1,0).flinch,0);
  s.state="dead";s.diedAt=2;assert.equal(creaturePose(s,3,0).death,1);assert.deepEqual({x:s.x,y:s.y,z:s.z},before);r.dispose();
});
test("remote creature interpolation remains continuous across snapshot arrivals",()=>{
  const {r,s}=encounter();const buffer=new SnapshotBuffer();r.time=0;buffer.push(r.snapshot(),0);s.x+=2;r.time=.1;buffer.push(r.snapshot(),.1);
  const a=buffer.sampleStalker(s.id,.2)!;s.x+=2;r.time=.2;buffer.push(r.snapshot(),.2);const b=buffer.sampleStalker(s.id,.2)!;
  assert.ok(Math.abs(a.x-b.x)<.01);r.dispose();
});
