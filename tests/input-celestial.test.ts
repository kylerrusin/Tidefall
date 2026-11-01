import test from "node:test";
import assert from "node:assert/strict";
import { PointerSession, relativeLook, LockState } from "../src/pointer";
import { PITCH_LIMIT } from "../src/locomotion";
import {
  celestial,
  celestialPosition,
  PHYSICAL_ANGULAR_DIAMETER,
  MOON_RADIUS,
} from "../src/celestial";
import { ORBIT } from "../src/model";
test("capture uses an explicit request; release and re-acquire reset keys without changing look", async () => {
  let requests = 0,
    releases = 0,
    resets = 0;
  let state: LockState = "unlocked";
  const session = new PointerSession(
    {
      request: () => {
        requests++;
      },
      release: () => {
        releases++;
      },
    },
    (s) => {
      state = s;
    },
    () => {
      resets++;
    },
  );
  assert.equal(requests, 0);
  session.request();
  assert.equal(requests, 1);
  assert.equal(state, "requesting");
  session.change(true);
  assert.equal(state, "locked");
  session.release();
  assert.equal(state, "unlocked");
  session.request();
  session.change(true);
  assert.equal(state, "locked");
  assert.equal(requests, 2);
  assert.equal(releases, 1);
  assert.ok(resets >= 3);
});
test("capture rejection is visible and can be retried instead of silently using edge-limited dragging", async () => {
  let fail = true,
    message = "";
  const session = new PointerSession(
    {
      request: () =>
        fail ? Promise.reject(new Error("blocked")) : Promise.resolve(),
      release: () => {},
    },
    (_, m) => {
      message = m;
    },
    () => {},
  );
  session.request();
  await Promise.resolve();
  assert.equal(session.state, "blocked");
  assert.match(message, /full browser/);
  fail = false;
  session.request();
  await Promise.resolve();
  session.change(true);
  assert.equal(session.state, "locked");
  assert.equal(session.message, "");
});
test("relative mouse deltas permit repeated full turns and ±85° pitch without absolute cursor coordinates", () => {
  let yaw = 0,
    pitch = 0;
  for (let i = 0; i < 1000; i++)
    ({ yaw, pitch } = relativeLook(yaw, pitch, 12, 0, 0.003, false));
  assert.ok(
    Math.abs(Math.atan2(Math.sin(yaw + 36), Math.cos(yaw + 36))) < 1e-10,
  );
  assert.ok(Math.abs(yaw) <= Math.PI);
  const down = relativeLook(yaw, 0, 0, 300, 0.01, false),
    up = relativeLook(yaw, 0, 0, 300, 0.01, true);
  assert.equal(down.pitch, PITCH_LIMIT);
  assert.equal(up.pitch, -PITCH_LIMIT);
  assert.deepEqual(relativeLook(yaw, pitch, NaN, 0, 0.01, false), {
    yaw,
    pitch,
  });
});
test("camera-centered celestial direction has zero translational parallax across the map", () => {
  const a = { x: -150, y: 40, z: -100 },
    b = { x: 150, y: 2, z: 120 },
    pa = celestialPosition(a, 140),
    pb = celestialPosition(b, 140);
  for (const axis of ["x", "y", "z"] as const)
    assert.ok(Math.abs(pa[axis] - a[axis] - (pb[axis] - b[axis])) < 1e-10);
  assert.equal(
    PHYSICAL_ANGULAR_DIAMETER,
    2 * Math.atan(MOON_RADIUS / ORBIT.distance),
  );
  const first = celestial(0),
    last = celestial(480);
  assert.ok(
    first.angularDiameter > (1 * Math.PI) / 180 &&
      first.angularDiameter < (3 * Math.PI) / 180,
  );
  const angular = Math.acos(
    first.direction.x * last.direction.x +
      first.direction.y * last.direction.y +
      first.direction.z * last.direction.z,
  );
  assert.ok(angular > .1 && angular < Math.PI); // accelerated rotation shares the tide clock
  assert.ok(
    Math.hypot(
      first.direction.x - last.direction.x,
      first.direction.y - last.direction.y,
      first.direction.z - last.direction.z,
    ) > 0,
  );
});
