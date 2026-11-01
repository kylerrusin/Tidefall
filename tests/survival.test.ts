import test, { before } from "node:test";
import assert from "node:assert/strict";
import RAPIER from "@dimforge/rapier3d-compat";
import { Expedition, initPhysics } from "../src/simulation";
import { ground } from "../src/model";
import {
  HARD_LIMIT,
  SHELTERS,
  shelterPlacements,
  exposure,
  thermalStep,
  environment,
} from "../src/survival";
before(async () => initPhysics());
const start = (r: Expedition) => {
  for (const p of r.players.values()) r.action(p.id, "ready");
  r.action(r.host, "start");
};
const place = (
  r: Expedition,
  p: ReturnType<Expedition["join"]>,
  x: number,
  z: number,
  y = ground(x, z, r.seed) + 1,
) => {
  Object.assign(p, { x, y, z, vx: 0, vy: 0, vz: 0 });
  r.bodies.get(p.id)!.setTranslation(p, true);
  r.bodies.get(p.id)!.setNextKinematicTranslation(p);
  r.world.propagateModifiedBodyPositionsToColliders();
};
test("ready gates the start and spawns are separated with equal equipment", () => {
  const r = new Expedition("READY"),
    p = r.join(),
    q = r.join();
  r.action(p.id, "start");
  assert.equal(r.status, "ready");
  assert.ok(Math.hypot(p.x - q.x, p.z - q.z) >= 20);
  assert.equal(p.health, q.health);
  assert.equal(p.fuel, q.fuel);
  start(r);
  assert.equal(r.practice, false);
  assert.equal(r.status, "running");
  r.dispose();
});
test("one physical supply is claimed once and oxygen use is server validated", () => {
  const r = new Expedition("PICKUP"),
    p = r.join(),
    q = r.join();
  start(r);
  const s = r.supplies[0];
  r.action(p.id, "interact");
  assert.equal(s.takenBy, null);
  place(r, p, s.x, s.z, s.y + 1);
  place(r, q, s.x + 1.1, s.z, s.y + 1);
  r.action(p.id, "interact");
  r.action(q.id, "interact");
  assert.equal(s.takenBy, p.id);
  assert.equal(p.canisters, 1);
  assert.equal(q.canisters, 0);
  p.oxygen = 10;
  r.action(p.id, "oxygen");
  assert.equal(p.oxygen, 75);
  assert.equal(p.canisters, 0);
  r.action(p.id, "oxygen");
  assert.equal(p.oxygen, 75);
  r.dispose();
});
test("brief submersion consumes oxygen before health; breathable air stops tank use", () => {
  const r = new Expedition("OXYGEN"),
    p = r.join();
  for (let i = 0; i < 600; i++)
    exposure(p, { level: p.y + 2, depth: 5 }, 0, 1 / 60);
  assert.ok(Math.abs(p.oxygen - 78) < 0.01);
  assert.equal(p.health, 100);
  const stored = p.oxygen;
  for (let i = 0; i < 60; i++)
    exposure(p, { level: p.y - 2, depth: 0 }, 0, 1 / 60);
  assert.equal(p.oxygen, stored);
  p.oxygen = 0;
  exposure(p, { level: p.y + 2, depth: 5 }, 0, 1);
  assert.equal(p.health, 91);
  r.dispose();
});
test("thermal response integrates exposure and insulation/shelter reduce heat transfer", () => {
  let bare = 37,
    liner = 37,
    shelter = 37;
  for (let i = 0; i < 60 * 60; i++) {
    bare = thermalStep(bare, -15, false, 20, false, false, 1 / 60);
    liner = thermalStep(liner, -15, false, 20, true, false, 1 / 60);
    shelter = thermalStep(shelter, -15, false, 20, false, true, 1 / 60);
  }
  assert.ok(liner > bare + .2);
  assert.ok(shelter > liner);
  assert.ok(thermalStep(37, 95, true, 2, false, false, 1) > 37);
  assert.ok(environment(1700).air < environment(200).air - 25);
});
test("shelter capacity is shared and protection requires physically entering its open side", () => {
  const r = new Expedition("SHELTER"),
    p = r.join(),
    q = r.join();
  start(r);
  r.supplies = [];
  const s = shelterPlacements(r.seed)[0];
  place(r, p, s.x, s.z,s.y+1.01);
  place(r, q, s.x + 1.1, s.z,s.y+1.01);
  r.action(p.id, "interact");
  r.action(q.id, "interact");
  assert.equal(p.shelter, s.id);
  assert.equal(q.shelter, null);
  r.action(p.id, "interact");
  r.action(q.id, "interact");
  assert.equal(q.shelter, s.id);
  r.dispose();
});
test("shove is short range, bounded, on cooldown and blocked by a solid wall", () => {
  const r = new Expedition("PUSH"),
    p = r.join(),
    q = r.join();
  start(r);
  place(r, p, 0, -85);
  place(r, q, 0, -83);
  p.yaw = 0;
  r.action(p.id, "shove");
  assert.ok(q.pushZ > 0 && q.pushZ <= 3.5);
  const impulse = q.pushZ;
  r.action(p.id, "shove");
  assert.equal(q.pushZ, impulse);
  q.pushZ = 0;
  r.time += 2;
  const wall = r.world.createCollider(
    RAPIER.ColliderDesc.cuboid(2, 2, 0.2).setTranslation(0, p.y, -84),
  );
  r.world.propagateModifiedBodyPositionsToColliders();
  r.world.step();
  r.action(p.id, "shove");
  assert.equal(q.pushZ, 0);
  r.world.removeCollider(wall, true);
  r.time += 2;
  place(r, q, 0, -75);
  r.action(p.id, "shove");
  assert.equal(q.pushZ, 0);
  r.dispose();
});
test("elimination disables collision, preserves spectator identity and records authoritative survival ranking", () => {
  const r = new Expedition("RANK"),
    p = r.join(),
    q = r.join(),
    s = r.join();
  start(r);
  r.time = 20;
  r.eliminate(p, "Oxygen depleted");
  r.finish();
  assert.equal(r.status, "running");
  assert.equal(r.colliders.get(p.id)!.isEnabled(), false);
  r.time = 34;
  r.eliminate(q, "Thermal exposure");
  r.finish();
  assert.equal(r.status, "finished");
  assert.deepEqual(r.winnerIds, [s.id]);
  assert.deepEqual(
    r.snapshot().standings.map((v) => v.rank),
    [1, 2, 3],
  );
  assert.equal(r.snapshot().standings[2].time, 20);
  r.action(p.id, "oxygen");
  assert.equal(p.alive, false);
  r.dispose();
});
test("same-tick final deaths share first place and timed extraction ends a stalled round without fabricated deaths", () => {
  const r = new Expedition("TIE"),
    p = r.join(),
    q = r.join();
  start(r);
  r.time = 70;
  r.eliminate(p, "Hypothermia");
  r.eliminate(q, "Hypothermia");
  r.finish();
  assert.equal(r.status, "finished");
  assert.equal(r.winnerIds.length, 2);
  assert.ok(r.snapshot().standings.every((s) => s.rank === 1));
  r.dispose();
  const limit = new Expedition("LIMIT"),
    a = limit.join(),
    b = limit.join();
  start(limit);
  limit.time = HARD_LIMIT;
  limit.finish();
  assert.equal(limit.status, "finished");
  assert.ok(a.alive && b.alive);
  assert.deepEqual(limit.winnerIds,[a.id,b.id]);
  limit.dispose();
});
test("disconnect grace permits genuine rejoin but cannot grant indefinite invulnerability", () => {
  const r = new Expedition("GRACE"),
    p = r.join(),
    q = r.join();
  start(r);
  r.disconnect(q.id);
  r.time = 19;
  r.step();
  assert.equal(q.alive, true);
  r.join(r.tokens.get(q.id));
  r.time = 25;
  r.step();
  assert.equal(q.alive, true);
  r.disconnect(q.id);
  r.time = 46;
  r.step();
  assert.equal(q.deathCause, "Signal lost");
  assert.deepEqual(r.winnerIds, [p.id]);
  r.dispose();
});
test("a deep-water explorer can intentionally dive and float back to a breathable draft", () => {
  const r = new Expedition("DIVE"),
    p = r.join();
  start(r);
  place(r, p, 8, 64, r.water.sample(8, 64).level - 0.25);
  const surface = p.y;
  r.input(p.id, {
    x: 0,
    z: 0,
    yaw: 0,
    jump: false,
    dive: true,
    sprint: false,
    seq: 1,
  });
  for (let i = 0; i < 180; i++) r.step();
  assert.ok(p.y < surface - 4);
  r.input(p.id, {
    x: 0,
    z: 0,
    yaw: 0,
    jump: false,
    dive: false,
    sprint: false,
    seq: 2,
  });
  for (let i = 0; i < 300; i++) r.step();
  assert.ok(p.y + 0.65 > r.water.sample(p.x, p.z).level);
  assert.equal(p.alive, true);
  assert.ok(p.oxygen > 70);
  r.dispose();
});
