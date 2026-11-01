import test, { before } from "node:test";
import assert from "node:assert/strict";
import { Expedition, initPhysics } from "../src/simulation";
import { Prediction } from "../src/prediction";
import { ground } from "../src/model";
import { SnapshotBuffer } from "../src/presentation";
import {
  FixedClock,
  STEP,
  PITCH_LIMIT,
  clampPitch,
  orbitOffset,
  lerpAngle,
  movementAxes,
} from "../src/locomotion";
before(async () => initPhysics());
test("a snapshot arrival preserves the actual interpolated presentation position", () => {
  const r = new Expedition("CONTINUITY"),
    p = r.join();
  r.action(p.id, "ready");
  r.action(p.id, "start");
  const local = new Prediction(r.seed, p);
  for (let i = 0; i < 120; i++) {
    const input = { x: 0, z: 1, yaw: 0, jump: false, sprint: false, seq: i };
    r.input(p.id, input);
    r.step();
    local.advance(input, r.snapshot());
  }
  const before = local.render(0.23, 1 / 60);
  local.receive({ ...p }, r.snapshot());
  const after = local.render(0.23, 0);
  assert.ok(
    Math.hypot(before.x - after.x, before.y - after.y, before.z - after.z) <
      1e-9,
  );
  local.dispose();
  r.dispose();
});
test("100 ms delayed snapshots reconcile with pending fixed-step inputs", () => {
  const r = new Expedition("LATENCY"),
    p = r.join();
  r.action(p.id, "ready");
  r.action(p.id, "start");
  const prediction = new Prediction(r.seed, p);
  let known = r.snapshot();
  const packets: {
    delivery: number;
    state: ReturnType<Expedition["snapshot"]>;
  }[] = [];
  for (let tick = 0; tick < 300; tick++) {
    const input = {
      x: 0,
      z: tick > 180 ? 1 : 0,
      yaw: 0,
      jump: tick >= 60 && tick < 78,
      sprint: false,
      seq: tick,
    };
    r.input(p.id, input);
    r.step();
    prediction.advance(input, known);
    if (tick % 6 === 0)
      packets.push({ delivery: tick + 6, state: r.snapshot() });
    while (packets.length && packets[0].delivery <= tick) {
      known = packets.shift()!.state;
      prediction.receive(
        known.players.find((v) => v.id === p.id)!,
        known,
      );
    }
  }
  assert.ok(
    Math.hypot(
      p.x - prediction.player.x,
      p.y - prediction.player.y,
      p.z - prediction.player.z,
    ) < 0.06,
  );
  prediction.dispose();
  r.dispose();
});
test("remote snapshot buffering interpolates vertical motion and remains continuous across arrivals", () => {
  const r = new Expedition("BUFFER"),
    p = r.join(),
    buffer = new SnapshotBuffer();
  for (let i = 0; i < 3; i++) {
    p.x = i;
    p.y = i * 0.5;
    r.time = i * 0.1;
    buffer.push(r.snapshot(), i * 0.1);
  }
  const middle = buffer.sample(p.id, 0.24)!;
  assert.ok(Math.abs(middle.x - 1.2) < 1e-6);
  assert.ok(Math.abs(middle.y - 0.6) < 1e-6);
  const before = buffer.sample(p.id, 0.29)!;
  p.x = 3;
  p.y = 1.5;
  r.time = 0.3;
  buffer.push(r.snapshot(), 0.3);
  const after = buffer.sample(p.id, 0.3)!;
  assert.ok(after.x - before.x < 0.11);
  r.dispose();
});
test("a flooded suit rises to a breathable draft instead of sinking under repeated gravity", () => {
  const r = new Expedition("SWIM", 42),
    p = r.join();
  r.action(p.id, "ready");
  r.action(p.id, "start");
  p.x = 0;
  p.z = 45;
  p.y = ground(0, 45, 42) + 1.2;
  r.bodies.get(p.id)!.setTranslation(p, true);
  for (let i = 0; i < 60 * 8; i++) r.step();
  const w = r.water.sample(p.x, p.z);
  assert.ok(p.y + 0.8 > w.level, `head ${p.y + 0.8}, water ${w.level}`);
  assert.ok(p.health > 50);
  assert.equal(p.alive, true);
  r.dispose();
});
test("fixed simulation produces identical locomotion at 30, 60 and 144 render FPS", () => {
  const run = (fps: number) => {
    const r = new Expedition("FPS", 42),
      p = r.join(),
      clock = new FixedClock();
    r.action(p.id, "ready");
    r.action(p.id, "start");
    let tick = 0;
    for (let frame = 0; frame < fps * 6; frame++)
      clock.advance(1 / fps, () => {
        r.input(p.id, {
          x: 0,
          z: tick < 180 ? 0 : 1,
          yaw: 0,
          jump: tick >= 90 && tick < 112,
          sprint: true,
          seq: tick++,
        });
        r.step();
      });
    const result = { x: p.x, y: p.y, z: p.z, ticks: tick };
    r.dispose();
    return result;
  };
  const a = run(30);
  for (const fps of [60, 144]) {
    const b = run(fps);
    assert.equal(b.ticks, a.ticks);
    assert.ok(Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) < 1e-5);
  }
});
test("ground contact is stable at rest and jumping is a rising-edge impulse", () => {
  const r = new Expedition("GROUND", 42),
    p = r.join();
  r.action(p.id, "ready");
  r.action(p.id, "start");
  for (let i = 0; i < 90; i++) r.step();
  const base = p.y;
  let grounded = 0;
  for (let i = 0; i < 180; i++) {
    r.step();
    if (p.grounded) grounded++;
    assert.ok(Math.abs(p.y - base) < 0.005);
  }
  assert.ok(grounded > 175);
  r.input(p.id, { x: 0, z: 0, yaw: 0, jump: true, sprint: false, seq: 1 });
  r.step();
  assert.ok(!p.grounded && p.vy > 6);
  for (let i = 0; i < 5; i++) r.step();
  assert.ok(p.vy < 6.7 && p.y > base + 0.4);
  r.dispose();
});
test("prediction uses the same capsule solver and reconciles acknowledged inputs", () => {
  const r = new Expedition("PREDICT", 42),
    p = r.join();
  r.action(p.id, "ready");
  r.action(p.id, "start");
  const local = new Prediction(42, p);
  for (let tick = 0; tick < 240; tick++) {
    const input = {
      x: 0,
      z: tick > 150 ? 1 : 0,
      yaw: 0,
      jump: tick >= 60 && tick < 80,
      sprint: false,
      seq: tick,
    };
    r.input(p.id, input);
    r.step();
    local.advance(input, r.snapshot());
    if (tick % 6 === 0) local.receive({ ...p }, r.snapshot());
  }
  const error = Math.hypot(
    p.x - local.player.x,
    p.y - local.player.y,
    p.z - local.player.z,
  );
  assert.ok(error < 0.03, `prediction error ${error}`);
  assert.ok(local.pending.length < 7);
  local.dispose();
  r.dispose();
});
test("orbit pitch spans ±85 degrees and wraps yaw through 360 without a snap", () => {
  assert.equal(clampPitch(20), PITCH_LIMIT);
  assert.equal(clampPitch(-20), -PITCH_LIMIT);
  const up = orbitOffset(0, -PITCH_LIMIT, 12),
    down = orbitOffset(0, PITCH_LIMIT, 12);
  assert.ok(up.y < -11.8 && down.y > 11.8);
  const a = orbitOffset(0, 0.2, 12),
    b = orbitOffset(Math.PI * 2, 0.2, 12);
  assert.ok(Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) < 1e-10);
  assert.ok(
    Math.abs(lerpAngle(Math.PI - 0.01, -Math.PI + 0.01, 0.5) - Math.PI) < 1e-6,
  );
});

test("strafe and waypoint conventions agree with a camera looking along +z", () => {
  const right = movementAxes(1, 0, 0),
    forward = movementAxes(0, 1, 0);
  assert.equal(right.x, -1);
  assert.equal(right.z, 0);
  assert.equal(forward.z, 1);
  assert.ok(Math.abs(movementAxes(0, 1, Math.PI / 2).x - 1) < 1e-12);
});
