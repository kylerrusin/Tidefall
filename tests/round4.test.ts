import {ROCK_GEOMETRY} from '../src/rock-asset';
import test, { before } from "node:test";
import assert from "node:assert/strict";
import RAPIER from "@dimforge/rapier3d-compat";
import * as THREE from "three";
import { initPhysics, rockCollider, rockPlacements } from "../src/world";
import { Expedition } from "../src/simulation";
before(async () => initPhysics());

test("rendered rock surfaces and convex colliders agree for varied scales and rotations", () => {
  const world = new RAPIER.World({ x: 0, y: 0, z: 0 });
  const rocks = rockPlacements(42).filter(r => r.size > 1).slice(0, 15);
  assert.ok(rocks.length > 5);
  for (const r of rocks) {
    const collider = world.createCollider(rockCollider(r));
    const mesh = new THREE.Mesh(ROCK_GEOMETRY.clone(), new THREE.MeshBasicMaterial());
    mesh.position.set(r.x, r.y, r.z); mesh.scale.set(r.size, r.size * 0.8, r.size); mesh.rotation.set(0.1, r.angle, 0.12); mesh.updateMatrixWorld();
    const origin = new THREE.Vector3(r.x, r.y + r.size * 3, r.z), direction = new THREE.Vector3(0, -1, 0);
    const visual = new THREE.Raycaster(origin, direction).intersectObject(mesh)[0];
    const hit = collider.castRay(new RAPIER.Ray(origin, direction), 20, true);
    assert.ok(visual && hit >= 0);
    assert.ok(Math.abs(visual.distance - hit) < 0.002, `${visual.distance} vs ${hit}`);
    world.removeCollider(collider, true); mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose();
  }
  world.free();
});

test("server validates pulse cooldown, health, occlusion and eliminated shooters", () => {
  const room = new Expedition("FIRE"), a = room.join(), b = room.join();
  room.action(a.id, "ready"); room.action(b.id, "ready"); room.action(a.id, "start");
  a.x = -10; a.z = -95; b.x = -10; b.z = -90; b.y = a.y;
  room.bodies.get(a.id)!.setTranslation(a, true); room.bodies.get(b.id)!.setTranslation(b, true);
  room.world.step();
  room.action(a.id, "fire", { yaw: 0, pitch: 0 });
  assert.equal(b.health, 82); assert.equal(a.weaponEnergy, 92);
  room.action(a.id, "fire", { yaw: 0, pitch: 0 });
  assert.equal(b.health, 82); assert.equal(a.weaponEnergy, 92);
  room.time += 1;
  const wall = room.world.createCollider(RAPIER.ColliderDesc.cuboid(2, 3, 0.2).setTranslation(-10, a.y, -92.5));
  room.world.step(); room.action(a.id, "fire", { yaw: 0, pitch: 0 });
  assert.equal(b.health, 82);
  room.world.removeCollider(wall, true);
  room.eliminate(a, "test"); room.time += 1;
  room.action(a.id, "fire", { yaw: 0, pitch: 0 });
  assert.equal(b.health, 82);
  room.dispose();
});

test("stalker state is authoritative and starts with a spawn grace period", () => {
  const room = new Expedition("STALK"), p = room.join();
  room.action(p.id, "ready"); room.action(p.id, "start");
  for (let i = 0; i < 60 * 3; i++) room.step();
  assert.ok(room.stalkers.every(s => s.state === "idle"));
  assert.deepEqual(room.snapshot().stalkers, room.stalkers);
  assert.equal(p.health, 100);
  room.dispose();
});

test("a pulse applies a bounded impulse to a shared dynamic prop", () => {
  const room = new Expedition("IMPULSE"), p = room.join();
  room.action(p.id, "ready"); room.action(p.id, "start");
  const body = room.props[1], object = room.objects[1];
  body.setTranslation({ x: p.x, y: p.y + 0.65, z: p.z + 5 }, true);
  body.setLinvel({ x: 0, y: 0, z: 0 }, true);
  room.world.step();
  room.action(p.id, "fire", { yaw: 0, pitch: 0 });
  assert.ok(body.linvel().z > 0);
  assert.ok(body.linvel().z <= 2400 / object.mass + 0.01);
  assert.equal(room.snapshot().pulses[0].hit, true);
  room.dispose();
});

test("stalker warns before attacking, recovers, and shares rifle damage", () => {
  const room = new Expedition("ENEMY"), p = room.join(), s = room.stalkers[0];
  room.action(p.id, "ready"); room.action(p.id, "start");
  // Place the stalker on the flat landing shelf, clear of other geometry.
  s.x = p.x; s.y = p.y; s.z = p.z + 1.3;
  room.stalkerBodies[0].setTranslation(s, true);
  room.world.propagateModifiedBodyPositionsToColliders();
  room.time = 8;
  room.step(); assert.equal(s.state, "alert"); assert.equal(p.health, 100);
  for (let i = 0; i < 100 && String(s.state) !== "windup"; i++) room.step();
  assert.equal(s.state, "windup"); assert.equal(p.health, 100);
  for (let i = 0; i < 100 && String(s.state) !== "attack"; i++) room.step();
  assert.equal(s.state, "attack");
  for (let i = 0; i < 50 && s.state === "attack"; i++) room.step();
  assert.equal(s.state, "recover"); assert.ok(p.health < 100);
  room.time += 2; p.yaw = 0;
  room.action(p.id, "fire", { yaw: 0, pitch: 0.1 });
  assert.equal(s.health, 72);
  assert.equal(room.snapshot().stalkers[0].health, 72);
  room.dispose();
});
