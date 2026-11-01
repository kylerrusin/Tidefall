import RAPIER from "@dimforge/rapier3d-compat";
import {passiveKind} from './biology';
import { COMBAT, CREATURE_TYPES, inVision } from "./combat";
import { weatherAt } from "./climate";
import { planetForSeed } from "./planets";
import { findRoute } from "./navigation";
import { chemistry, ground, type Stalker, type V3, type Player, type BioProjectile, type DamageEvent } from "./model";
import { distance } from "./survival";
import type { Water } from "./water";
export const isHeavy=(s:Stalker)=>s.kind==="ridgeback"||s.kind==="sentinel"||s.kind==='ambusher';
const heavyType=(s:Stalker)=>s.kind==="sentinel"?CREATURE_TYPES.sentinel:s.kind==='ambusher'?CREATURE_TYPES.ambusher:CREATURE_TYPES.ridgeback;
export const creatureClearance=(kind:Stalker["kind"])=>CREATURE_TYPES[kind].radius+(kind==="surveyor"?2.1:.04);
const C = COMBAT.stalker, ROT = { x: 0, y: 0, z: 0, w: 1 };
type Brain = { decideAt: number; repathAt: number; commitUntil: number; stuck: number; last: V3; patrol: number };
export interface CreatureWorld {
  world: RAPIER.World; time: number; seed: number; water: Water; extraction?: {timeline:{duration:number}};
  players: Map<string, Player>; colliders: Map<string, RAPIER.Collider>;
  stalkers: Stalker[]; stalkerBodies: RAPIER.RigidBody[]; stalkerColliders: RAPIER.Collider[];
  stalkerControllers: RAPIER.KinematicCharacterController[]; brains: Map<number, Brain>;
  projectiles: BioProjectile[]; projectileId: number; attackId: number;
  damage(p: Player, amount: number, source: V3 | null, kind: DamageEvent["kind"], attackId?: number): void;
  dropLoot(s: Stalker): void;
}
export function stalkerState(id: number, pos: V3, kind:Stalker["kind"]="stalker"): Stalker {
  const type=CREATURE_TYPES[kind];
  return { ...pos, id, kind, radius:type.radius, dropped:false,staggerReadyAt:0,health: type.health, state: "idle", stateSince: 0, until: 0, vx: 0, vz: 0,
    yaw: Math.PI, targetId: null, lastKnown: null, lastSeen: -100, attackId: 0, attackKind: "melee",
    nextMelee: 0, nextRanged: 0, attackDone: false, home: { ...pos }, path: [], diedAt: null, damageSeq: 0 };
}
export function creatureSpawn(r: Pick<CreatureWorld,"world"|"water"|"seed">, nominal: {x:number;z:number}, kind:Stalker["kind"]="stalker") {
  for(let ring=0;ring<=12;ring++)for(let i=0;i<(ring?12:1);i++){
    const x=nominal.x+Math.cos(i*Math.PI/6)*ring*3,z=nominal.z+Math.sin(i*Math.PI/6)*ring*3;
    const radius=CREATURE_TYPES[kind].radius,point={x,y:ground(x,z,r.seed)+creatureClearance(kind),z};
    if(Math.abs(x)>148 || Math.abs(z)>148)continue;
    if(r.water.sample(x,z).depth>CREATURE_TYPES[kind].maxDepth ||kind==='skimmer'&&r.water.sample(x,z).depth<.7|| chemistry(x,z,0,r.seed).temperature>CREATURE_TYPES[kind].heatLimit)continue;
    if(!r.world.intersectionWithShape(point,ROT,new RAPIER.Ball(radius+.01)))return point;
  }
  throw new Error(`No safe ${kind} habitat near ${nominal.x},${nominal.z}`);
}
function state(s: Stalker, name: Stalker["state"], time: number, duration = 0) {
  if (s.state !== name) s.stateSince = time;
  s.state = name; s.until = time + duration;
}
function brain(r: CreatureWorld, s: Stalker) {
  let b = r.brains.get(s.id);
  if (!b) { b = { decideAt: 0, repathAt: 0, commitUntil: 0, stuck: 0, last: { ...s }, patrol: 0 }; r.brains.set(s.id, b); }
  return b;
}
export function creatureLOS(r: CreatureWorld, s: Stalker, p: V3, target?: RAPIER.Collider) {
  // Elevated sensory organ to suit chest, excluding only the organism itself.
  const from = { x: s.x, y: s.y + 0.3, z: s.z }, to = { x: p.x, y: p.y + 0.3, z: p.z };
  const d = distance(from, to);
  if (d < 0.05) return true;
  const hit = r.world.castRay(new RAPIER.Ray(from, { x: (to.x-from.x)/d, y: (to.y-from.y)/d, z: (to.z-from.z)/d }), d, true,
    undefined, undefined, r.stalkerColliders[s.id], r.stalkerBodies[s.id]);
  return !hit || hit.collider.handle === target?.handle;
}
export function hearNoise(r: CreatureWorld, position: V3, radius: number, owner?: string) {
  for (const s of r.stalkers) {
    if (!s.health || r.time < C.grace || distance(s, position) > radius || ["windup", "attack", "stagger", "recover"].includes(s.state)) continue;
    if (s.targetId && r.time - s.lastSeen < 1) continue;
    s.lastKnown = { ...position }; s.lastSeen = r.time;
    // A noise identifies a location, not an unseen player's live transform.
    if (!s.targetId && owner) s.targetId = owner;
    state(s, "suspicious", r.time, 0.45);
    brain(r, s).repathAt = 0;
  }
}
export function hurtStalker(r: CreatureWorld, s: Stalker, shooter: Player, direction: V3, hit:V3=s) {
  const rear=(hit.x-s.x)*Math.sin(s.yaw)+(hit.z-s.z)*Math.cos(s.yaw)<-s.radius*.2;
  const type=CREATURE_TYPES[s.kind],weak=(isHeavy(s)&&rear)||s.kind==="surveyor"&&!rear&&hit.y>s.y+.05;
  s.health = Math.max(0, s.health - COMBAT.rifle.damage*(weak?1.8:type.armor)); s.damageSeq++;
  const knock=Math.min(3.5,315/type.mass);s.vx = direction.x * knock; s.vz = direction.z * knock;
  s.targetId = shooter.id; s.lastKnown = { x: shooter.x, y: shooter.y, z: shooter.z }; s.lastSeen = r.time;
  brain(r, s).commitUntil = r.time + C.commitment;
  if(!s.health || r.time>=s.staggerReadyAt || weak){state(s, s.health ? "stagger" : "dead", r.time, type.mechanical?.16:s.kind==="ridgeback"?.22:C.stagger);s.staggerReadyAt=r.time+1.3;s.attackDone=true;}
  s.path = [];
  if (!s.health) {
    s.diedAt = r.time; r.stalkerColliders[s.id].setEnabled(false);
    r.projectiles = r.projectiles.filter(p => p.owner !== s.id);
    r.dropLoot(s);
  }
  return weak;
}
function clearRoute(r: CreatureWorld, s: Stalker, a: V3, b: V3) {
  if (r.water.sample(b.x, b.z).depth > CREATURE_TYPES[s.kind].maxDepth || chemistry(b.x, b.z, 0,r.seed).temperature > CREATURE_TYPES[s.kind].heatLimit) return false;
  const delta = { x: b.x-a.x, y: b.y-a.y, z: b.z-a.z };
  const hit = r.world.castShape(a, ROT, delta, new RAPIER.Ball(s.radius*.88), 0, 1, true,
    RAPIER.QueryFilterFlags.EXCLUDE_KINEMATIC, undefined, r.stalkerColliders[s.id]);
  return !hit;
}
function rangedClear(r: CreatureWorld, s: Stalker, p: Player) {
  const origin={x:s.x,y:s.y+.35,z:s.z};
  const hit=r.world.castShape(origin,ROT,{x:p.x-s.x,y:p.y+.25-origin.y,z:p.z-s.z},new RAPIER.Ball(C.projectileRadius),0,1,true,
    undefined,undefined,r.stalkerColliders[s.id],r.stalkerBodies[s.id]);
  return !hit || hit.collider.handle===r.colliders.get(p.id)?.handle;
}
function advanceDecision(r: CreatureWorld, s: Stalker, b: Brain) {
  const now = r.time;
  if (now < C.grace) return;
  if (s.state === "stagger") { if (now >= s.until) state(s, "alert", now, 0.3); return; }
  if (["windup", "attack", "recover"].includes(s.state)) return;
  if (r.water.sample(s.x,s.z).depth > CREATURE_TYPES[s.kind].maxDepth || Math.hypot(r.water.sample(s.x,s.z).u,r.water.sample(s.x,s.z).v)>CREATURE_TYPES[s.kind].maxCurrent || chemistry(s.x,s.z,0,r.seed).temperature > CREATURE_TYPES[s.kind].heatLimit) { state(s,"retreat",now); return; }
  if(weatherAt(now,r.seed,r.extraction?.timeline.duration).storm>.8 && s.kind==="stalker" && s.y>25){state(s,"retreat",now);return;}
  const players = [...r.players.values()].filter(p => p.alive && p.connected);
  if(s.kind==='ambusher'&&s.health===CREATURE_TYPES.ambusher.health&&!players.some(p=>distance(p,s)<13)){state(s,'idle',now);return;}
  const weather=weatherAt(now,r.seed,r.extraction?.timeline.duration),range=CREATURE_TYPES[s.kind].vision*(CREATURE_TYPES[s.kind].mechanical?1:.7+.3*weather.solar.daylight)*(.7+.3*weather.visibility);
  const visible = players.filter(p => (s.kind!=="ridgeback"||s.health<CREATURE_TYPES.ridgeback.health||distance(p,s.home)<16) && inVision(s, s.yaw, p,range) && creatureLOS(r, s, p, r.colliders.get(p.id)));
  let target = players.find(p => p.id === s.targetId);
  const visibleTarget = target && visible.includes(target);
  if (!target || (!visibleTarget && now > b.commitUntil)) {
    const candidate = visible.sort((a, b) => distance(s, a)-distance(s, b) || a.color-b.color)[0];
    if (candidate && (!target || now > b.commitUntil)) { target = candidate; s.targetId = candidate.id; b.commitUntil = now + C.commitment; }
  }
  const seen = !!target && visible.includes(target);
  if (seen && target) {
    s.lastKnown = { x: target.x, y: target.y, z: target.z }; s.lastSeen = now;
    if (["idle", "patrol", "suspicious", "investigate", "search"].includes(s.state)) { state(s, "alert", now, C.alert); return; }
  } else {
    // Footsteps have a finite acoustic radius and store only the heard location.
    if (["idle", "patrol"].includes(s.state)) {
      const heard = players.find(p => Math.hypot(p.vx,p.vz) > 1.5 && distance(p,s) < (p.input.sprint ? C.sprintHearing : C.walkHearing));
      if (heard) { hearNoise(r, heard, heard.input.sprint ? C.sprintHearing : C.walkHearing); return; }
    }
    if (s.state === "alert" && now < s.until) return;
    if (s.lastKnown && now - s.lastSeen < C.memory) {
      if (s.state === "suspicious" && now < s.until) return;
      state(s, distance(s, s.lastKnown) < 2 ? "search" : "investigate", now);
    } else { s.targetId = null; s.lastKnown = null; state(s, "patrol", now); }
  }
  if (s.state === "alert") { if (now < s.until) return; state(s, "chase", now); }
  if (!seen || !target) return;
  const d = distance(s,target);
  if (r.water.sample(s.x,s.z).depth > CREATURE_TYPES[s.kind].maxDepth || Math.hypot(r.water.sample(s.x,s.z).u,r.water.sample(s.x,s.z).v)>CREATURE_TYPES[s.kind].maxCurrent || chemistry(s.x,s.z,0,r.seed).temperature > CREATURE_TYPES[s.kind].heatLimit) { state(s, "retreat", now); return; }
  const attacking = r.stalkers.filter(v => v.id !== s.id && ["windup","attack"].includes(v.state)).length;
  if (attacking >= C.activeAttackers) { state(s, "position", now); return; }
  if(isHeavy(s) && d<=heavyType(s).chargeRange && now>=s.nextMelee){
    s.attackKind="charge";s.attackId=++r.attackId;s.attackDone=false;s.yaw=Math.atan2(target.x-s.x,target.z-s.z);state(s,"windup",now,heavyType(s).chargeWindup);
  } else if (!isHeavy(s) && s.kind!=="surveyor" && d <= C.meleeRange && now >= s.nextMelee) {
    s.attackKind = "melee"; s.attackId = ++r.attackId; s.attackDone = false;
    s.yaw=Math.atan2(target.x-s.x,target.z-s.z);
    state(s, "windup", now, C.meleeWindup);
  } else if (!isHeavy(s) && d >= (s.kind==="surveyor"?4:C.rangedMin) && d <= CREATURE_TYPES[s.kind].rangedMax && now >= s.nextRanged && rangedClear(r,s,target)) {
    s.attackKind = "ranged"; s.attackId = ++r.attackId; s.attackDone = false;
    s.yaw=Math.atan2(target.x-s.x,target.z-s.z);
    state(s, "windup", now, C.rangedWindup);
  } else state(s, d < C.rangedMax && d > 5 ? "position" : "chase", now);
}
function updatePassive(r:CreatureWorld,s:Stalker,dt:number){const attackUntil=s.until,type=CREATURE_TYPES[s.kind],near=[...r.players.values()].filter(p=>p.alive&&p.connected).sort((a,b)=>distance(a,s)-distance(b,s))[0],afraid=near&&distance(near,s)<(s.kind==='scuttler'?6:10),water=r.water.sample(s.x,s.z);
 let angle=r.time*.045+s.id*2.1,tx=s.home.x+Math.cos(angle)*5,tz=s.home.z+Math.sin(angle)*5,speed=s.kind==='skimmer'?.75:.65;
 if(afraid){const d=Math.max(.1,Math.hypot(s.x-near.x,s.z-near.z));tx=s.x+(s.x-near.x)/d*7;tz=s.z+(s.z-near.z)/d*7;speed=type.chaseSpeed;state(s,'retreat',r.time);}else state(s,'patrol',r.time);
 if(s.kind==='scuttler'&&near&&s.health<type.health&&distance(s,near)<1.8){speed=0;if(r.time>=s.nextMelee&&s.attackKind!=='charge'){s.attackKind='charge';s.until=r.time+.6;state(s,'windup',r.time,.6);}else if(s.attackKind==='charge'){state(s,'windup',r.time,attackUntil-r.time);if(r.time>=attackUntil){if(creatureLOS(r,s,near,r.colliders.get(near.id)))r.damage(near,12,s,'claw',++r.attackId);s.nextMelee=r.time+2.5;s.attackKind='melee';}}}
 let dx=tx-s.x,dz=tz-s.z,d=Math.max(.1,Math.hypot(dx,dz));const nx=s.x+dx/d,nz=s.z+dz/d,nextWater=r.water.sample(nx,nz);
 if(Math.abs(nx)>146||Math.abs(nz)>146||s.kind!=='skimmer'&&nextWater.depth>type.maxDepth||s.kind==='skimmer'&&nextWater.depth<.7){dx=-dx;dz=-dz;speed=.4;}
 const response=1-Math.exp(-dt*5);s.vx+=(dx/d*speed-s.vx)*response;s.vz+=(dz/d*speed-s.vz)*response;s.yaw+=Math.atan2(Math.sin(Math.atan2(s.vx,s.vz)-s.yaw),Math.cos(Math.atan2(s.vx,s.vz)-s.yaw))*Math.min(1,dt*5);
 const body=r.stalkerBodies[s.id],collider=r.stalkerColliders[s.id],controller=r.stalkerControllers[s.id],vertical=s.kind==='skimmer'?Math.max(-.2,Math.min(.2,((water.depth>.7?water.level-.35:ground(s.x,s.z,r.seed)+s.radius)-s.y)*dt*4)):-planetForSeed(r.seed).gravity*dt;
 controller.computeColliderMovement(collider,{x:s.vx*dt,y:vertical,z:s.vz*dt},undefined,undefined,c=>c.handle!==collider.handle);const m=controller.computedMovement();body.setNextKinematicTranslation({x:s.x+m.x,y:s.y+m.y,z:s.z+m.z});
 if(s.kind!=='skimmer'&&water.depth>type.maxDepth+1){s.health=Math.max(0,s.health-dt*5);if(!s.health){state(s,'dead',r.time);s.diedAt=r.time;collider.setEnabled(false);r.dropLoot(s);}}
}
export function updateCreatures(r: CreatureWorld, dt: number) {
  const now = r.time;
  for (const s of r.stalkers) {
    if (!s.health) continue;
    const b = brain(r,s), body = r.stalkerBodies[s.id], collider = r.stalkerColliders[s.id];
    if(passiveKind(s.kind)){if(now>=C.grace)updatePassive(r,s,dt);continue;}
    if (now >= b.decideAt) { b.decideAt = now + C.decision; advanceDecision(r,s,b); }
    const target = r.players.get(s.targetId ?? "");
    if (s.state === "windup") {
      if (!target?.alive || !target.connected) { state(s,"search",now); s.attackDone = true; }
      else {
        const visible=creatureLOS(r,s,target,r.colliders.get(target.id));
        // The last 220 ms commit the strike to a direction. Hidden players are
        // represented by their last sighting, never a live position through cover.
        if(visible && now<s.until-.22){
          s.lastKnown={x:target.x,y:target.y,z:target.z};
          const yaw=Math.atan2(target.x-s.x,target.z-s.z);
          s.yaw+=Math.atan2(Math.sin(yaw-s.yaw),Math.cos(yaw-s.yaw))*Math.min(1,dt*6);
        }
        if (now >= s.until) {
          state(s,"attack",now,s.attackKind==="charge"?heavyType(s).chargeTime:.18);
          if (s.attackKind === "ranged") {
            s.nextRanged = now + CREATURE_TYPES[s.kind].rangedCooldown; s.attackDone = true;
            // Limited lead, frozen at discharge. Travel and swept collision stay authoritative.
            const from = { x:s.x, y:s.y+0.35, z:s.z }, known=s.lastKnown??target, d = distance(s,known), lead = visible?Math.min(0.3,d/C.projectileSpeed):0;
            const aim = { x:known.x + Math.max(-5,Math.min(5,target.vx))*lead, y:known.y+0.25, z:known.z + Math.max(-5,Math.min(5,target.vz))*lead };
            const length = Math.max(0.01,distance(from,aim)), v = { x:(aim.x-from.x)/length, y:(aim.y-from.y)/length, z:(aim.z-from.z)/length };
            r.projectiles.push({ ...from, kind:CREATURE_TYPES[s.kind].mechanical?"ion":"spore", id:++r.projectileId, owner:s.id, attackId:s.attackId, vx:v.x*CREATURE_TYPES[s.kind].projectileSpeed, vy:v.y*CREATURE_TYPES[s.kind].projectileSpeed, vz:v.z*CREATURE_TYPES[s.kind].projectileSpeed, expires:now+C.projectileLife });
          } else s.nextMelee = now + (s.attackKind==="charge"?heavyType(s).chargeCooldown:C.meleeCooldown);
        }
      }
    }
    if (s.state === "attack") {
      if (s.attackKind !== "ranged" && !s.attackDone) {
        if(s.attackKind==="melee")s.attackDone = true;
        const arc=target?Math.abs(Math.atan2(Math.sin(Math.atan2(target.x-s.x,target.z-s.z)-s.yaw),Math.cos(Math.atan2(target.x-s.x,target.z-s.z)-s.yaw))):Math.PI;
        if (target?.alive && target.connected && distance(s,target) <= (s.attackKind==="charge"?3:C.meleeRange) && arc<=C.meleeArc && creatureLOS(r,s,target,r.colliders.get(target.id))) {
          s.attackDone=true;const charge=s.attackKind==="charge";
          r.damage(target,charge?heavyType(s).chargeDamage:C.meleeDamage,s,"claw",s.attackId);
          target.pushX = Math.max(-6,Math.min(6,target.pushX + Math.sin(s.yaw)*(charge?5:2)));
          target.pushZ = Math.max(-6,Math.min(6,target.pushZ + Math.cos(s.yaw)*(charge?5:2)));
        }
      }
      if (now >= s.until) state(s,"recover",now,s.attackKind === "melee" ? 1.25 : 0.8);
    }
    if (s.state === "recover" && now >= s.until) state(s,"chase",now);
    let destination: V3 | null = null, speed: number = C.walkSpeed;
    if (now >= C.grace) {
      if (["chase","investigate","position"].includes(s.state)) {
        destination = s.lastKnown;
        speed = s.state === "chase" ? CREATURE_TYPES[s.kind].chaseSpeed : s.state === "investigate" ? 2.5 : C.walkSpeed;
        if (s.state === "position" && destination) {
          // Sidestep rather than pressing into a target while the ranged organ recovers.
          const sign = s.id % 2 ? -1 : 1;
          destination = { x:s.x + Math.cos(s.yaw)*3*sign, y:s.y, z:s.z-Math.sin(s.yaw)*3*sign };
        }
      } else if (s.state === "retreat") {
        destination = s.home;
        let best = -Infinity;
        for(let i=0;i<12;i++) {
          const x=s.x+Math.cos(i*Math.PI/6)*12,z=s.z+Math.sin(i*Math.PI/6)*12,y=ground(x,z,r.seed)+creatureClearance(s.kind);
          if(Math.abs(x)>150 || Math.abs(z)>150 || r.water.sample(x,z).depth>CREATURE_TYPES[s.kind].maxDepth || chemistry(x,z,0,r.seed).temperature>CREATURE_TYPES[s.kind].heatLimit)continue;
          const score=y-weatherAt(now,r.seed,r.extraction?.timeline.duration).storm*Math.max(0,y-20)*2-Math.hypot(x-s.home.x,z-s.home.z)*.05;
          if(score>best){best=score;destination={x,y,z};}
        }
        speed = C.chaseSpeed;
      }
      else if (s.state === "patrol") {
        const a = s.id*1.7 + b.patrol * Math.PI/2;
        destination = { x:s.home.x+Math.cos(a)*6, y:s.home.y, z:s.home.z+Math.sin(a)*6 };
        if (distance(s,destination)<2) b.patrol++;
      } else if (s.state === "search" || s.state === "suspicious") s.yaw += dt*0.65;
    }
    let desiredX=0, desiredZ=0;
    if (destination) {
      if (now >= b.repathAt) {
        b.repathAt = now + 0.9;
        const to = { x:destination.x, y:ground(destination.x,destination.z,r.seed)+creatureClearance(s.kind), z:destination.z };
        s.path = clearRoute(r,s,s,to) ? [to] : findRoute(s,to,(x,z)=>ground(x,z,r.seed),(a,b)=>clearRoute(r,s,a,b),320,creatureClearance(s.kind));
      }
      while (s.path.length && Math.hypot(s.path[0].x-s.x,s.path[0].z-s.z)<0.7) s.path.shift();
      const next=s.path[0];
      if (next) { const d=Math.max(0.01,Math.hypot(next.x-s.x,next.z-s.z)); desiredX=(next.x-s.x)/d*speed; desiredZ=(next.z-s.z)/d*speed; }
    }
    const response=1-Math.exp(-C.acceleration*dt);
    if(s.state==="attack" && s.attackKind==="charge"){desiredX=Math.sin(s.yaw)*heavyType(s).chargeSpeed;desiredZ=Math.cos(s.yaw)*heavyType(s).chargeSpeed;}
    if (s.state !== "stagger") { s.vx+=(desiredX-s.vx)*response; s.vz+=(desiredZ-s.vz)*response; }
    else { s.vx*=Math.exp(-4*dt); s.vz*=Math.exp(-4*dt); }
    if (Math.hypot(desiredX,desiredZ)>0.2) {
      const yaw=Math.atan2(desiredX,desiredZ);
      s.yaw+=Math.atan2(Math.sin(yaw-s.yaw),Math.cos(yaw-s.yaw))*Math.min(1,dt*7);
    }
    const controller=r.stalkerControllers[s.id];
    const fluid=r.water.sample(s.x,s.z),immersion=Math.max(0,Math.min(1,(fluid.level-s.y+s.radius)/(2*s.radius))),drag=1-Math.exp(-dt*immersion*3);s.vx+=(Math.max(-10,Math.min(10,fluid.u))-s.vx)*drag;s.vz+=(Math.max(-10,Math.min(10,fluid.v))-s.vz)*drag;
    controller.computeColliderMovement(collider,{ x:s.vx*dt,y:s.kind==="surveyor"?Math.max(-.3,Math.min(.3,(ground(s.x,s.z,r.seed)+creatureClearance(s.kind)-s.y)*4*dt)):-Math.min(0.3,planetForSeed(r.seed).gravity*dt),z:s.vz*dt },undefined,undefined,c=>c.handle!==collider.handle);
    const move=controller.computedMovement();
    s.motionSpeed=Math.min(16,Math.hypot(move.x,move.z)/dt);
    if (destination && Math.hypot(move.x,move.z)<dt*0.1) b.stuck+=dt; else b.stuck=0;
    if (b.stuck>1.2) { b.repathAt=0; b.patrol++; s.path=[]; state(s,"search",now); b.stuck=0; }
    body.setNextKinematicTranslation({x:s.x+move.x,y:s.y+move.y,z:s.z+move.z});
    if (r.water.sample(s.x,s.z).depth>CREATURE_TYPES[s.kind].maxDepth+1 || chemistry(s.x,s.z,0,r.seed).temperature>CREATURE_TYPES[s.kind].heatLimit+20) {
      s.health=Math.max(0,s.health-dt*8);
      if (!s.health) { state(s,"dead",now); s.diedAt=now; collider.setEnabled(false); r.projectiles=r.projectiles.filter(p=>p.owner!==s.id);r.dropLoot(s); }
    }
  }
  r.projectiles=r.projectiles.filter(p=>{
    if(p.expires<=now || !r.stalkers[p.owner]?.health) return false;
    const hit=r.world.castShape(p,ROT,{x:p.vx,y:p.vy,z:p.vz},new RAPIER.Ball(C.projectileRadius),0,dt,true,
      undefined,undefined,r.stalkerColliders[p.owner],r.stalkerBodies[p.owner]);
    if(hit) {
      const victim=[...r.players.values()].find(v=>v.alive && r.colliders.get(v.id)?.handle===hit.collider.handle);
      if(victim) r.damage(victim,CREATURE_TYPES[r.stalkers[p.owner].kind].projectileDamage,p,CREATURE_TYPES[r.stalkers[p.owner].kind].mechanical?"arc":"spore",p.attackId);
      return false;
    }
    p.x+=p.vx*dt; p.y+=p.vy*dt; p.z+=p.vz*dt; return true;
  });
}
