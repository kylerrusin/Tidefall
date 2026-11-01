import test from "node:test";
import assert from "node:assert/strict";
import {
  DURATION,
  GRAVITY,
  ORBIT,
  PHYSICAL_TIDE_PERIOD,
  TIME_COMPRESSION,
  anchorAcceleration,
  astronomy,
  buoyancy,
  chemistry,
  ground,
  orbitSafety,
  orbitalPeriod,
  submergedSphereFraction,
  terrain,
  tidalPotential,
} from "../src/model";
import { Water } from "../src/water";
test("orbit is consistent with Kepler and lies outside Roche / inside prograde stability limits", () => {
  const p = orbitalPeriod();
  assert.ok(
    Math.abs(
      (p * p * ORBIT.G * (ORBIT.planetMass + ORBIT.moonMass)) /
        (4 * Math.PI * Math.PI * ORBIT.distance ** 3) -
        1,
    ) < 1e-12,
  );
  assert.ok(ORBIT.distance > orbitSafety().roche);
  assert.ok(ORBIT.distance < orbitSafety().stable);
  assert.equal(TIME_COMPRESSION * DURATION, PHYSICAL_TIDE_PERIOD);
  assert.ok(Math.abs(astronomy(0).level - astronomy(DURATION).level) < 1e-10);
  assert.ok(
    Math.abs(
      astronomy(20).moonPhase - (2 * Math.PI * 20 * TIME_COMPRESSION) / p,
    ) < 1e-12,
  );
});
test("quadrupolar forcing scales with mass and inverse cube distance", () => {
  assert.equal(tidalPotential(1, ORBIT.moonMass * 2), tidalPotential(1) * 2);
  assert.ok(
    Math.abs(
      tidalPotential(1, ORBIT.moonMass, ORBIT.distance * 2) * 8 -
        tidalPotential(1),
    ) < 1e-10,
  );
  assert.ok(
    Math.abs(astronomy(180 - 0.001).level - astronomy(180 + 0.001).level) <
      1e-4,
  );
  assert.ok(astronomy(420).level > astronomy(180).level + 8);
});
test("seeded inherited geology is repeatable and varied", () => {
  const a = Array.from({ length: 100 }, (_, i) => terrain(i - 50, i * 0.7, 42));
  assert.deepEqual(
    a,
    Array.from({ length: 100 }, (_, i) => terrain(i - 50, i * 0.7, 42)),
  );
  assert.notDeepEqual(
    a,
    Array.from({ length: 100 }, (_, i) => terrain(i - 50, i * 0.7, 43)),
  );
  assert.ok(ground(0, -105) > ground(0, 70));
});
test("lake at rest has zero spurious flow and conserved mass", () => {
  const n = 12,
    bed = Array.from({ length: n * n }, (_, k) => Math.sin(k % n) * 0.3),
    w = new Water(1, n, 5, bed, 2);
  for (let i = 0; i < 100; i++) w.advance(0.1, 2);
  assert.ok(Math.max(...w.qx.map(Math.abs), ...w.qz.map(Math.abs)) < 1e-12);
  assert.ok(Math.abs(w.volume() - w.initialVolume - w.boundaryVolume) < 1e-8);
});
test("dry sill prevents isolated basin flooding, opening sill connects it", () => {
  const n = 9,
    bed = Array(n * n).fill(0);
  for (let x = 0; x < n; x++) bed[5 * n + x] = 6;
  const w = new Water(1, n, 5, bed, 2);
  assert.equal(w.h[2 * n + 4], 0);
  for (let i = 0; i < 100; i++) w.advance(0.1, 4);
  assert.equal(w.h[2 * n + 4], 0);
  w.bed[5 * n + 4] = 0;
  for (let i = 0; i < 1000; i++) w.advance(0.1, 4);
  assert.ok(w.h[2 * n + 4] > 0.2);
});
test("repeated wet-dry cycles remain finite, nonnegative and conserve boundary-accounted volume", () => {
  const n = 17,
    bed = Array.from(
      { length: n * n },
      (_, k) => 4 - Math.floor(k / n) * 0.5 + Math.sin(k % n) * 0.8,
    ),
    w = new Water(1, n, 5, bed, 1);
  for (let i = 0; i < 12000; i++) w.advance(0.1, 1 + 3 * Math.sin(i * 0.003));
  assert.ok([...w.h, ...w.qx, ...w.qz].every(Number.isFinite));
  assert.ok(w.h.every((h) => h >= 0));
  assert.ok(Math.abs(w.volume() - w.initialVolume - w.boundaryVolume) < 1e-6);
});
test("buoyancy floats dry pumice, sinks basalt; anchor is force limited and softened", () => {
  assert.ok(buoyancy(1, 1) > 540 * GRAVITY);
  assert.ok(buoyancy(1, 1) < 2900 * GRAVITY);
  const a = { x: 0, y: 0, z: 0 },
    c = { x: 10, y: 0, z: 0 };
  assert.ok(
    anchorAcceleration(a, c, 1, 100).x > anchorAcceleration(a, c, 1, 10000).x,
  );
  assert.equal(
    anchorAcceleration(a, c, -1, 100).x,
    -anchorAcceleration(a, c, 1, 100).x,
  );
  for (const x of [0, 0.00001, 0.1, 1, 100]) {
    const f = anchorAcceleration(a, { x, y: 0, z: 0 }, 1, 1);
    assert.ok(Number.isFinite(f.x) && Math.abs(f.x) <= 24);
  }
  assert.equal(anchorAcceleration(a, { x: 30, y: 0, z: 0 }, 1, 100).x, 0);
});
test("hydrothermal and brine concentrations decay with distance and mixing", () => {
  assert.ok(chemistry(68, 2, 0).temperature > chemistry(90, 2, 0).temperature);
  assert.ok(chemistry(68, 2, 10).temperature < chemistry(68, 2, 0).temperature);
  assert.ok(chemistry(78, 12, 0).salinity > 100);
  assert.ok(chemistry(0, -100, 0).pH > 7);
});
test("numerical world tide exposes the cavern then floods the same connected route", () => {
  const w = new Water(42);
  for (let t = 0; t < 180; t += 0.5) w.advance(0.5, astronomy(t).level);
  const low = w.sample(-46, 12);
  for (let t = 180; t < 450; t += 0.5) w.advance(0.5, astronomy(t).level);
  const high = w.sample(-46, 12);
  assert.ok(low.depth < 0.2, `low depth ${low.depth}`);
  assert.ok(high.depth > 1, `high depth ${high.depth}`);
  assert.ok(Math.abs(w.volume() - w.initialVolume - w.boundaryVolume) < 1e-5);
});
test("sphere displacement uses spherical cap volume with bounded dry/full limits", () => {
  assert.equal(submergedSphereFraction(2, -1), 0);
  assert.equal(submergedSphereFraction(2, 2), 0.5);
  assert.equal(submergedSphereFraction(2, 4), 1);
  assert.equal(submergedSphereFraction(2, 8), 1);
  assert.equal(submergedSphereFraction(2, 1), 0.15625);
});
