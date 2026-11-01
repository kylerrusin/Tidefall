import { inertialToLocal } from "./sky-math";
import { PLANETS } from "./planets";
import { ORBIT, orbitalPeriod, TIME_COMPRESSION } from "./model";
export const MOON_RADIUS = Math.cbrt(
  (3 * ORBIT.moonMass) / (4 * Math.PI * ORBIT.moonDensity),
);
export const PHYSICAL_ANGULAR_DIAMETER =
  2 * Math.atan(MOON_RADIUS / ORBIT.distance);
/** Explicit visual exaggeration. The physical tide parameters are retained, not claimed to produce a 10° disk. */
export const MOON_ANGULAR_SCALE =
  1;
export const SKY_DISTANCE = 1000;
export const STAR_DIRECTION = { x: -0.48, y: 0.77, z: -0.38 };
export function celestial(time: number) {
  // Rotation, lunar motion and tide forcing share the accelerated physical clock.
  const rate = (2 * Math.PI) / orbitalPeriod() - (2 * Math.PI) / ORBIT.rotation;
  const hour = PLANETS.tidefall.siteAngle+time*TIME_COMPRESSION*Math.PI*2/orbitalPeriod(),
    declination = .23;
  return {
    direction: inertialToLocal({x:Math.cos(hour),y:Math.sin(hour),z:0},PLANETS.tidefall,time*TIME_COMPRESSION),
    angularDiameter: PHYSICAL_ANGULAR_DIAMETER * MOON_ANGULAR_SCALE,
    radius:
      SKY_DISTANCE *
      Math.tan((PHYSICAL_ANGULAR_DIAMETER * MOON_ANGULAR_SCALE) / 2),
  };
}
export function celestialPosition(
  camera: { x: number; y: number; z: number },
  time: number,
) {
  const { direction } = celestial(time);
  return {
    x: camera.x + direction.x * SKY_DISTANCE,
    y: camera.y + direction.y * SKY_DISTANCE,
    z: camera.z + direction.z * SKY_DISTANCE,
  };
}
