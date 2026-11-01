import {geologicalField,GEO_MATERIALS} from "./geological-fields";
import {createSubstrateField,substrateReliefAt} from './substrate-field';
import {LANDER,SITES} from './domain/world-sites';
export {LANDER,SITES} from './domain/world-sites';
/** Shared authoritative contracts, deterministic geology, and environmental physics. SI units. */
import { PLANETS, SIM_MOON, planetForSeed, type PlanetId } from "./planets";
export type V3 = { x: number; y: number; z: number };
export const SIZE = 320,
  GRID = 65,
  DX = SIZE / (GRID - 1),
  GRAVITY = PLANETS.tidefall.gravity,
  DURATION = 480;
export const ORBIT = {
  G: 6.6743e-11,
  planetMass: PLANETS.tidefall.observed.massKg,
  moonMass: SIM_MOON.massKg,
  radius: PLANETS.tidefall.observed.radiusM,
  distance: SIM_MOON.orbitM,
  rotation: PLANETS.tidefall.rotation,
  starMass: PLANETS.tidefall.observed.st_mass*1.98847e30,
  starDistance: PLANETS.tidefall.orbit*1.495978707e11,
  planetDensity: PLANETS.tidefall.observed.massKg/(4/3*Math.PI*PLANETS.tidefall.observed.radiusM**3),
  moonDensity: 3300,
};
export function orbitalPeriod(
  mass:number = ORBIT.moonMass,
  distance:number = ORBIT.distance,
) {
  return (
    2 *
    Math.PI *
    Math.sqrt(distance ** 3 / (ORBIT.G * (ORBIT.planetMass + mass)))
  );
}
export const PHYSICAL_TIDE_PERIOD =
  Math.PI /
  Math.abs((2 * Math.PI) / ORBIT.rotation - (2 * Math.PI) / orbitalPeriod());
export const TIME_COMPRESSION = PHYSICAL_TIDE_PERIOD / DURATION;
export function orbitSafety() {
  return {
    roche:
      2.44 *
      ORBIT.radius *
      (ORBIT.planetDensity / ORBIT.moonDensity) ** (1 / 3),
    stable:
      0.4895 *
      ORBIT.starDistance *
      (ORBIT.planetMass / (3 * ORBIT.starMass)) ** (1 / 3),
  };
}
export function tidalPotential(
  cosPsi: number,
  mass:number = ORBIT.moonMass,
  distance:number = ORBIT.distance,
) {
  return (
    (((ORBIT.G * mass * ORBIT.radius ** 2) / distance ** 3) *
      (3 * cosPsi ** 2 - 1)) /
    2
  );
}
export function astronomy(time: number) {
  const relative = (2 * Math.PI * time) / DURATION;
  // Semidiurnal quadrupole; a 45-degree local phase lag represents inlet response.
  const referenceAmplitude = (0.75 * tidalPotential(1)) / GRAVITY;
  const angle = relative + Math.PI / 4;
  return {
    moonPhase: (2 * Math.PI * time * TIME_COMPRESSION) / orbitalPeriod(),
    relativeAngle: relative / 2,
    level: 5 + referenceAmplitude * 0.72 * Math.cos(angle),
    rising: -Math.sin(angle) > 0,
    nextHigh:
      ((2 * Math.PI -
        (((angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI))) /
        (2 * Math.PI)) *
      DURATION,
    nextExtreme:
      ((Math.PI - (((angle % Math.PI) + Math.PI) % Math.PI)) / (2 * Math.PI)) *
      DURATION,
    referenceAmplitude,
  };
}
export function hash(seed: number, x: number, z: number) {
  let a = Math.imul((x | 0) ^ seed, 374761393) ^ Math.imul(z | 0, 668265263);
  a = Math.imul(a ^ (a >>> 13), 1274126177);
  return ((a ^ (a >>> 16)) >>> 0) / 4294967296;
}
function noise(seed: number, x: number, z: number) {
  const i = Math.floor(x),
    j = Math.floor(z);
  let a = x - i,
    b = z - j;
  a = a * a * (3 - 2 * a);
  b = b * b * (3 - 2 * b);
  return (
    (hash(seed, i, j) * (1 - a) + hash(seed, i + 1, j) * a) * (1 - b) +
    (hash(seed, i, j + 1) * (1 - a) + hash(seed, i + 1, j + 1) * a) * b
  );
}
function inheritedTerrain(x: number, z: number, seed = 42) {
  const uplift = 15 - 0.105 * (z + 80);
  const valley =
    10 * Math.exp(-((x / 53) ** 2)) * Math.exp(-(((z - 15) / 110) ** 2));
  const fault = 12 * Math.exp(-(((x + 87 + z * 0.15) / 25) ** 2));
  const volcanic =
    20 * Math.exp(-(((x - 110) / 43) ** 2 + ((z + 36) / 48) ** 2));
  const erosion =
    (noise(seed, x / 35, z / 35) - 0.5) * 4 +
    (noise(seed + 7, x / 13, z / 13) - 0.5) * 1.3;
  return uplift - valley + fault + volcanic + erosion;
}

export const TERRAIN_GRID = 129,
  TERRAIN_DX = SIZE / (TERRAIN_GRID - 1);
function smooth(a: number, b: number, v: number) {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
/** Coastal drainage descends toward +z; faults and lithology organize smaller erosion. */
function initialTerrain(x:number,z:number,seed=42){
  // Retain the volcanic scenario's authored facility terrain. The coast has no boundary wall.
  const border=seed<0?smooth(132,159,Math.abs(x))*38+smooth(132,159,-z)*42:0;
  return terrainBase(x,z,seed)+border;
}
function terrainBase(x: number, z: number, seed = 42) {
  if(seed<0){
    const warp=(noise(seed,x/65,z/60)-.5)*12;
    const rift=18*Math.exp(-(((x-24-Math.sin(z/55)*14)/18)**2));
    const wall=24*(1-smooth(-62,-42,x+z*.2+warp));
    const ridge=16*Math.exp(-(((x-92)/32)**2))+12*Math.exp(-(((z-55)/25)**2));
    const fractures=3*Math.abs(Math.sin((x+z*.32+warp)/11))*(.4+noise(seed+9,x/16,z/18));
    let h=17-z*.035+wall+ridge-rift+fractures+(noise(seed+13,x/9,z/12)-.5)*1.5;
    const vent=Math.exp(-(((x-68)/17)**2+((z-2)/17)**2));h=h*(1-vent)+8*vent;
    const pad=1-smooth(16,33,Math.hypot(x,z+105));return h*(1-pad)+23*pad;
  }
  const warp = (noise(seed + 19, x / 70, z / 80) - 0.5) * 8,
    channel = 9 + Math.sin((z + 40) / 65) * 9;
  const gauss = (v: number) => Math.exp(-v * v);
  const uplift = 19 - 0.118 * (z + 80),
    basin = 11 * gauss((x - channel) / 59) * gauss((z - 25) / 120);
  const fault =
    12 *
    (1 - smooth(-115, -60, x + z * 0.12 + warp)) *
    smooth(-110, -35, z) *
    (1 - 0.3 * smooth(110, 160, z));
  const resistant = 4.5 * gauss((x + 86 + z * 0.12) / 30) * smooth(-90, -10, z);
  const volcano = 18 * gauss((x - 110) / 55) * gauss((z + 35) / 64);
  const drainage =
    1.6 * gauss((x - channel) / 12) * smooth(-70, -25, z) +
    .8 * gauss((x - (58 - z * 0.48)) / 10) * smooth(-20, 20, z);
  const erosion =
    (noise(seed, x / 42 + warp * 0.02, z / 48) - 0.5) * 2 +
    (noise(seed + 7, x / 23, z / 29) - 0.5) * .8;
  const sediment = (noise(seed + 11, x / 70, z / 70) - 0.5) * 0.5;
  // Low-amplitude rocky shoulders are geometry, without periodic fine ridges.
  const exposure=smooth(43,90,x)+(1-smooth(-105,-55,x))*.6;
  const jointRelief=exposure*(noise(seed+41,x/24,z/30)-.5)*1.2;
  const island = 10 * gauss((x - 34) / 15) * gauss((z - 112) / 22);
  let h =
    uplift -
    basin +
    fault +
    resistant +
    volcano -
    drainage +
    erosion +
    sediment +jointRelief+
    island;
  // Keep the safe flat centre; feather its shoulder broadly and irregularly into the shelf.
  const padDistance=Math.hypot(x,z+105),padWarp=(noise(seed+51,x/31,z/37)-.5)*9*smooth(16,35,padDistance);
  const plateau = 1 - smooth(16, 55, padDistance+padWarp);
  h = h * (1 - plateau) + 23 * plateau;
  const cave = gauss((x + 46) / 14) * gauss((z - 12) / 20) * 0.9;
  h = h * (1 - cave) + inheritedTerrain(x, z, seed) * cave;
  const vent = gauss((x - 68) / 13) * gauss((z - 2) / 14) * 0.85;
  return h * (1 - vent) + inheritedTerrain(x, z, seed) * vent;
}
export const regionalTerrainHeight=initialTerrain;
export const worldSubstrate=(seed:number)=>createSubstrateField(seed,initialTerrain);
const terrainCache=new Map<number,Float64Array>();
function generatedTerrain(seed:number){let data=terrainCache.get(seed);if(data)return data;const n=TERRAIN_GRID,dx=TERRAIN_DX,field=worldSubstrate(seed);data=Float64Array.from({length:n*n},(_,k)=>initialTerrain((k%n)*dx-160,Math.floor(k/n)*dx-160,seed)+substrateReliefAt((k%n)*dx-160,Math.floor(k/n)*dx-160,field));
// Conservative talus transfer on loose cover; resistant fault scarps remain.
for(let pass=0;pass<20;pass++){for(let j=1;j<n-1;j++)for(let i=1;i<n-1;i++){const k=j*n+i,x=i*dx-160,z=j*dx-160;if(Math.abs(x)>130||z< -130||Math.hypot(x,z+105)<34)continue;const g=geologicalField(x,z,data[k],0,seed);if(g.weights.basalt+g.weights.carbonate>.5)continue;for(const d of [1,n]){const other=k+d,diff=data[k]-data[other],excess=Math.abs(diff)-Math.tan(32*Math.PI/180)*dx;if(excess>0){const move=Math.sign(diff)*excess*.2;data[k]-=move;data[other]+=move;}}}}
terrainCache.set(seed,data);if(terrainCache.size>8)terrainCache.delete(terrainCache.keys().next().value!);return data;}
export function terrain(x:number,z:number,seed=42){if(Math.abs(x)>160||Math.abs(z)>160)return initialTerrain(x,z,seed);const data=generatedTerrain(seed),gx=(x+160)/TERRAIN_DX,gz=(z+160)/TERRAIN_DX,i=Math.min(TERRAIN_GRID-2,Math.floor(gx)),j=Math.min(TERRAIN_GRID-2,Math.floor(gz)),a=gx-i,b=gz-j,k=j*TERRAIN_GRID+i;return a+b<=1?data[k]+a*(data[k+1]-data[k])+b*(data[k+TERRAIN_GRID]-data[k]):data[k+TERRAIN_GRID+1]+(1-a)*(data[k+TERRAIN_GRID]-data[k+TERRAIN_GRID+1])+(1-b)*(data[k+1]-data[k+TERRAIN_GRID+1]);}
/** Metre-scale, nonperiodic regional geology used by the decorative land and its water bed. */
export function regionalLandform(x:number,z:number,seed=42){
  const u=x+(noise(seed+101,x/240,z/260)-.5)*70;
  const v=z+(noise(seed+102,x/280,z/230)-.5)*70;
  const gauss=(a:number,b:number)=>Math.exp(-a*a-b*b);
  const regional=(noise(seed+201,u/320,v/300)-.5)*36;
  const landform=(noise(seed+202,u/110,v/135)-.5)*14;
  const local=(noise(seed+203,u/34,v/38)-.5)*2.4;
  const west=32*gauss((u+430+v*.22)/260,(v+110)/550);
  const east=38*gauss((u-500+v*.14)/310,(v+310)/420);
  const valley=10*gauss((u-15-v*.2)/140,(v-60)/420);
  const coast=18*(1-smooth(-500,120,v))-15*smooth(60,520,v);
  return (seed<0?26+west*.7+east*.8-valley:coast+west+east-valley)+regional+landform+local;
}
/** Shared exact inner edge, continued edge slope, then a broad 140 m transition to regional geology. */
export function distantTerrainHeight(x:number,z:number,seed=42){
  const radius=Math.max(Math.abs(x),Math.abs(z));
  if(radius<=160)return terrain(x,z,seed);
  const bx=x*160/radius,bz=z*160/radius,edge=terrain(bx,bz,seed);
  // Continue the regional slope, not a local rock shoulder magnified over 70 metres.
  const slope=(initialTerrain(bx,bz,seed)-initialTerrain(bx*155/160,bz*155/160,seed))/5;
  const distance=radius-160,continued=edge+slope*70*(1-Math.exp(-distance/70));
  const t=smooth(160,300,radius);
  return continued*(1-t)+regionalLandform(x,z,seed)*t;
}
export function geology(x: number, z: number, seed = 42) {
  const h = ground(x, z, seed),
    sx = (ground(x + 2, z, seed) - ground(x - 2, z, seed)) / 4,
    sz = (ground(x, z + 2, seed) - ground(x, z - 2, seed)) / 4,
    slope = Math.hypot(sx, sz);
  return {
    ...geologicalField(x,z,h,slope,seed),
    height: h,
    slope,
    normal: { x: -sx / Math.hypot(sx, 1, sz), y: 1 / Math.hypot(sx, 1, sz), z: -sz / Math.hypot(sx, 1, sz) },
    region: seed<0 ? (x<-45?"rift escarpment":x>65?"thermal highlands":"basalt canyon") : x > 65 ? "volcanic highlands" : x < -62 ? "carbonate fault" : h < 9 ? "tidal flats" : "inland shelf",
    moisture: seed<0?.08:Math.max(0, 1 - Math.abs(h - 5) / 12),
    salinity: seed<0?0:h < 11 ? 70 : 8,
  };
}
/** Rendered triangle barycentrics. The dominant exposed unit and blended properties follow its vertices. */
export function exposedGeology(x:number,z:number,seed=42){const gx=Math.max(0,Math.min(TERRAIN_GRID-1.000001,(x+160)/TERRAIN_DX)),gz=Math.max(0,Math.min(TERRAIN_GRID-1.000001,(z+160)/TERRAIN_DX)),i=Math.floor(gx),j=Math.floor(gz),a=gx-i,b=gz-j;
 const nodes=a+b<=1?[[i,j,1-a-b],[i+1,j,a],[i,j+1,b]]:[[i+1,j+1,a+b-1],[i,j+1,1-a],[i+1,j,1-b]],samples=nodes.map(([i,j,w])=>({g:geology(i*TERRAIN_DX-160,j*TERRAIN_DX-160,seed),w})),dominant=samples.reduce((a,b)=>a.w>=b.w?a:b).g;
 return {...dominant,height:ground(x,z,seed),color:[0,1,2].map(k=>samples.reduce((sum,s)=>sum+s.g.color[k]*s.w,0)),density:samples.reduce((sum,s)=>sum+s.g.density*s.w,0),friction:samples.reduce((sum,s)=>sum+s.g.friction*s.w,0),contact:[...new Set(samples.filter(s=>s.w>.01).map(s=>s.g.unitId))]};}
/** Authoritative world-space support surface for scenery, resources and habitats. */
export const surfaceAt = geology;
export function ground(x: number, z: number, seed = 42) {
  // Match the rendered/collision triangulated heightfield exactly.
  const gx = Math.max(
      0,
      Math.min(TERRAIN_GRID - 1.000001, (x + SIZE / 2) / TERRAIN_DX),
    ),
    gz = Math.max(
      0,
      Math.min(TERRAIN_GRID - 1.000001, (z + SIZE / 2) / TERRAIN_DX),
    );
  const i = Math.floor(gx),
    j = Math.floor(gz),
    a = gx - i,
    b = gz - j;
  const h00 = terrain(i * TERRAIN_DX - 160, j * TERRAIN_DX - 160, seed),
    h10 = terrain((i + 1) * TERRAIN_DX - 160, j * TERRAIN_DX - 160, seed),
    h01 = terrain(i * TERRAIN_DX - 160, (j + 1) * TERRAIN_DX - 160, seed),
    h11 = terrain((i + 1) * TERRAIN_DX - 160, (j + 1) * TERRAIN_DX - 160, seed);
  return a + b <= 1
    ? h00 + a * (h10 - h00) + b * (h01 - h00)
    : h11 + (1 - a) * (h01 - h11) + (1 - b) * (h10 - h11);
}

export function cliffs(seed: number) {
  return Array.from({ length: 26 }, (_, i) => {
    const x = -105 + Math.sin(i * 1.2) * 11,
      z = -30 + i * 6.7;
    return {
      x,
      y: ground(x, z, seed) - 3,
      z,
      radius: 8 + hash(seed, i, 91) * 5,
      height: 12 + hash(seed, i, 95) * 26,
      angle: hash(seed, i, 92) * 4,
    };
  });
}

export const MATERIALS = {
  basalt: { density: GEO_MATERIALS.basalt.density, friction: GEO_MATERIALS.basalt.friction, color: "#353a50" },
  carbonate: { density: GEO_MATERIALS.carbonate.density, friction: GEO_MATERIALS.carbonate.friction, color: "#a09191" },
  pumice: { density: 540, friction: 0.8, color: "#827789" },
  silica: { density: 2200, friction: 0.6, color: "#7fffe0" },
  crate: { density: 380, friction: 0.65, color: "#bda873" },
  biomass: { density: 650, friction: 0.65, color: "#85c2a0" },
  circuit: {density:1950,friction:.6,color:"#65b9c5"},
  alloy: {density:3200,friction:.8,color:"#a59976"},
  chitin: { density: 1250, friction: 0.85, color: "#c3a371" },
};
export function chemistry(x: number, z: number, depth: number, seed=42) {
  const mix = Math.exp(-((x - 68) ** 2 + (z - 2) ** 2) / 130);
  const rock=geologicalField(x,z,ground(x,z,seed),0,seed);
  const brine = Math.exp(-((x - 78) ** 2 + (z - 12) ** 2) / 85);
  return {
    temperature: seed<0?planetForSeed(seed).air+800*mix+300*Math.exp(-((x+54)**2+(z-35)**2)/120):14 + (84 * mix) / (1 + depth * 0.25),
    salinity: 35 + 110 * brine,
    pH: 8 - 5 * brine,
    oxygen: 8 * (1 - 0.9 * mix),
    toxicity:seed<0?0:mix*.8*Math.min(1,rock.fracture),
    mineral: mix > 0.2 ? "silica" : "carbonate",
  };
}
export function anchorAcceleration(
  from: V3,
  center: V3,
  sign: number,
  mass: number,
): V3 {
  const x = center.x - from.x,
    y = center.y - from.y,
    z = center.z - from.z;
  const d = Math.sqrt(x * x + y * y + z * z);
  if (d > 28) return { x: 0, y: 0, z: 0 };
  const force = Math.min(70000, 2000000 / (d * d + 9));
  const a = (Math.min(24, force / mass) * sign) / Math.max(d, 1);
  return { x: x * a, y: y * a, z: z * a };
}
export function buoyancy(volume: number, fraction: number, gravity=GRAVITY,density=1026.25) {
  return density * gravity * volume * Math.max(0, Math.min(1, fraction));
}
export function submergedSphereFraction(
  radius: number,
  submergedHeight: number,
) {
  const h = Math.max(0, Math.min(2 * radius, submergedHeight));
  return (h * h * (3 * radius - h)) / (4 * radius ** 3);
}
export type Input = {
  dive?: boolean;
  x: number;
  z: number;
  yaw: number;
  jump: boolean;
  sprint: boolean;
  seq: number;
};
export type Player = V3 & {
  coyote: number;
  jumpBuffer: number;
  airTime: number;
  thrusting: boolean;
  ack: number;
  id: string;
  extractedAt:number|null;
  cabin:import('./cabin').CabinState|null;
  color: number;
  yaw: number;
  vx: number;
  vy: number;
  vz: number;
  fuel: number;
  rechargeDelay: number;
  loaded: boolean;
  minerals: number;
  medicine: number;
  thermalUntil: number;
  cells:number;
  compounds:number;
  medicalAt:number;
  wetness:number;
  coldSeconds:number;
  coldStage:"normal"|"cold"|"severe"|"critical";
  energy: number;
  weaponEnergy: number;
  equipped:1|2|3;
  rifleMode:import("./domain/sampling").RifleMode;
  samples:import("./domain/sampling").GeologicalSample[];
  sampleNotice:string;
  firedAt: number;
  health: number;
  oxygen: number;
  temperature: number;
  canisters: number;
  insulated: boolean;
  alive: boolean;
  participant: boolean;
  ready: boolean;
  diedAt: number | null;
  deathCause: string;
  disconnectedAt: number | null;
  shoveAt: number;
  pushX: number;
  pushZ: number;
  shelter: string | null;
  connected: boolean;
  input: Input;
  lastJump: boolean;
  grounded: boolean;
};
export type Anchor = V3 & { owner: string; sign: number; life: number };
export type ObjectState = V3 & {
  rotation?:{x:number;y:number;z:number;w:number};
  carriedBy?:string|null;
  unitId?:string;
  id: number;
  material: keyof typeof MATERIALS;
  radius: number;
  mass: number;
  active?: boolean;
  vx: number;
  vy: number;
  vz: number;
};
export type Supply = V3 & {
  id: string;
  objectId?: number;
  kind: "coolant" | "oxygen" | "insulation" | "cell" | "mineral" | "bio" | "thermal";
  expires?: number;
  generation?:number;
  respawnAt?:number;
  pickupAfter?:number;
  active?: boolean;
  takenBy: string | null;
};
export type Standing = {
  id: string;
  rank: number;
  time: number;
  cause: string;
  winner: boolean;
};
export type Stalker = V3 & {
  kind: "stalker" | "ridgeback" | "surveyor" | "sentinel" | "ambusher" | "grazer" | "scuttler" | "skimmer";
  generation?:number;
  motionSpeed?:number;
  radius: number;
  dropped: boolean;
  staggerReadyAt: number;
  id: number; health: number; state: "idle" | "patrol" | "suspicious" | "investigate" | "alert" | "chase" | "position" | "windup" | "attack" | "recover" | "search" | "retreat" | "stagger" | "dead";
  until: number; vx: number; vz: number;
  yaw: number; stateSince: number; targetId: string | null; lastKnown: V3 | null;
  lastSeen: number; attackId: number; attackKind: "melee" | "ranged" | "charge";
  nextMelee: number; nextRanged: number; attackDone: boolean;
  home: V3; path: V3[]; diedAt: number | null; damageSeq: number;
};
export type Pulse = { id: number; shooter: string; from: V3; to: V3; hit: boolean; expires: number; normal?:V3;unitId?:string;weak?: boolean; kind?: "miss" | "rock" | "object" | "player" | "creature" | "water" | "sample" | "sample-reject" };
export type BioProjectile = V3 & {kind?:"spore"|"ion"; id: number; owner: number; attackId: number; vx: number; vy: number; vz: number; expires: number };
export type DamageEvent = { id: number; victim: string; source: V3 | null; amount: number; kind: "pulse" | "claw" | "spore" | "arc" | "environment"; attackId: number; time: number };
export type TsunamiEvent={id:number;warningAt:number;triggerAt:number;x:number;z:number;radius:number;amplitude:number;triggered:boolean;sourceVolume:number};
export type FieldCell={moisture:number;salinity:number;sulfide:number;microbes:number;productivity:number};
export type ExtractionState=V3 & {phase:'scheduled'|'announced'|'approaching'|'boarding'|'departing'|'departed';site:V3|null;boarded:string[];opens:number;closes:number;timeline:import('./mission').MissionTimeline};
export type Snapshot = {
  excavations:import("./domain/sampling").Excavation[];
  lava:{version:number;depth:number[];temperature:number[]}|null;
  doors:import('./facility').DoorState[];
  extraction:ExtractionState;
  fields:FieldCell[];
  fieldsVersion:number;
  tsunami:TsunamiEvent|null;
  planet: PlanetId;
  tick: number;
  notice: string;
  noticeId: number;
  physicsMs: number;networkMs:number;networkBytes:number;
  colliderCount: number;
  code: string;
  seed: number;
  time: number;
  status: "ready" | "running" | "finished";
  players: Player[];
  supplies: Supply[];
  winnerIds: string[];
  standings: Standing[];
  practice: boolean;
  result: string;
  anchors: Anchor[];
  objects: ObjectState[];
  stalkers: Stalker[];
  pulses: Pulse[];
  projectiles: BioProjectile[];
  damageEvents: DamageEvent[];
  aiMs: number;
  water: number[];
  currents: number[];
  currentsX: number[];
  host: string;
  volume: number;
};
