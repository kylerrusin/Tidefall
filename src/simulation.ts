import {caveLocation,caveData,caveStationAt} from './caves';
import {extractGeology} from './sampling';
import {SAMPLE_RULES,type Excavation} from './domain/sampling';
import {physicsIdentity} from './world';
import {LavaField} from './lava';
import {cabinWalkingAllowed,moveCabin,cabinWorld,seatedCabin,nearestFreeSeat,unseatPosition} from './cabin';
import {objectInteraction} from "./object-interaction";
import {GEOLOGY} from './geological-catalog';
import {mission,encounterPhase,type MatchMode} from './mission';
import {facility,initialDoors,interactionDoor,doorRecipes,doorPosition,doorSize,commandDoor,protectedRoom,type DoorRecipe,type DoorState} from './facility';
import {brineProperties} from "./planet-physics";
import {EnvironmentFields} from "./environment-fields";
import {RESCUE,initialExtraction,landingCandidates,shipAt,shipParts,hatchPose,canBoard,flightState,shipOffset,shipRotation} from "./extraction";
import RAPIER from "@dimforge/rapier3d-compat";
import {solidHeight} from './surface-query';
import { randomUUID } from "node:crypto";
import {
  Anchor,
  GRAVITY,
  Input,
  MATERIALS,
  ObjectState,
  Player,
  Snapshot,
  Stalker,
  Pulse,
  BioProjectile,
  DamageEvent,
  Supply,
  V3,
  anchorAcceleration,
  buoyancy,
  ground,
  exposedGeology,
  hash,
  submergedSphereFraction,
} from "./model";
import { muzzlePosition, aimFromMuzzle } from "./weapon";
import { replenishMedical } from "./resources";
import { Water } from "./water";
export { initPhysics, terrainMesh, structures } from "./world";
import { createStaticWorld } from "./world";
import {
  STEP,
  configureController,
  moveCharacter,
  copyPosition,
} from "./locomotion";
import {
  HARD_LIMIT,
  MAX_PLAYERS,
  SPAWNS,
  distance,
  environment,
  exposure,
  shelterAt,
  suppliesFor,
} from "./survival";
import { COMBAT, CREATURE_TYPES, lookDirection } from "./combat";
import { planetForSeed, planetIdForSeed } from "./planets";
import { updateCreatures, hearNoise, hurtStalker, stalkerState, creatureSpawn, type CreatureWorld } from "./creatures";

/** One authoritative room. All survival outcomes use fixed server ticks. */
export class Expedition {
  world: RAPIER.World;
  water: Water;
  lava:LavaField|null=null;
  fields:EnvironmentFields;
  extraction=initialExtraction();
  shipBodies:RAPIER.RigidBody[]=[];
  doors:DoorState[]=[];
  doorBodies=new Map<string,RAPIER.RigidBody>();
  tokens = new Map<string, string>();
  players = new Map<string, Player>();
  bodies = new Map<string, RAPIER.RigidBody>();
  colliders = new Map<string, RAPIER.Collider>();
  controllers = new Map<string, RAPIER.KinematicCharacterController>();
  props: RAPIER.RigidBody[] = [];
  objects: ObjectState[] = [];
  stalkers: Stalker[] = [];
  pulses: Pulse[] = [];
  excavations=new Map<string,Excavation>();
  pulseId = 0;
  projectiles: BioProjectile[] = [];
  damageEvents: DamageEvent[] = [];
  damageId = 0;
  projectileId = 0;
  attackId = 0;
  aiMs = 0;
  tsunami:Snapshot["tsunami"]=null;
  impactNoise = new Map<number, number>();
  directorAt = 90;
  resourceAt=0;resourceSerial=0;
  brains: CreatureWorld["brains"] = new Map();
  stalkerBodies: RAPIER.RigidBody[] = [];
  stalkerColliders: RAPIER.Collider[] = [];
  stalkerControllers: RAPIER.KinematicCharacterController[] = [];
  supplies: Supply[] = [];
  anchors: Anchor[] = [];
  time = 0;
  status: Snapshot["status"] = "ready";
  host = "";
  practice = false;
  winnerIds: string[] = [];
  result = "";
  lastActive = Date.now();
  commands = new Map<string, Input[]>();
  waterElapsed = 0;
  tick = 0;
  physicsMs = 0;networkMs=0;networkBytes=0;
  notice = "";
  noticeId = 0;
  constructor(
    public code: string,
    public seed = 42,
    public mode:MatchMode='survival',
  ) {
    this.extraction=initialExtraction(mission(mode));
    this.world = createStaticWorld(seed);
    this.doors=initialDoors(seed);for(const recipe of doorRecipes(seed)){const pos=doorPosition(recipe,this.doors.find(d=>d.id===recipe.id)!);const body=this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(pos.x,pos.y,pos.z));this.world.createCollider(RAPIER.ColliderDesc.cuboid(recipe.sx,doorSize(recipe,this.doors.find(d=>d.id===recipe.id)!).y,recipe.sz).setFriction(.75),body);this.doorBodies.set(recipe.id,body);}
    this.water = new Water(seed);if(seed<0)this.lava=new LavaField(seed);
    this.water.duration=this.extraction.timeline.duration;
    this.fields=new EnvironmentFields(seed);
    if(seed>=0)this.tsunami={id:1,warningAt:mission(mode).warning,triggerAt:mission(mode).warning+15,x:(hash(seed,19,3)-.5)*30,z:50,radius:16,amplitude:8,triggered:false,sourceVolume:0};
    this.supplies = suppliesFor(seed);
    this.world.step(); // Populate scene queries before selecting collision-free habitats.
    for (const [i, pos] of [{ x: -2, z: -88 }, { x: 38, z: -78 }, { x: -100, z: -30 }].entries()) {
      this.addCreature(pos,seed<0?(i===2?"sentinel":"surveyor"):(i===2?"ridgeback":"stalker"));
      this.world.step();
    }
    if(seed>=0)for(const [kind,x,z]of [['ambusher',-30,-70],['grazer',31,-103],['scuttler',-25,-82],['skimmer',26,46]] as const){try{this.addCreature({x,z},kind);this.world.step();}catch{}}
    for (let i = 0; i < 14; i++) {
      const material: keyof typeof MATERIALS =
        i >= 3 && i % 4 === 3
          ? "crate"
          : i < 3
            ? "pumice"
            : i % 3 === 0
              ? "basalt"
              : "pumice";
      const radius =
        i === 0
          ? 1.3
          : i === 1
            ? 0.65
            : i === 2
              ? 1.5
              : 0.7 + hash(seed, i, 8) * 0.8;
      const x =
          i === 0
            ? 68
            : i === 1
              ? 18
              : i === 2
                ? 15
                : i === 3
                  ? 35
                  : (hash(seed, i, 3) - 0.5) * 90,
        z =
          i === 0
            ? 2
            : i === 1
              ? -88
              : i === 2
                ? 48
                : i === 3
                  ? 17
                  : hash(seed, i, 4) * 100 - 30,
        y = solidHeight(x, z, seed) + radius + 0.3;
      const volume =
          material === "crate"
            ? 8 * 0.65 * radius ** 3
            : (4 / 3) * Math.PI * radius ** 3,
        density = MATERIALS[material].density,
        mass = volume * density;
      const desc = RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(x, y, z)
        .setLinearDamping(0.2)
        .setCcdEnabled(true);
      if (material === "crate") desc.enabledRotations(false, false, false);
      const body = this.world.createRigidBody(desc);
      this.world.createCollider(
        (material === "crate"
          ? RAPIER.ColliderDesc.cuboid(radius, radius * 0.65, radius)
          : RAPIER.ColliderDesc.ball(radius)
        )
          .setDensity(density)
          .setFriction(MATERIALS[material].friction)
          .setRestitution(0.05),
        body,
      );
      this.props.push(body);
      this.objects.push({
        id: i,
        material,
        radius,
        mass,
        x,
        y,
        z,
        vx: 0,
        vy: 0,
        vz: 0,
      });
    }
    this.supplies[5].objectId = 3;
    if(seed>=0)for(const [i,unitId]of ['TDF-LT-031','TDF-LT-043','TDF-MN-027'].entries()){const room=facility(seed).rooms[i],id=this.objects.length,radius=.08,density=GEOLOGY[unitId].density,mass=4/3*Math.PI*radius**3*density,x=room.x+1,z=room.z+1,y=facility(seed).y+.2;const b=this.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(x,y,z).setCcdEnabled(true));this.world.createCollider(RAPIER.ColliderDesc.ball(radius).setDensity(density).setFriction(.7),b);this.props.push(b);this.objects.push({id,material:'basalt',unitId,radius,mass,x,y,z,vx:0,vy:0,vz:0,active:true});}
    if(seed<0){const f=facility(seed);for(const [i,kind]of ['coolant','cell','thermal','bio'].entries())this.supplies.push({id:'pyrax-reserve-'+i,kind:kind as 'coolant'|'cell'|'thermal'|'bio',x:f.rooms[i].x,y:f.y+1,z:f.rooms[i].z,takenBy:null,active:true});}
    replenishMedical(this,true);
  }
  addCreature(position:{x:number;z:number},kind:Stalker["kind"]="stalker",valid?:(point:V3)=>boolean) {
    const point=creatureSpawn(this,position,kind),type=CREATURE_TYPES[kind],reuse=this.stalkers.findIndex(s=>s.health<=0&&this.time-(s.diedAt??this.time)>20),id=reuse<0?this.stalkers.length:reuse;
    if(kind==='skimmer')point.y=Math.max(point.y,this.water.sample(point.x,point.z).level-.35);
    if(valid && !valid(point))throw new Error("Habitat search violates encounter visibility or distance");
    const old=this.stalkers[id],body=old?this.stalkerBodies[id]:this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(point.x,point.y,point.z));if(old){this.world.removeCollider(this.stalkerColliders[id],true);body.setTranslation(point,true);body.setNextKinematicTranslation(point);this.brains.delete(id);}
    const collider=this.world.createCollider(RAPIER.ColliderDesc.ball(type.radius),body),controller=configureController(this.world);
    controller.setCharacterMass(type.mass);
    this.stalkers[id]={...stalkerState(id,point,kind),generation:(old?.generation??-1)+1};this.stalkerBodies[id]=body;this.stalkerColliders[id]=collider;if(old)this.world.removeCharacterController(this.stalkerControllers[id]);this.stalkerControllers[id]=controller;
  }
  dropLoot(s:Stalker) {
    if(s.dropped)return;s.dropped=true;
    const free=this.objects.findIndex((o,i)=>i>=14&&o.active===false),id=free<0?this.objects.length:free;if(id>=38)return;
    const material=s.kind==="surveyor"?"circuit":s.kind==="sentinel"?"alloy":s.kind==="ridgeback"?"chitin":"biomass",radius=.09,density=MATERIALS[material].density,mass=4/3*Math.PI*radius**3*density;
    const body=free<0?this.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(s.x,s.y+.3,s.z).setCcdEnabled(true).setLinearDamping(.3)):this.props[id];
    if(free<0)this.world.createCollider(RAPIER.ColliderDesc.ball(radius).setDensity(density).setFriction(.7).setRestitution(.1),body);else {body.setEnabled(true);body.setTranslation({x:s.x,y:s.y+.3,z:s.z},true);body.setLinvel({x:0,y:0,z:0},true);body.collider(0).setShape(new RAPIER.Ball(radius));body.collider(0).setDensity(density);body.recomputeMassPropertiesFromColliders();}
    this.props[id]=body;this.objects[id]={id,material,radius,mass,x:s.x,y:s.y+.3,z:s.z,vx:0,vy:0,vz:0,active:true};
    this.supplies=this.supplies.filter(o=>!(o.id.startsWith('loot-')&&o.active===false));this.supplies.push({id:`loot-${s.id}-${s.generation??0}`,objectId:id,x:s.x,y:s.y+.3,z:s.z,kind:s.kind==="surveyor"?"cell":s.kind==="sentinel"||s.kind==="ridgeback"?"mineral":"bio",takenBy:null,expires:this.time+90,active:true});
  }
  deactivateObject(id:number) {
    if(this.objects[id]){this.objects[id].active=false;this.props[id].setEnabled(false);}
    for(const s of this.supplies)if(s.objectId===id)s.active=false;
  }
  directEncounters() {
    if(this.time<this.directorAt || this.stalkers.filter(s=>s.health>0).length>=12)return;
    const phase=encounterPhase(this.time,this.extraction.timeline.duration);this.directorAt=this.time+32-phase*6;
    const crew=[...this.players.values()].filter(p=>p.alive&&p.connected),budget=this.seed<0?Math.min(8,3+crew.length+phase):Math.min(8,2+phase+Math.floor(this.fields.cells.reduce((sum,c)=>sum+c.productivity,0)/30));
    if(!crew.length || this.stalkers.filter(s=>s.health>0&&!['grazer','scuttler','skimmer'].includes(s.kind)).length>=budget||this.stalkers.length>=24&&!this.stalkers.some(s=>s.health<=0&&this.time-(s.diedAt??this.time)>20))return;
    const p=crew[this.stalkers.length%crew.length];
    for(let i=0;i<16;i++){
      const angle=hash(this.seed,this.tick,i)*Math.PI*2,radius=32+hash(this.seed,i,this.tick)*25;
      const candidate={x:p.x+Math.sin(angle)*radius,z:p.z+Math.cos(angle)*radius};
      if(Math.abs(candidate.x)>145||Math.abs(candidate.z)>145)continue;
      if(this.seed>=0&&this.fields.sample(candidate.x,candidate.z).productivity<.04)continue;
      const y=ground(candidate.x,candidate.z,this.seed)+1.5;
      if(crew.some(q=>Math.hypot(q.x-candidate.x,q.z-candidate.z)<28))continue;
      if(crew.some(q=>this.visible({x:q.x,y:q.y+.65,z:q.z},{...candidate,y},q.id)))continue;
      const climate=environment(this.time,this.seed,this.extraction.timeline.duration),rocky=this.seed<0 || y>24;
      const heavy=rocky && (this.time>=180 || climate.solar.night>.5 || climate.storm>.5) && this.stalkers.length%2===0;
      try{this.addCreature(candidate,this.seed<0?(heavy?"sentinel":"surveyor"):(heavy?"ridgeback":phase>0&&this.tick%3===0?'ambusher':"stalker"),point=>Math.hypot(point.x-p.x,point.z-p.z)<=70 && crew.every(q=>Math.hypot(q.x-point.x,q.z-point.z)>=28 && !this.visible({x:q.x,y:q.y+.65,z:q.z},point,q.id)));break;}catch{}
    }
  }
  join(token?: string) {
    let p = token
      ? this.players.get(
          [...this.tokens].find(([, secret]) => secret === token)?.[0] ?? "",
        )
      : undefined;
    if (p) {
      p.connected = true;
      p.disconnectedAt = null;
      p.ack = -1;
      this.commands.delete(p.id);
      p.input = { x: 0, z: 0, yaw: p.yaw, jump: false, sprint: false, seq: 0 };
      this.colliders.get(p.id)?.setEnabled(p.alive);
      return p;
    }
    if (this.players.size >= MAX_PLAYERS)
      throw new Error("Room full. Four astronauts maximum.");
    const id = randomUUID(),
      i = this.players.size,
      { x, z } = SPAWNS[i],
      participant = this.status === "ready";
    p = {
      id,
      x,
      z,
      y: ground(x, z, this.seed) + 1.01,
      color: i,
      extractedAt:null,cabin:null,
      yaw: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      fuel: 100,
      rechargeDelay: 0,
      loaded: true,
      minerals: 0,
      medicine: 0,
      thermalUntil: 0,
      cells:0,compounds:0,medicalAt:-100,wetness:0,coldSeconds:0,coldStage:"normal",
      energy: 100,
      weaponEnergy: 100,
      firedAt: -10,
      equipped:1,rifleMode:"combat",samples:[],sampleNotice:"",
      health: 100,
      oxygen: 100,
      temperature: 37,
      canisters: 0,
      insulated: false,
      alive: participant,
      participant,
      ready: false,
      diedAt: null,
      deathCause: "",
      disconnectedAt: null,
      shoveAt: -10,
      pushX: 0,
      pushZ: 0,
      shelter: null,
      connected: true,
      input: { x: 0, z: 0, yaw: 0, jump: false, sprint: false, seq: 0 },
      lastJump: false,
      grounded: false,
      coyote: 0,
      jumpBuffer: 0,
      airTime: 0,
      thrusting: false,
      ack: -1,
    };
    this.players.set(id, p);
    this.tokens.set(id, randomUUID());
    if (!this.host) this.host = id;
    const body = this.world.createRigidBody(
        RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(
          p.x,
          p.y,
          p.z,
        ),
      ),
      collider = this.world.createCollider(
        RAPIER.ColliderDesc.capsule(0.55, 0.4),
        body,
      );
    collider.setEnabled(p.alive);
    this.bodies.set(id, body);
    this.colliders.set(id, collider);
    this.controllers.set(id, configureController(this.world));
    return p;
  }
  disconnect(id: string) {
    const p = this.players.get(id);
    if (p) {
      p.connected = false;
      p.disconnectedAt = this.time;
      this.commands.delete(id);
      p.input = { ...p.input, x: 0, z: 0, jump: false, dive: false };
    }
    if (id === this.host) {
      const next = [...this.players.values()].find((q) => q.connected);
      if (next) this.host = next.id;
    }
  }
  input(id: string, data: unknown) {
    const p = this.players.get(id);
    if (
      this.status !== "running" ||
      !p ||
      (!p.alive&&!p.cabin) ||
      !data ||
      typeof data !== "object"
    )
      return;
    const i = data as Input;
    if (
      ![i.x, i.z, i.yaw, i.seq].every(Number.isFinite) ||
      Math.abs(i.x) > 1 ||
      Math.abs(i.z) > 1 ||
      Math.abs(i.yaw) > 1e5 ||
      !Number.isSafeInteger(i.seq) ||
      i.seq <= p.ack
    )
      return;
    const command: Input = {
      x: i.x,
      z: i.z,
      yaw: i.yaw,
      jump: i.jump === true,
      dive: i.dive === true,
      sprint: i.sprint === true,
      seq: i.seq,
    };
    const queue = this.commands.get(id) ?? [];
    if (queue.length && i.seq <= queue.at(-1)!.seq) return;
    queue.push(command);
    if (queue.length > 12) queue.shift();
    this.commands.set(id, queue);
  }
  announce(text: string) {
    this.notice = text;
    this.noticeId++;
  }
  damage(p: Player, amount: number, source: V3 | null, kind: DamageEvent["kind"], attackId = 0) {
    if (!p.alive || amount <= 0) return;
    const actual = Math.min(p.health, amount);
    p.health = Math.max(0, p.health - actual);
    this.recordDamage(p, actual, source, kind, attackId);
    if (!p.health) this.eliminate(p, kind === "pulse" ? "Kinetic pulse" : kind === "claw" ? ((source as Stalker)?.kind==="sentinel"?"Survey sentinel impact":"Predator strike") : kind==="arc"?"Survey machine discharge":kind === "spore" ? "Stalker spore" : "Exposure");
  }
  recordDamage(p: Player, amount: number, source: V3 | null, kind: DamageEvent["kind"], attackId = 0) {
    if (amount <= 0) return;
    const last = this.damageEvents.at(-1);
    if (kind === "environment" && last?.victim === p.id && last.kind === kind && this.time-last.time < 0.4) {
      last.amount += amount; return;
    }
    this.damageEvents.push({ id: ++this.damageId, victim: p.id, source: source ? { x: source.x, y: source.y, z: source.z } : null, amount, kind, attackId, time: this.time });
    if (this.damageEvents.length > 128) this.damageEvents.shift();
  }
  visible(from: V3, to: V3, id: string, target?: RAPIER.Collider) {
    const d = distance(from, to);
    if (d < 0.01) return true;
    const hit = this.world.castRay(
      new RAPIER.Ray(from, {
        x: (to.x - from.x) / d,
        y: (to.y - from.y) / d,
        z: (to.z - from.z) / d,
      }),
      d - 0.05,
      true,
      undefined,
      undefined,
      this.colliders.get(id),
      this.bodies.get(id),
    );
    return !hit || hit.collider.handle === target?.handle;
  }
  action(id: string, type: string, data?: unknown) {
    const p = this.players.get(id);
    if (!p || !p.connected) return;
    if(type==="loaded"){if((data as {seed?:number})?.seed===this.seed)p.loaded=true;return;}
    if (this.status === "ready") {
      if (type === "ready") {
        p.ready = !p.ready;
        return;
      }
      if (type === "start" && id === this.host) {
        const crew = [...this.players.values()].filter((q) => q.connected);
        if (!crew.every((q) => q.ready && q.loaded)) {
          this.announce("Every astronaut must be ready.");
          return;
        }
        this.practice = crew.length === 1;
        this.status = "running";
        this.announce(
          this.practice
            ? "Solo practice. Explore, prepare, survive."
            : "Last astronaut alive wins. Find supplies and shelter.",
        );
      }
      return;
    }
    if(this.status==='running'&&p.alive){
    if(type==='equip'){const slot=(data as {slot?:number})?.slot;if(slot===1||slot===2||slot===3)p.equipped=slot;return;}
    if(type==='rifle-mode'){if(p.equipped===1){p.rifleMode=p.rifleMode==='combat'?'sampling':'combat';p.sampleNotice=p.rifleMode==='sampling'?'Geological sampling · aim at exposed rock or sediment within 10 m.':'Combat mode';}return;}
    if(type==='discard-sample'){const unitId=(data as {unitId?:string})?.unitId,slot=p.samples.find(s=>s.unitId===unitId);if(slot){const mass=slot.massKg/slot.quantity;slot.quantity--;slot.massKg=Math.round((slot.massKg-mass)*100)/100;if(!slot.quantity)p.samples=p.samples.filter(s=>s!==slot);p.sampleNotice='Sample discarded.';}return;}
    }
    if(type==='pause'&&p.cabin){p.input={...p.input,x:0,z:0,jump:false,sprint:false};this.commands.delete(id);return;}
    if(this.status==='running'&&p.cabin){if(type==='interact'||type==='seat'){if(!cabinWalkingAllowed(this.time,this.extraction.timeline)){this.announce('Launch restraints locked until stable flight.');return;}if(p.cabin.seat!==null){const next=unseatPosition(p.cabin.seat,[...this.players.values()].filter(q=>q.id!==id&&q.cabin).map(q=>q.cabin!));if(next){p.cabin=next;this.announce('Restraints released. Walk within the cabin.');}}else{const seat=nearestFreeSeat(p.cabin,[...this.players.values()]);if(seat!==undefined){p.cabin=seatedCabin(seat);this.announce('Seat occupied. X releases restraints when flight permits.');}else this.announce('Approach an unoccupied seat and press X.');}}return;}
    if (this.status !== "running" || !p.alive) return;
    if(type==="medical" && p.medicine>0 && p.health<100 && this.time-p.medicalAt>=1){p.medicalAt=this.time;p.medicine--;p.health=Math.min(100,p.health+32);this.announce("Biological dressing applied.");return;}
    if(type==="cell" && p.cells>0 && (p.weaponEnergy<95||p.fuel<95||p.energy<95)){p.cells--;p.weaponEnergy=Math.min(100,p.weaponEnergy+65);p.fuel=Math.min(100,p.fuel+35);p.energy=Math.min(100,p.energy+65);this.announce("Energy cell applied. Rifle, jet and field charged.");return;}
    if(type==="thermal" && p.compounds>0 && p.thermalUntil<=this.time){p.compounds--;p.thermalUntil=this.time+60;this.announce("Thermal compound applied. Protection and suit heat active for one minute.");return;}
    if(type==="service" && p.minerals>=3 && (p.fuel<100||p.weaponEnergy<100)){p.minerals-=3;p.fuel=Math.min(100,p.fuel+65);p.weaponEnergy=Math.min(100,p.weaponEnergy+50);this.announce("Minerals converted into suit and rifle charge.");return;}
    if(type==='drop'){
      const kind=(data as {kind?:string})?.kind,keys={bio:'medicine',cell:'cells',thermal:'compounds',oxygen:'canisters',coolant:'canisters',mineral:'minerals'} as const;if(!kind||!Object.hasOwn(keys,kind)||this.objects.length>=38)return;if((kind==='oxygen'&&this.seed<0)||(kind==='coolant'&&this.seed>=0))return;const key=keys[kind as keyof typeof keys];if(p[key]<=0)return;const pos={x:p.x+Math.sin(p.yaw)*.9,y:p.y+.4,z:p.z+Math.cos(p.yaw)*.9};if(this.world.intersectionWithShape(pos,{x:0,y:0,z:0,w:1},new RAPIER.Ball(.2),undefined,undefined,this.colliders.get(id)))return;const oid=this.objects.length,material=kind==='mineral'?'basalt':kind==='bio'?'biomass':'circuit',radius=.06,density=MATERIALS[material].density,b=this.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(pos.x,pos.y,pos.z).setCcdEnabled(true));this.world.createCollider(RAPIER.ColliderDesc.ball(radius).setDensity(density),b);this.props.push(b);this.objects.push({...pos,id:oid,material,radius,mass:4/3*Math.PI*radius**3*density,vx:0,vy:0,vz:0,active:true});this.supplies.push({...pos,id:'dropped-'+oid,objectId:oid,kind:kind as Supply['kind'],takenBy:null,active:true,expires:this.time+90,pickupAfter:this.time+2});p[key]--;return;
    }
    if (type === "fire") {
      const sampling=p.rifleMode==='sampling';if(p.equipped!==1)return;
      const aim = data as { yaw?: number; pitch?: number } | undefined;
      if (!aim || !Number.isFinite(aim.yaw) || !Number.isFinite(aim.pitch) ||
          Math.abs(aim.yaw!) > 1e5 || Math.abs(aim.pitch!) > Math.PI * 0.48 ||
          this.time - p.firedAt < (sampling?SAMPLE_RULES.cadence:COMBAT.rifle.cadence) || p.weaponEnergy < (sampling?4:COMBAT.rifle.energy)) return;
      p.firedAt = this.time;
      if(!sampling)p.weaponEnergy -= COMBAT.rifle.energy;
      const cameraDirection = lookDirection(aim.yaw!, aim.pitch!);
      const eye = {x:p.x,y:p.y+.65,z:p.z},origin=muzzlePosition(eye,aim.yaw!,aim.pitch!);
      hearNoise(this, origin, COMBAT.stalker.gunHearing, id);
      this.world.propagateModifiedBodyPositionsToColliders();
      const cast=(from:V3,direction:V3,length:number)=>this.world.castRayAndGetNormal(new RAPIER.Ray(from,direction),sampling?Math.min(length,SAMPLE_RULES.range):length,true,undefined,undefined,this.colliders.get(id),this.bodies.get(id));
      const aimHit=cast(eye,cameraDirection,COMBAT.rifle.range),aimDistance=aimHit?.timeOfImpact??COMBAT.rifle.range;
      const targetPoint={x:eye.x+cameraDirection.x*aimDistance,y:eye.y+cameraDirection.y*aimDistance,z:eye.z+cameraDirection.z*aimDistance};
      const shot=aimFromMuzzle(origin,targetPoint),barrel=aimFromMuzzle(eye,origin),blocked=cast(eye,barrel.direction,barrel.length);
      const direction=shot.direction,hit=blocked??cast(origin,direction,shot.length+.01);
      const end=blocked?{x:eye.x+barrel.direction.x*blocked.timeOfImpact,y:eye.y+barrel.direction.y*blocked.timeOfImpact,z:eye.z+barrel.direction.z*blocked.timeOfImpact}:hit?{x:origin.x+direction.x*hit.timeOfImpact,y:origin.y+direction.y*hit.timeOfImpact,z:origin.z+direction.z*hit.timeOfImpact}:targetPoint;
      const pulse: Pulse = { id: this.pulseId++, shooter: id, from: origin,
        to: end,
        hit: !!hit, expires: this.time + 0.35, kind: hit ? "rock" : "miss" };
      this.pulses.push(pulse);
      if(sampling){pulse.kind='sample-reject';const identity=hit?physicsIdentity(this.world,hit.collider.handle,end,hit.featureId):null,object=hit?this.objects[this.props.findIndex(b=>b.collider(0).handle===hit.collider.handle)]:null,unitId=identity?.kind==='terrain'?exposedGeology(end.x,end.z,this.seed).unitId:identity?.identity??object?.unitId;
        if(!hit||!unitId||!GEOLOGY[unitId]||Math.hypot(end.x-eye.x,end.y-eye.y,end.z-eye.z)>SAMPLE_RULES.range+.01){p.sampleNotice='No exposed geological material in sampling range.';return;}
        const water=this.water.sample(end.x,end.z);if(water.depth>.05&&end.y<water.level){p.sampleNotice='Submerged material requires a dedicated fluid sampling tool.';return;}
        const patch=extractGeology(p,this.excavations,unitId,end,hit.normal,this.time,(caveLocation(p,this.seed)??caveLocation(end,this.seed))?.name??(object?'Loose geological fragment':'Surface exposure')+' · '+planetForSeed(this.seed).name);if(patch){pulse.kind='sample';pulse.normal={...hit.normal};pulse.unitId=unitId;}return;
      }
      if (!hit) return;
      const target = [...this.players.values()].find(q => q.id !== id && q.alive && this.colliders.get(q.id)?.handle === hit.collider.handle);
      if (target) {
        pulse.kind = "player";
        this.damage(target, COMBAT.rifle.damage, origin, "pulse");
        target.pushX = Math.max(-4, Math.min(4, target.pushX + direction.x * 2.2));
        target.pushZ = Math.max(-4, Math.min(4, target.pushZ + direction.z * 2.2));
        return;
      }
      const creature = this.stalkers.find(s => s.health > 0 && this.stalkerColliders[s.id].handle === hit.collider.handle);
      if (creature) {
        pulse.kind = "creature";
        pulse.weak=hurtStalker(this, creature, p, direction,pulse.to);
        return;
      }
      const index = this.props.findIndex(body => body.collider(0).handle === hit.collider.handle);
      if (index >= 0) {
        pulse.kind = "object";
        const body = this.props[index], impulse = Math.min(COMBAT.rifle.impulse, this.objects[index].mass * 2);
        body.applyImpulseAtPoint({ x: direction.x * impulse, y: direction.y * impulse, z: direction.z * impulse },
          pulse.to, true);
      }
      return;
    }
    if (type === "pause") {
      const queue = this.commands.get(id);
      p.ack = queue?.at(-1)?.seq ?? p.ack;
      this.commands.delete(id);
      p.input = {
        ...p.input,
        x: 0,
        z: 0,
        jump: false,
        dive: false,
        seq: p.ack,
      };
      return;
    }
    if (type === "recall") {
      this.anchors = this.anchors.filter((a) => a.owner !== id);
      return;
    }
    if(type==="coolant" && this.seed<0 && p.canisters>0 && p.temperature>37.1){p.canisters--;p.temperature=Math.max(36.8,p.temperature-1.2);this.announce("Coolant applied. Chassis temperature falling.");return;}
    if (type === "oxygen") {
      if (p.canisters > 0 && p.oxygen < 99) {
        p.canisters--;
        p.oxygen = Math.min(100, p.oxygen + 65);
        this.announce("Oxygen replenished.");
      }
      return;
    }
    if (type === "shove") {
      if (this.time - p.shoveAt < 1.25) return;
      p.shoveAt = this.time;
      const forward = { x: Math.sin(p.yaw), z: Math.cos(p.yaw) };
      const inReach = (q: V3) => {
        const d = distance(p, q);
        return (
          d < 2.8 &&
          d > 0.1 &&
          ((q.x - p.x) * forward.x + (q.z - p.z) * forward.z) / d > 0.55
        );
      };
      const target = [...this.players.values()].find(
        (q) =>
          q.id !== id &&
          q.alive &&
          inReach(q) &&
          this.visible(p, q, id, this.colliders.get(q.id)),
      );
      if (target) {
        target.pushX = Math.max(
          -3.5,
          Math.min(3.5, target.pushX + forward.x * 3),
        );
        target.pushZ = Math.max(
          -3.5,
          Math.min(3.5, target.pushZ + forward.z * 3),
        );
        return;
      }
      const object = this.objects.find(
        (o) =>
          inReach(o) &&
          this.visible(
            p,
            o,
            id,
            this.world.getCollider(this.props[o.id].collider(0).handle),
          ),
      );
      if (object)
        this.props[object.id].applyImpulse(
          {
            x: forward.x * Math.min(900, object.mass * 1.8),
            y: 50,
            z: forward.z * Math.min(900, object.mass * 1.8),
          },
          true,
        );
      return;
    }
    if (type === "anchor") {
      if (p.energy < 20) return;
      const d = data as (V3 & { sign?: number }) | undefined;
      if (
        !d ||
        ![d.x, d.y, d.z].every(Number.isFinite) ||
        distance(p, d) > 24 ||
        Math.abs(d.x) > 157 ||
        Math.abs(d.z) > 157
      )
        return;
      if (!this.visible({ x: p.x, y: p.y + 0.65, z: p.z }, d, id)) return;
      for (let f = 0.1; f < 1; f += 0.08)
        if (
          p.y + (d.y - p.y) * f <
          ground(p.x + (d.x - p.x) * f, p.z + (d.z - p.z) * f, this.seed) + 0.1
        )
          return;
      p.energy -= 20;
      this.anchors = this.anchors.filter((a) => a.owner !== id);
      this.anchors.push({
        x: d.x,
        y: d.y,
        z: d.z,
        owner: id,
        sign: d.sign === -1 ? -1 : 1,
        life: 18,
      });
      return;
    }
    if (type === "polarity") {
      const a = this.anchors.find((a) => a.owner === id);
      if (a) a.sign *= -1;
      return;
    }
    if(type==='carry'){const held=this.objects.find(o=>o.carriedBy===id);if(held){held.carriedBy=null;this.props[held.id].setBodyType(RAPIER.RigidBodyType.Dynamic,true);this.announce('Portable sample released.');return;}const item=this.objects.filter(o=>o.active!==false&&!o.carriedBy&&objectInteraction(o)==='portable resource'&&!this.supplies.some(s=>s.objectId===o.id&&s.active!==false)&&distance(p,o)<2.7&&this.visible(p,o,id,this.props[o.id].collider(0))).sort((a,b)=>distance(p,a)-distance(p,b))[0];if(item){item.carriedBy=id;this.props[item.id].setBodyType(RAPIER.RigidBodyType.KinematicPositionBased,true);this.announce('Portable sample carried. G releases it.');}else this.announce('No portable loose sample in reach. Heavy objects can be pushed.');return;}
    if (type === "interact") {
      const caveStation=caveStationAt(p,this.seed);if(caveStation){const u=GEOLOGY[caveStation.unitId];this.announce(caveData(this.seed).name+' · Survey '+(caveStation.id+1)+': '+u.name+' ['+u.id+']. '+u.minerals+'. Modeled reference assemblage. Green markers lead to the surface; V samples exposed geology.');return;}
      if(canBoard(p,this.extraction)&&this.visible({x:p.x,y:p.y+.65,z:p.z},{x:this.extraction.site!.x,y:this.extraction.site!.y+1.6,z:this.extraction.site!.z-4.1},id)){p.extractedAt=this.time;p.cabin={x:p.x-this.extraction.site!.x,y:.97,z:p.z-this.extraction.site!.z,seat:null};p.alive=false;p.shelter=null;p.deathCause="Extracted aboard rescue ship";this.colliders.get(id)!.setEnabled(false);this.commands.delete(id);this.extraction.boarded.push(id);this.anchors=this.anchors.filter(a=>a.owner!==id);this.announce("Astronaut "+(p.color+1)+" aboard. Approach a seat and press X. Launch restraints engage automatically.");return;}
      const door=interactionDoor(p,this.seed);
      if(door){const changed=commandDoor(door.id,this.doors,this.seed,d=>this.doorOccupied(d));this.announce(changed?'Compartment door '+(this.doors.find(d=>d.id===door.id)!.target?'opening.':'closing.'):'Airlock cycling or doorway occupied. Wait for the other door to close, then press X again.');return;}
      const room=facility(this.seed).rooms.find(r=>Math.hypot(p.x-r.x,p.z-r.z)<2.5&&Math.abs(p.y-facility(this.seed).y-1)<1.5);if(room){this.announce(room.record);return;}
      const supply = this.supplies.find(
        (s) =>
          !s.takenBy && s.active!==false &&
          distance(p, s) < 2.7 &&
          this.visible(
            p,
            s,
            id,
            s.objectId !== undefined
              ? this.props[s.objectId].collider(0)
              : undefined,
          ),
      );
      if(supply && this.takeSupply(p,supply))return;
      const shelter = shelterAt(p, this.seed);
      if (
        shelter &&
        ![...this.players.values()].some(
          (q) => q.id !== id && q.alive && q.shelter === shelter.id,
        )
      ) {
        p.shelter = p.shelter ? null : shelter.id;
        const seal=this.doors.find(d=>d.id==='shelter-'+shelter.id);if(seal)seal.target=!p.shelter;
        this.announce(
          p.shelter
            ? "Shelter sealed. Movement breaks the seal."
            : "Shelter unsealed.",
        );
      }
    }
  }
  doorOccupied(d:DoorRecipe){return [...this.players.values()].some(p=>p.alive&&Math.abs(p.x-d.x)<d.sx+.48&&Math.abs(p.z-d.z)<d.sz+.48&&Math.abs(p.y-d.y)<d.sy+1)||this.stalkers.some(s=>s.health>0&&Math.abs(s.x-d.x)<d.sx+s.radius&&Math.abs(s.z-d.z)<d.sz+s.radius&&Math.abs(s.y-d.y)<d.sy+s.radius);}
  updateDoors(dt:number){for(const recipe of doorRecipes(this.seed)){const d=this.doors.find(d=>d.id===recipe.id)!;if(!d.target&&d.open>0&&this.doorOccupied(recipe))d.target=true;const before=d.open;d.open=Math.max(0,Math.min(1,d.open+(d.target?1:-1)*dt*1.25));const body=this.doorBodies.get(d.id)!;if(before!==d.open){const size=doorSize(recipe,d);body.collider(0).setShape(new RAPIER.Cuboid(size.x,size.y,size.z));}body.collider(0).setEnabled(d.open<.995);body.setNextKinematicTranslation(doorPosition(recipe,d));}}
  takeSupply(p:Player,supply:Supply){if(supply.takenBy||supply.active===false)return false;const id=p.id;
        if ((supply.kind === "oxygen"||supply.kind==="coolant") && p.canisters >= 2) return false;
        if (supply.kind === "insulation" && p.insulated) return false;
        if(supply.kind==="bio" && p.medicine>=2)return false;
        if(supply.kind==="mineral" && p.minerals>=9)return false;
        if(supply.kind==="cell" && p.cells>=2)return false;
        if(supply.kind==="thermal" && p.compounds>=2)return false;
        supply.takenBy = id;
        if (supply.kind === "oxygen"||supply.kind==="coolant") p.canisters++;
        if (supply.kind === "insulation") p.insulated = true;
        if(supply.kind==="bio")p.medicine++;
        if(supply.kind==="mineral")p.minerals++;
        if(supply.kind==="thermal")p.compounds++;
        if(supply.kind==="cell")p.cells++;
        if(supply.objectId!==undefined && supply.objectId>=14)this.deactivateObject(supply.objectId);
        this.announce(
          supply.kind==="coolant"?"Coolant secured. Press O to cool the survey chassis.":supply.kind === "oxygen"
            ? "Oxygen secured. 2 equips it; click to replenish."
            : supply.kind === "insulation"
              ? "Thermal liner fitted."
              : supply.kind==="bio"?"Medical supply secured. Press H to heal.":supply.kind==="mineral"?"Mineral fragment secured. Three recharge the field kit.":supply.kind==="thermal"?"Thermal compound secured. Press T to activate.":"Energy cell secured. Press B to recharge.",
        );
        return true;

  }
  updateExtraction(){const e=this.extraction,RESCUE=e.timeline;
    if(this.time>=RESCUE.announce&&!e.site){const point=landingCandidates(this.seed,this.water).find(p=>!this.world.intersectionWithShape({x:p.x,y:p.y+1.5,z:p.z},{x:0,y:0,z:0,w:1},new RAPIER.Cuboid(3.3,1.4,4.2),RAPIER.QueryFilterFlags.EXCLUDE_KINEMATIC));if(point){e.site={x:point.x,y:point.y,z:point.z};this.announce('Rescue inbound. Landing beacon '+Math.round(point.x)+', '+Math.round(point.z)+'. Reach the ramp before departure.');for(const part of shipParts()){const b=this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(point.x+part.x,190+part.y,point.z+part.z));this.world.createCollider(RAPIER.ColliderDesc.cuboid(part.sx,part.sy,part.sz).setFriction(.8),b);this.shipBodies.push(b);}}}
    if(!e.site)return;if(e.phase==='boarding'&&this.time>=RESCUE.close)for(const p of this.players.values())if(p.alive&&Math.abs(p.x-e.site.x)<2.1&&p.z>e.site.z-4.5&&p.z<e.site.z-3.2&&Math.abs(p.y-e.site.y)<2){p.z=e.site.z-3.1;this.bodies.get(p.id)!.setTranslation(p,true);this.action(p.id,'interact');}for(const p of this.players.values())if(p.cabin){if(!cabinWalkingAllowed(this.time,RESCUE)&&p.cabin.seat===null){const seat=nearestFreeSeat(p.cabin,[...this.players.values()],Infinity);if(seat!==undefined)p.cabin=seatedCabin(seat);}Object.assign(p,cabinWorld(p.cabin,this.time,e.site,RESCUE));this.bodies.get(p.id)!.setTranslation(p,true);}e.phase=this.time<RESCUE.approach?'announced':this.time<RESCUE.land?'approaching':this.time<RESCUE.close?'boarding':this.time<RESCUE.end?'departing':'departed';Object.assign(e,shipAt(this.time,e.site,RESCUE));const parts=shipParts();for(let i=0;i<this.shipBodies.length;i++){const part=parts[i],local=part.role==='door'?hatchPose(this.time,RESCUE):part,offset=shipOffset(local,this.time,RESCUE);const body=this.shipBodies[i],pose={x:e.x+offset.x,y:e.y+offset.y,z:e.z+offset.z},rotation=shipRotation(this.time,RESCUE,local.rx??0),parked=e.phase==='boarding',type=parked?RAPIER.RigidBodyType.Fixed:RAPIER.RigidBodyType.KinematicPositionBased,changed=body.bodyType()!==type;if(changed)body.setBodyType(type,true);if(parked){if(changed){body.setTranslation(pose,true);body.setRotation(rotation,true);}}else {body.setNextKinematicTranslation(pose);body.setNextKinematicRotation(rotation);}this.shipBodies[i].collider(0).setEnabled(this.time>=RESCUE.approach&&(part.role!=='foundation'||e.phase==='boarding'));}
    if(this.time>=RESCUE.close)for(const p of this.players.values())if(p.alive)this.eliminate(p,'Missed extraction');
  }
  eliminate(p: Player, cause: string) {
    if (!p.alive) return;
    p.alive = false;
    p.health = 0;
    p.diedAt = this.time;
    p.deathCause = cause;
    p.shelter = null;
    p.vx = p.vy = p.vz = 0;
    p.thrusting = false;
    p.input = { ...p.input, x: 0, z: 0, jump: false, dive: false };
    this.commands.delete(p.id);
    this.colliders.get(p.id)!.setEnabled(false);
    this.anchors = this.anchors.filter((a) => a.owner !== p.id);
    this.announce("Astronaut " + (p.color + 1) + " lost · " + cause + ".");
  }
  reset(seed = this.seed) {
    return new Expedition(this.code, seed,this.mode);
  }
  finish() {
    const RESCUE=this.extraction.timeline,HARD_LIMIT=RESCUE.end;
    if(this.extraction.site && this.time>=RESCUE.close){if(this.time<RESCUE.end)return;const saved=[...this.players.values()].filter(p=>p.extractedAt!==null);const best=Math.max(...saved.map(p=>p.health));this.winnerIds=saved.filter(p=>p.health===best).map(p=>p.id);this.result=saved.length?"Rescue departed. Extracted suits rank by remaining health; equal health shares first.":"Rescue departed without survivors.";if(!saved.length){const crew=[...this.players.values()].filter(p=>p.participant),bestTime=Math.max(...crew.map(p=>p.diedAt??0));this.winnerIds=crew.filter(p=>p.diedAt===bestTime).map(p=>p.id);}this.status="finished";return;}
    if(this.extraction.boarded.length&&this.time<RESCUE.end)return;
    const crew = [...this.players.values()].filter((p) => p.participant),
      alive = crew.filter((p) => p.alive);
    if (this.practice && alive.length && this.time < HARD_LIMIT) return;
    if (!this.practice && alive.length > 1 && this.time < HARD_LIMIT) return;
    if (!crew.length) return;
    if (this.time >= HARD_LIMIT && alive.length) {
      this.winnerIds=alive.map(p=>p.id);this.result="Survey window closed without validated rescue. Remaining suits are stranded."+(alive.length>1?" Shared survival.":"");this.status="finished";return;
    } else
      this.result = alive.length
        ? "Last astronaut alive."
        : "No suit survived the final event.";
    const best = Math.max(...crew.map((p) => p.diedAt ?? this.time));
    this.winnerIds = crew
      .filter((p) => (p.diedAt ?? this.time) === best)
      .map((p) => p.id);
    if (alive.length === 1 && this.time < HARD_LIMIT)
      this.winnerIds = [alive[0].id];
    if (this.winnerIds.length > 1)
      this.result += " Same-tick eliminations share first place.";
    this.status = "finished";
  }
  step(dt = STEP) {
    this.lastActive = Date.now();
    if (this.status !== "running") return;
    const started = performance.now(),
      previous = this.time;
    this.tick++;
    this.time += dt;
    this.waterElapsed += dt;
    if(this.tsunami){const event=this.tsunami;if(previous<event.warningAt&&this.time>=event.warningAt)this.announce("Offshore seismic slip detected. Dangerous inundation may reach low ground within seconds. Move inland and climb.");if(!event.triggered&&this.time>=event.triggerAt){event.sourceVolume=this.water.disturbSurface(event.x,event.z,event.amplitude,event.radius);event.triggered=true;this.announce("Tsunami released offshore. Currents and inundation are propagating. Seek high ground.");}}
    for (const [at, message] of [
      [150, this.seed<0?"Ash winds are strengthening. Recover thermal supplies.":"The ebb is ending. Recover supplies and find a high route."],
      [285, "Storm approaching. Exposed ridges are becoming dangerous."],
      [360, this.seed<0?"Radiant front in one minute. Find shielding or thermal supplies.":"Cold front in one minute. Find thermal protection or shelter."],
      [420, this.seed<0?"Radiant heat load is rising. Move away from melt fractures.":"The cold front has arrived. Use shelter and thermal supplies."],
      [490, "Survey relay weakening. Extraction in fifty seconds."],
      [510, "Survey extraction in thirty seconds. Outlast the remaining threats."],
    ] as const)
      if (previous < at*this.extraction.timeline.duration/540 && this.time >= at*this.extraction.timeline.duration/540) this.announce(message);
    if (this.waterElapsed >= 0.05 - 1e-9) {
      this.water.advance(this.waterElapsed, environment(this.time,this.seed,this.extraction.timeline.duration).sea);
      this.waterElapsed = 0;
    }
    this.fields.update(this.time,this.water,this.extraction.timeline.duration);
    this.updateDoors(dt);
    this.lava?.advance(dt);
    this.updateExtraction();
    this.anchors = this.anchors.filter((a) => (a.life -= dt) > 0);
    this.pulses = this.pulses.filter(p => p.expires > this.time);
    for(const supply of this.supplies)if(supply.expires && supply.active!==false && supply.expires<this.time && supply.objectId!==undefined)this.deactivateObject(supply.objectId);
    this.directEncounters();
    replenishMedical(this);
    this.damageEvents = this.damageEvents.filter(e => this.time - e.time < 2);
    const aiStarted = performance.now();
    updateCreatures(this, dt);
    this.aiMs = performance.now() - aiStarted;
    for (const p of this.players.values()) {
      if(p.cabin){const queue=this.commands.get(p.id);if(queue?.length)p.input=queue.shift()!;p.cabin=moveCabin(p.cabin,p.input,this.time,this.extraction.timeline,dt);p.ack=p.input.seq;p.yaw=p.input.yaw;if(this.extraction.site)Object.assign(p,cabinWorld(p.cabin,this.time,this.extraction.site,this.extraction.timeline));continue;}
      if (!p.alive) continue;
      if (
        !p.connected &&
        p.disconnectedAt !== null &&
        this.time - p.disconnectedAt >= 20
      ) {
        this.eliminate(p, "Signal lost");
        continue;
      }
      const queue = this.commands.get(p.id);
      if (queue?.length) p.input = queue.shift()!;
      const w = this.water.surface(p.x, p.z, this.time);
      const falling = p.vy;
      moveCharacter(
        p,
        p.input,
        this.bodies.get(p.id)!,
        this.colliders.get(p.id)!,
        this.controllers.get(p.id)!,
        w,
        this.anchors,
        dt,
        this.seed,
        this.time,
        this.extraction.timeline.duration,
      );
      const refuge=protectedRoom(p,this.seed,this.doors),legacy=shelterAt(p,this.seed);p.shelter=refuge?.id??(legacy&&(this.doors.find(d=>d.id==='shelter-'+legacy.id)?.open??1)<.03?legacy.id:null);
      const melt=this.lava?.sample(p.x,p.z);if(melt&&melt.depth>.008&&p.y-.95<melt.level+.12&&!p.shelter)p.health=Math.max(0,p.health-(18+22*(1-melt.solid))*dt);
      const healthBefore = p.health;
      const cause = exposure(p, w, this.time, dt, this.seed,this.extraction.timeline.duration);
      if (p.grounded && falling < -14)
        p.health = Math.max(0, p.health - (Math.abs(falling) - 14) * 3);
      if (healthBefore > p.health) this.recordDamage(p, healthBefore - p.health, null, "environment");
      p.energy = Math.min(100, p.energy + 2.5 * dt);
      p.weaponEnergy = Math.min(100, p.weaponEnergy + COMBAT.rifle.recharge * dt);
      if (p.health <= 0)
        this.eliminate(p, cause || (falling < -14 ? "Impact" : "Suit failure"));
      else if (p.y < -40) this.eliminate(p, "Lost below the shelf");
    }
    for (let i = 0; i < this.props.length; i++) {
      if(this.objects[i].active===false)continue;
      const b = this.props[i],
        o = this.objects[i],
        pos = b.translation(),
        vel = b.linvel(),
        w = this.water.surface(pos.x, pos.z, this.time),
        fraction =
          o.material === "crate"
            ? Math.max(
                0,
                Math.min(
                  1,
                  (w.level - (pos.y - o.radius * 0.65)) / (o.radius * 1.3),
                ),
              )
            : submergedSphereFraction(o.radius, w.level - (pos.y - o.radius)),
        volume =
          o.material === "crate"
            ? 8 * 0.65 * o.radius ** 3
            : (4 / 3) * Math.PI * o.radius ** 3;
      if(o.carriedBy){const owner=this.players.get(o.carriedBy);if(owner?.alive&&owner.connected){const from={x:owner.x,y:owner.y+.35,z:owner.z},dir={x:Math.sin(owner.yaw),y:0,z:Math.cos(owner.yaw)},hit=this.world.castShape(from,{x:0,y:0,z:0,w:1},dir,new RAPIER.Ball(o.radius),0,1.1,true,undefined,undefined,b.collider(0),b,c=>c.handle!==this.colliders.get(owner.id)?.handle),length=Math.max(.2,Math.min(1.1,(hit?.time_of_impact??1.1)-.02));b.setNextKinematicTranslation({x:from.x+dir.x*length,y:from.y,z:from.z+dir.z*length});continue;}o.carriedBy=null;b.setBodyType(RAPIER.RigidBodyType.Dynamic,true);}
      const fluid=brineProperties(14,this.fields.sample(pos.x,pos.z).salinity,environment(this.time,this.seed).pressure);
      b.resetForces(true);
      if (w.depth > 0.02 && fraction > 0)
        b.addForce(
          {
            x: (w.u - vel.x) * o.mass * fraction * Math.min(1.6,.8*fluid.viscosity/.001),
            y: buoyancy(volume, fraction, planetForSeed(this.seed).gravity,fluid.density) - (vel.y-w.vertical) * o.mass * fraction * 0.8,
            z: (w.v - vel.z) * o.mass * fraction * 0.8,
          },
          true,
        );
      for (const a of this.anchors) {
        const acc = anchorAcceleration(pos, a, a.sign, o.mass);
        b.addForce(
          { x: acc.x * o.mass, y: acc.y * o.mass, z: acc.z * o.mass },
          true,
        );
      }
    }
    this.world.timestep = dt;
    this.world.step();
    for (const s of this.stalkers) if (s.health) Object.assign(s, this.stalkerBodies[s.id].translation());
    for (const p of this.players.values())
      if(!p.cabin)copyPosition(p, this.bodies.get(p.id)!);
    for (let i = 0; i < this.props.length; i++) {
      if(this.objects[i].active===false)continue;
      const b = this.props[i],
        o = this.objects[i];
      Object.assign(o, b.translation());
      o.rotation={...b.rotation()};
      const v = b.linvel();
      o.vx = v.x;
      o.vy = v.y;
      o.vz = v.z;
      if (Math.hypot(v.x,v.y,v.z)>4 && this.time-(this.impactNoise.get(o.id)??-10)>1.5) {
        this.impactNoise.set(o.id,this.time); hearNoise(this,o,16);
      }
      if (o.y < -40 || Math.abs(o.x) > 180 || Math.abs(o.z) > 180) {
        if(i>=14){this.deactivateObject(i);continue;}
        b.setTranslation(
          { x: 20 + i * 2, y: ground(20 + i * 2, 0, this.seed) + 3, z: 0 },
          true,
        );
        b.setLinvel({ x: 0, y: 0, z: 0 }, true);
      }
    }
    for (const s of this.supplies)
      if (s.objectId !== undefined) {
        const o = this.objects[s.objectId];
        s.x = o.x;
        s.y = s.objectId>=14?o.y:o.y + o.radius * 0.65 + 0.35;
        s.z = o.z;
      }
    for(const p of this.players.values())if(p.alive)for(const supply of this.supplies){if(supply.takenBy||supply.active===false||(supply.pickupAfter??0)>this.time||supply.kind==="insulation"||(supply.kind==="mineral"&&supply.objectId===undefined)||supply.objectId===3||distance(p,supply)>1.55)continue;if(supply.objectId!==undefined&&objectInteraction(this.objects[supply.objectId])!=='portable resource')continue;if(this.visible({x:p.x,y:p.y+.2,z:p.z},supply,p.id,supply.objectId!==undefined?this.props[supply.objectId].collider(0):undefined))this.takeSupply(p,supply);}
    this.finish();
    this.physicsMs = performance.now() - started;
  }
  snapshot(): Snapshot {
    const participants = [...this.players.values()].filter(
        (p) => p.participant,
      ),
      ordered = participants
        .slice()
        .sort(
          (a, b) =>
            Number(b.extractedAt!==null)-Number(a.extractedAt!==null)||(a.extractedAt!==null&&b.extractedAt!==null?b.health-a.health:0)||Number(b.alive) - Number(a.alive) ||
            (b.diedAt ?? this.time) - (a.diedAt ?? this.time) ||
            a.color - b.color,
        );
    return {
      excavations:[...this.excavations.values()].sort((a,b)=>b.updatedAt-a.updatedAt).slice(0,SAMPLE_RULES.visiblePatches).map(p=>({...p,position:{...p.position},normal:{...p.normal}})),
      lava:this.lava?.snapshot()??null,
      doors:this.doors.map(d=>({...d})),
      extraction:{...this.extraction,site:this.extraction.site?{...this.extraction.site}:null,boarded:[...this.extraction.boarded]},
      fields:this.fields.cells.map(c=>({...c})),fieldsVersion:this.fields.updates,
      code: this.code,
      planet: planetIdForSeed(this.seed),
      tsunami:this.tsunami?{...this.tsunami}:null,
      seed: this.seed,
      time: this.time,
      status: this.status,
      players: [...this.players.values()].map((p) => ({
        ...p,
        samples:p.samples.map(s=>({...s,origins:[...s.origins]})),
        cabin:p.cabin?{...p.cabin}:null,
        input: { ...p.input },
      })),
      supplies: this.supplies.map((s) => ({ ...s })),
      winnerIds: [...this.winnerIds],
      practice: this.practice,
      result: this.result,
      standings: ordered.map((p) => ({
        id: p.id,
        rank:
          1 +
          ordered.filter((q) =>
            q.extractedAt!==null||p.extractedAt!==null ? q.extractedAt!==null&&(p.extractedAt===null||q.health>p.health) : q.alive !== p.alive
              ? q.alive
              : (q.diedAt ?? this.time) > (p.diedAt ?? this.time),
          ).length,
        time: p.extractedAt!==null?this.extraction.timeline.end:p.diedAt ?? this.time,
        cause: p.deathCause || "Alive",
        winner: this.winnerIds.includes(p.id),
      })),
      anchors: this.anchors.map((a) => ({ ...a })),
      objects: this.objects.map((o) => ({ ...o })),
      stalkers: this.stalkers.map((s) => ({ ...s, home: { ...s.home }, lastKnown: s.lastKnown ? { ...s.lastKnown } : null, path: s.path.map(v => ({ ...v })) })),
      projectiles: this.projectiles.map(p => ({ ...p })),
      damageEvents: this.damageEvents.map(e => ({ ...e, source: e.source ? { ...e.source } : null })),
      aiMs: this.aiMs,
      pulses: this.pulses.map(p => ({ ...p, from: { ...p.from }, to: { ...p.to } })),
      water: this.water.levels(),
      currentsX: Array.from(
        this.water.qx,
        (_, k) =>
          Math.round(
            (this.water.h[k] > 0.05 ? this.water.qx[k] / this.water.h[k] : 0) *
              100,
          ) / 100,
      ),
      currents: Array.from(
        this.water.qz,
        (_, k) =>
          Math.round(
            (this.water.h[k] > 0.05 ? this.water.qz[k] / this.water.h[k] : 0) *
              100,
          ) / 100,
      ),
      host: this.host,
      volume: this.water.volume(),
      tick: this.tick,
      notice: this.notice,
      noticeId: this.noticeId,
      physicsMs: this.physicsMs,networkMs:this.networkMs,networkBytes:this.networkBytes,
      colliderCount: this.world.colliders.len(),
    };
  }
  dispose() {
    this.world.free();
  }
}
