import type { V3 } from "./model";

/** Shared tuning in SI units. Cosmetic motion never changes authoritative aim. */
export const COMBAT = {
  rifle: { range: 85, damage: 18, cadence: 0.32, energy: 8, recharge: 3, impulse: 2400 },
  stalker: {
    health: 90, radius: 0.8, grace: 8, decision: 0.1,
    awareness: 42, vision: 49, visionHalfAngle: 82 * Math.PI / 180,
    walkHearing: 10, sprintHearing: 19, gunHearing: 48,
    walkSpeed: 1.5, chaseSpeed: 7.4, acceleration: 11,
    commitment: 3.2, memory: 14, alert: 0.7, stagger: 0.38,
    meleeRange: 2.7, meleeArc: 0.9, meleeWindup: 0.7, meleeDamage: 35, meleeCooldown: 1.35,
    rangedMin: 7, rangedMax: 22, rangedWindup: 1.1, rangedCooldown: 3.6,
    projectileSpeed: 17, projectileRadius: 0.18, projectileDamage: 26, projectileLife: 3.5,
    activeAttackers: 3,
  },
} as const;
export const CREATURE_TYPES = {
  stalker: {...COMBAT.stalker,mass:90,armor:1,mechanical:false,maxDepth:1.8,maxCurrent:4,heatLimit:55},
  ambusher:{...COMBAT.stalker,health:70,radius:.65,mass:55,armor:1,chaseSpeed:7.2,vision:17,chargeRange:7,chargeWindup:.8,chargeSpeed:10,chargeTime:.55,chargeDamage:34,chargeCooldown:4.5,mechanical:false,maxDepth:1.4,maxCurrent:4,heatLimit:52},
  grazer:{...COMBAT.stalker,health:58,radius:.8,mass:110,armor:.8,chaseSpeed:3.8,vision:16,mechanical:false,maxDepth:1,maxCurrent:2.5,heatLimit:48},
  scuttler:{...COMBAT.stalker,health:32,radius:.35,mass:6,armor:1,chaseSpeed:4.4,vision:12,mechanical:false,maxDepth:.7,maxCurrent:2,heatLimit:48},
  skimmer:{...COMBAT.stalker,health:38,radius:.55,mass:12,armor:1,chaseSpeed:2.5,vision:10,mechanical:false,maxDepth:30,maxCurrent:8,heatLimit:43},
  ridgeback: {...COMBAT.stalker,health:150,radius:1.35,mass:900,armor:.45,chaseSpeed:2.5,vision:26,chargeRange:11,chargeWindup:1.2,chargeSpeed:8.5,chargeTime:.85,chargeDamage:36,chargeCooldown:5.5,mechanical:false,maxDepth:1.1,maxCurrent:2.5,heatLimit:55},
  surveyor:{...COMBAT.stalker,health:72,radius:.7,mass:85,armor:.8,chaseSpeed:3.6,vision:42,rangedMax:32,rangedCooldown:3.2,projectileSpeed:20,projectileDamage:26,mechanical:true,maxDepth:.1,maxCurrent:0,heatLimit:2200},
  sentinel:{...COMBAT.stalker,health:144,radius:1.1,mass:650,armor:.5,chaseSpeed:2.7,vision:36,chargeRange:12,chargeWindup:1.1,chargeSpeed:7.5,chargeTime:.9,chargeDamage:38,chargeCooldown:4.8,mechanical:true,maxDepth:.1,maxCurrent:0,heatLimit:2400},
} as const;

export function lookDirection(yaw: number, pitch: number): V3 {
  const h = Math.cos(pitch);
  return { x: Math.sin(yaw) * h, y: -Math.sin(pitch), z: Math.cos(yaw) * h };
}
/** Positive angle is screen-right for the +z-forward camera convention. */
export function damageBearing(from: V3, player: V3, yaw: number) {
  return Math.atan2(Math.sin(yaw - Math.atan2(from.x - player.x, from.z - player.z)),
    Math.cos(yaw - Math.atan2(from.x - player.x, from.z - player.z)));
}
export function inVision(from: V3, yaw: number, to: V3, range: number = COMBAT.stalker.vision) {
  const dx = to.x - from.x, dz = to.z - from.z, d = Math.hypot(dx, to.y - from.y, dz);
  return d <= range && (d < 0.01 || (dx * Math.sin(yaw) + dz * Math.cos(yaw)) / Math.max(0.01, Math.hypot(dx, dz)) >= Math.cos(COMBAT.stalker.visionHalfAngle));
}
