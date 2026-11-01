import test, { before } from "node:test";
import assert from "node:assert/strict";
import { Expedition, initPhysics } from "../src/simulation";
import { ground } from "../src/model";
before(async () => initPhysics());
const start = (r: Expedition) => {
  for (const p of r.players.values()) r.action(p.id, "ready");
  r.action(r.host, "start");
};
test("authoritative capsule moves, jumps and uses extended thrust and recharges after landing", () => {
  const r = new Expedition("MOVE"),
    p = r.join();
  start(r);
  for (let i = 0; i < 45; i++) r.step();
  assert.ok(p.grounded);
  assert.ok(p.y >= ground(p.x, p.z, r.seed) + 0.8);
  const z = p.z;
  r.input(p.id, { x: 0, z: 1, yaw: 0, jump: false, sprint: false, seq: 1 });
  for (let i = 0; i < 120; i++) r.step();
  assert.ok(p.z > z + 7);
  r.input(p.id, { x: 0, z: 0, yaw: 0, jump: true, sprint: false, seq: 2 });
  for (let i = 0; i < 30; i++) r.step();
  assert.ok(p.fuel < 100 && p.fuel > 90);
  const fuel = p.fuel;
  r.input(p.id, { x: 0, z: 0, yaw: 0, jump: false, sprint: false, seq: 3 });
  for (let i = 0; i < 900; i++) r.step();
  assert.ok(p.fuel > fuel);
  assert.ok(p.fuel <= 100);
  assert.ok(p.y >= ground(p.x, p.z, r.seed) + 0.8);
  r.dispose();
});
test("invalid and replayed inputs cannot change acknowledged authority", () => {
  const r = new Expedition("INPUT"),
    p = r.join();
  start(r);
  r.input(p.id, { x: NaN, z: 1, yaw: 0, seq: 1 });
  assert.equal(r.commands.size, 0);
  const input = { x: 0, z: 1, yaw: 0, jump: false, sprint: false, seq: 5 };
  r.input(p.id, input);
  r.step();
  assert.equal(p.ack, 5);
  r.input(p.id, { ...input, x: 1 });
  assert.equal(r.commands.get(p.id)?.length, 0);
  r.dispose();
});
test("pause drains queued input and stops held movement on the server", () => {
  const r = new Expedition("PAUSE"),
    p = r.join();
  start(r);
  for (let i = 0; i < 6; i++)
    r.input(p.id, { x: 0, z: 1, yaw: 0, jump: true, sprint: false, seq: i });
  r.action(p.id, "pause");
  assert.equal(p.ack, 5);
  assert.equal(p.input.z, 0);
  assert.equal(p.input.jump, false);
  assert.ok(!r.commands.has(p.id));
  r.dispose();
});
test("private reconnect retains position and eliminated status; a public id cannot impersonate", () => {
  const r = new Expedition("REJOIN"),
    p = r.join();
  start(r);
  for (let i = 0; i < 60; i++) r.step();
  r.disconnect(p.id);
  const x = p.x;
  const legitimate = r.join(r.tokens.get(p.id));
  assert.equal(legitimate.id, p.id);
  assert.equal(legitimate.x, x);
  const outsider = r.join(p.id);
  assert.notEqual(outsider.id, p.id);
  assert.equal(outsider.alive, false);
  assert.equal(outsider.participant, false);
  r.eliminate(p, "Oxygen depleted");
  r.disconnect(p.id);
  assert.equal(r.join(r.tokens.get(p.id)).alive, false);
  r.dispose();
});
test("a bounded artificial field changes actual authoritative rigid body velocity", () => {
  const r = new Expedition("FIELD"),
    p = r.join();
  start(r);
  const rock = r.objects[1],
    body = r.props[1];
  p.x = rock.x;
  p.y = rock.y + 2;
  p.z = rock.z;
  r.bodies.get(p.id)!.setTranslation(p, true);
  r.world.propagateModifiedBodyPositionsToColliders();
  r.action(p.id, "anchor", { x: rock.x, y: rock.y + 5, z: rock.z });
  assert.equal(r.anchors.length, 1);
  assert.equal(p.energy, 80);
  for (let i = 0; i < 15; i++) r.step();
  assert.ok(body.linvel().y > 1);
  r.action(p.id, "recall");
  assert.equal(r.anchors.length, 0);
  r.dispose();
});
