import {moveCabin,cabinWorld} from './cabin';
import {shipParts,RESCUE,flightState,shipOffset,shipRotation} from "./extraction";
import {doorRecipes,doorPosition,doorSize,initialDoors} from './facility';
import { waterAt } from "./water-contact";
import RAPIER from "@dimforge/rapier3d-compat";
import { Input, Player, Snapshot, V3 } from "./model";
import {
  STEP,
  configureController,
  moveCharacter,
  copyPosition,
} from "./locomotion";
export { initPhysics as initPredictionPhysics } from "./world";
import { createStaticWorld,physicsIdentity } from "./world";
import { correctionOffset, diagnostics } from "./presentation";
export class Prediction {
  world: RAPIER.World;
  body: RAPIER.RigidBody;
  collider: RAPIER.Collider;
  controller: RAPIER.KinematicCharacterController;
  player: Player;
  shipBodies:RAPIER.RigidBody[]=[];
  doorBodies=new Map<string,RAPIER.RigidBody>();
  pending: Input[] = [];
  previous: Player;
  offset = { x: 0, y: 0, z: 0 };
  lastRendered: V3 | null = null;
  alpha = 1;
  props = new Map<number, RAPIER.RigidBody>();
  stalkers = new Map<number, { body: RAPIER.RigidBody; collider: RAPIER.Collider }>();
  players = new Map<
    string,
    { body: RAPIER.RigidBody; collider: RAPIER.Collider }
  >();
  constructor(
    public seed: number,
    p: Player,
  ) {
    this.world = createStaticWorld(seed);
    const doors=initialDoors(seed);for(const d of doorRecipes(seed)){const p=doorPosition(d,doors.find(s=>s.id===d.id)!);const b=this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(p.x,p.y,p.z));this.world.createCollider(RAPIER.ColliderDesc.cuboid(d.sx,doorSize(d,doors.find(s=>s.id===d.id)!).y,d.sz),b);this.doorBodies.set(d.id,b);}
    this.player = { ...p, input: { ...p.input } };
    this.previous = { ...this.player };
    this.body = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(
        p.x,
        p.y,
        p.z,
      ),
    );
    this.collider = this.world.createCollider(
      RAPIER.ColliderDesc.capsule(0.55, 0.4),
      this.body,
    );
    this.controller = configureController(this.world);
    this.world.step();
  }
  sampleWater(state: Snapshot) {
    return waterAt(state, this.player.x, this.player.z);
  }
  identifyCollider(handle:number,point?:{x:number;y?:number;z:number},featureId?:number){return physicsIdentity(this.world,handle,point,featureId);}
  advance(input: Input, state: Snapshot, replay = false) {
    this.previous = { ...this.player };
    if(this.player.cabin&&state.extraction.site){this.player.cabin=moveCabin(this.player.cabin,input,state.time,state.extraction.timeline,STEP);Object.assign(this.player,cabinWorld(this.player.cabin,state.time,state.extraction.site,state.extraction.timeline));this.player.ack=input.seq;if(!replay)this.pending.push(input);return;}
    moveCharacter(
      this.player,
      input,
      this.body,
      this.collider,
      this.controller,
      this.sampleWater(state),
      state.anchors,
      STEP,
      state.seed,
      state.time,
      state.extraction.timeline.duration,
    );
    this.world.step();
    copyPosition(this.player, this.body);
    if (!replay) {
      this.pending.push(input);
      if (this.pending.length > 120) this.pending.shift();
    }
  }
  receive(p: Player, state: Snapshot) {
    for(const d of doorRecipes(this.seed)){const s=state.doors.find(s=>s.id===d.id);if(s){const body=this.doorBodies.get(d.id)!,size=doorSize(d,s);body.setTranslation(doorPosition(d,s),true);body.collider(0).setShape(new RAPIER.Cuboid(size.x,size.y,size.z));body.collider(0).setEnabled(s.open<.995);}}
    const ship=state.extraction;if(ship?.site){const parts=shipParts();if(!this.shipBodies.length)for(const part of parts){const b=this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased());this.world.createCollider(RAPIER.ColliderDesc.cuboid(part.sx,part.sy,part.sz),b);this.shipBodies.push(b);}for(let i=0;i<parts.length;i++){const part=parts[i],b=this.shipBodies[i];const offset=shipOffset({x:part.x,y:part.y+(part.role==='door'?3*flightState(state.time,ship.timeline).hatch:0),z:part.z},state.time,ship.timeline);const parked=ship.phase==="boarding",type=parked?RAPIER.RigidBodyType.Fixed:RAPIER.RigidBodyType.KinematicPositionBased,changed=b.bodyType()!==type;if(changed)b.setBodyType(type,true);if(!parked||changed){b.setTranslation({x:ship.x+offset.x,y:ship.y+offset.y,z:ship.z+offset.z},true);b.setRotation(shipRotation(state.time,ship.timeline,part.rx??0),true);}b.collider(0).setEnabled(state.time>=ship.timeline.approach&&(part.role!=="foundation"||ship.phase==="boarding"));}}
    for (const s of state.stalkers) {
      let entry = this.stalkers.get(s.id);
      if (!entry) {
        const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(s.x, s.y, s.z));
        entry = { body, collider: this.world.createCollider(RAPIER.ColliderDesc.ball(s.radius), body) };
        this.stalkers.set(s.id, entry);
      }
      entry.body.setTranslation(s, true);
      entry.collider.setEnabled(s.health > 0);
    }
    for (const o of state.objects) {
      let b = this.props.get(o.id);
      if (!b) {
        b = this.world.createRigidBody(
          RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(
            o.x,
            o.y,
            o.z,
          ),
        );
        this.world.createCollider(
          o.material === "crate"
            ? RAPIER.ColliderDesc.cuboid(o.radius, o.radius * 0.65, o.radius)
            : RAPIER.ColliderDesc.ball(o.radius),
          b,
        );
        this.props.set(o.id, b);
      }
      b.setTranslation(o, true);
      b.setEnabled(o.active!==false);
    }
    for (const q of state.players) {
      if (q.id === this.player.id) continue;
      let other = this.players.get(q.id);
      if (!other) {
        const body = this.world.createRigidBody(
          RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(
            q.x,
            q.y,
            q.z,
          ),
        );
        other = {
          body,
          collider: this.world.createCollider(
            RAPIER.ColliderDesc.capsule(0.55, 0.4),
            body,
          ),
        };
        this.players.set(q.id, other);
      }
      other.collider.setEnabled(q.alive);
      other.body.setTranslation(q, true);
    }
    const simulatedBefore = this.player;
    const before = this.lastRendered ?? {
      x: this.player.x + this.offset.x,
      y: this.player.y + this.offset.y,
      z: this.player.z + this.offset.z,
    };
    this.player = { ...p, input: { ...p.input } };
    this.body.setTranslation(p, true);
    this.body.setNextKinematicTranslation(p);
    this.world.propagateModifiedBodyPositionsToColliders();
    this.pending = this.pending.filter((i) => i.seq > p.ack);
    if (state.status === "running" && (p.alive||p.cabin))
      for (const input of this.pending) this.advance(input, state, true);
    else this.pending = [];
    if (!this.pending.length) this.previous = { ...this.player };
    const error = Math.hypot(
      simulatedBefore.x - this.player.x,
      simulatedBefore.y - this.player.y,
      simulatedBefore.z - this.player.z,
    );
    if (error > 0.08 && error < 6) {
      diagnostics.corrections++;
      diagnostics.correctionMeters = error;
    }
    const base = {
      x: this.previous.x + (this.player.x - this.previous.x) * this.alpha,
      y: this.previous.y + (this.player.y - this.previous.y) * this.alpha,
      z: this.previous.z + (this.player.z - this.previous.z) * this.alpha,
    };
    this.offset = correctionOffset(before, base);
    if (error > 6) {
      this.offset = { x: 0, y: 0, z: 0 };
      this.previous = { ...this.player };
    }
  }
  render(alpha: number, dt: number) {
    this.alpha = alpha;
    const f = Math.exp(-dt * 16);
    this.offset.x *= f;
    this.offset.y *= f;
    this.offset.z *= f;
    const result = {
      ...this.player,
      x:
        this.previous.x +
        (this.player.x - this.previous.x) * alpha +
        this.offset.x,
      y:
        this.previous.y +
        (this.player.y - this.previous.y) * alpha +
        this.offset.y,
      z:
        this.previous.z +
        (this.player.z - this.previous.z) * alpha +
        this.offset.z,
    };
    this.lastRendered = result;
    return result;
  }
  dispose() {
    this.world.free();
  }
}
