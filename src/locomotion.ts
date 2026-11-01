import type RAPIER from "@dimforge/rapier3d-compat";
import {
  Anchor,
  GRAVITY,
  Input,
  Player,
  V3,
  anchorAcceleration,
} from "./model";
import { planetForSeed } from "./planets";
import { weatherAt } from "./climate";
export const STEP = 1 / 60;
export type WaterContact = {
  depth: number;
  level: number;
  u: number;
  v: number;
};
export function configureController(world: RAPIER.World) {
  const controller = world.createCharacterController(0.025);
  controller.enableAutostep(0.38, 0.28, true);
  controller.enableSnapToGround(0.22);
  controller.setMaxSlopeClimbAngle(Math.PI * 0.27);
  controller.setMinSlopeSlideAngle(Math.PI * 0.3);
  controller.setApplyImpulsesToDynamicBodies(true);
  controller.setCharacterMass(100);
  return controller;
}
/** Identical fixed-step capsule locomotion for server authority and local prediction.
 * Only Rapier resolves position. Presentation and camera never write physics transforms. */
export function moveCharacter(
  p: Player,
  input: Input,
  body: RAPIER.RigidBody,
  collider: RAPIER.Collider,
  controller: RAPIER.KinematicCharacterController,
  water: WaterContact,
  anchors: Anchor[],
  dt = STEP,
  seed = 42,
  time = 0,
  duration=1800,
) {
  const planet=planetForSeed(seed),gravity=planet.gravity,weather=weatherAt(time,seed,duration);
  const swim = water.depth > 0.3 && water.level > p.y - 0.3;
  const pressed = input.jump && !p.lastJump;
  p.coyote = p.grounded ? 0.1 : Math.max(0, p.coyote - dt);
  p.jumpBuffer = pressed ? 0.12 : Math.max(0, p.jumpBuffer - dt);
  const length = Math.max(1, Math.hypot(input.x, input.z));
  const speed = (swim ? 3.8 : input.sprint ? 8 : 5)*(p.coldStage==="severe"||p.coldStage==="critical"?.88:1);
  const response = 1 - Math.exp(-(p.grounded ? 16 : 5) * dt);
  p.vx += ((input.x / length) * speed+(swim?Math.max(-10,Math.min(10,water.u))*.85:0) - p.vx) * response;
  p.vz += ((input.z / length) * speed+(swim?Math.max(-10,Math.min(10,water.v))*.85:0) - p.vz) * response;
  p.yaw = input.yaw;
  let jumped = false;
  if (p.jumpBuffer > 0 && p.coyote > 0 && !swim) {
    p.vy = 6.7;
    p.jumpBuffer = 0;
    p.coyote = 0;
    p.grounded = false;
    p.airTime = 0;
    jumped = true;
  }
  p.airTime = p.grounded ? 0 : p.airTime + dt;
  // A short deliberate hold separates a jump from thrust; snap cannot cancel ascent.
  p.thrusting =
    input.jump && !p.grounded && !jumped && p.airTime > 0.16 && p.fuel > 0;
  if (p.thrusting) {
    p.vy += planet.jetAcceleration * dt;
    p.fuel = Math.max(0, p.fuel - 8 * dt);
    p.rechargeDelay=2;
  } else {
    p.rechargeDelay=Math.max(0,p.rechargeDelay-dt);
    if(p.grounded && p.rechargeDelay===0)p.fuel=Math.min(100,p.fuel+9*dt);
  }
  p.vy -= gravity * dt;
  if(!p.grounded){p.vx+=weather.windX*planet.density*.012*dt;p.vz+=weather.windZ*planet.density*.012*dt;}
  if (swim) {
    // Suit flotation supports its weight; the swim controller then seeks a head-above-water draft.
    p.vy += gravity * dt;
    p.vy +=
      ((input.dive && !input.jump
        ? -3.2
        : Math.max(-3, Math.min(3, (water.level - p.y - 0.25) * 2.2))) -
        p.vy) *
      (1 - Math.exp(-3 * dt));

  }
  for (const a of anchors) {
    const acc = anchorAcceleration(p, a, a.sign, 100);
    p.vx += acc.x * dt;
    p.vy += acc.y * dt;
    p.vz += acc.z * dt;
  }
  p.vy = Math.max(-24, Math.min(16, p.vy));
  if (p.vy > 0.05) controller.disableSnapToGround();
  else controller.enableSnapToGround(0.22);
  controller.computeColliderMovement(
    collider,
    { x: (p.vx + p.pushX) * dt, y: p.vy * dt, z: (p.vz + p.pushZ) * dt },
    undefined,
    undefined,
    (c) => c !== collider,
  );
  const move = controller.computedMovement();
  body.setNextKinematicTranslation({
    x: Math.max(-156, Math.min(156, p.x + move.x)),
    y: p.y + move.y,
    z: Math.max(-150, Math.min(150, p.z + move.z)),
  });
  p.grounded = controller.computedGrounded() && p.vy <= 0.05;
  if (p.grounded && p.vy < 0) p.vy = 0;
  if (move.y < p.vy * dt - 0.002 && p.vy > 0) p.vy = 0; // ceiling contact
  p.lastJump = input.jump;
  p.ack = input.seq;
  p.pushX *= Math.exp(-5 * dt);
  p.pushZ *= Math.exp(-5 * dt);
}
export function copyPosition(p: Player, body: RAPIER.RigidBody) {
  const pos = body.translation();
  p.x = pos.x;
  p.y = pos.y;
  p.z = pos.z;
}
export function orbitOffset(yaw: number, pitch: number, distance: number): V3 {
  const horizontal = Math.cos(pitch) * distance;
  return {
    x: -Math.sin(yaw) * horizontal,
    y: Math.sin(pitch) * distance,
    z: -Math.cos(yaw) * horizontal,
  };
}
export const PITCH_LIMIT = (85 * Math.PI) / 180;
export function clampPitch(value: number) {
  return Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, value));
}
export function lerpAngle(a: number, b: number, t: number) {
  return a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;
}
export function movementAxes(right: number, forward: number, yaw: number) {
  return {
    x: Math.max(
      -1,
      Math.min(1, -right * Math.cos(yaw) + forward * Math.sin(yaw)),
    ),
    z: Math.max(
      -1,
      Math.min(1, right * Math.sin(yaw) + forward * Math.cos(yaw)),
    ),
  };
}
export class FixedClock {
  accumulator = 0;
  dropped = 0;
  advance(elapsed: number, step: () => void) {
    this.accumulator += Math.min(0.25, Math.max(0, elapsed));
    let count = 0;
    while (this.accumulator + 1e-10 >= STEP && count < 15) {
      step();
      this.accumulator = Math.max(0, this.accumulator - STEP);
      count++;
    }
    if (this.accumulator >= STEP) {
      this.dropped++;
      this.accumulator %= STEP;
    }
    return this.accumulator / STEP;
  }
}
