import {caveStationAt,caveThermalRise} from './caves';
import {weatherClock,mission} from './mission';
import {doorRecipes,interactionDoor,facility,type DoorState} from './facility';
import {canBoard,type ExtractionState} from "./extraction";
import { Player, Supply, V3, astronomy, chemistry, ground } from "./model";
import { SHELTERS, shelterPlacements, pickupElevation } from "./placement";
export { SHELTERS, shelterPlacements } from "./placement";
import { planetForSeed } from "./planets";
import { weatherAt } from "./climate";
export const MAX_PLAYERS = 4;
export const FINAL_FRONT = 420;
export const HARD_LIMIT = mission().end;
export const EYE_HEIGHT = 0.65;
export const SUIT_COLORS = ["#d9ece4", "#efa85a", "#b8a0e2", "#69bcae"];
export const SPAWNS = [
  { x: -10, z: -95 },
  { x: 10, z: -95 },
  { x: -10, z: -115 },
  { x: 10, z: -115 },
];
export function environment(time: number, seed=42,duration=1800) {
  const shared=weatherAt(time,seed,duration),{storm,front}=shared,physicalTime=time;time=weatherClock(time,duration);
  return {
    ...shared,
    stage:
      time < 150
        ? seed<0?"THE FRACTURE":"THE EBB"
        : time < 285
          ? seed<0?"ASH FRONT":"RISING WATER"
          : time < 420
            ? "STORM APPROACHING"
            : seed<0?"RADIANT FRONT":"THE COLD FRONT",
    warning:
      time >= 420
        ? seed<0?"Radiant heat front. Seek shielding.":"Cold front. Thermal supplies and shelter slow exposure."
        : time >= 360
          ? (seed<0?"Radiant front in ":"Cold front in ") + Math.ceil((420 - time)*duration/540) + "s. Find shelter."
          : time >= 285
            ? "Storm approaching. Leave exposed ridges."
            : astronomy(physicalTime).rising
              ? seed<0?"Ash front approaching. Gather thermal protection.":"Water rising. Find higher ground."
              : seed<0?"Explore basalt faults. Avoid glowing thermal ground.":"The coast is opening. Gather supplies.",
  };
}
export function suppliesFor(seed: number): Supply[] {
  const sites: [number, number, Supply["kind"]][] = [
    [-10, -86, "oxygen"],
    [10, -86, "oxygen"],
    [-10, -124, "oxygen"],
    [10, -124, "oxygen"],
    [-46, -10, "oxygen"],
    [35, 17, "oxygen"],
    [70, -12, "oxygen"],
    [8, 60, "oxygen"],
    [-58, -53, "insulation"],
    [62, -53, "insulation"],
    [-36, -58, "cell"],
    [40, -58, "cell"],
    [-43, 13, "mineral"], [89, -28, "mineral"], [96, 22, "mineral"],
    [64, -7, "thermal"], [-35,-58,"bio"], [8, 68,"cell"],
  ];
  return sites.map(([siteX, siteZ, kind], i) => {const shelter=kind==="insulation"?shelterPlacements(seed)[i===8?0:1]:null;const x=shelter?shelter.x-1.7:siteX,z=shelter?shelter.z-1.2:siteZ;return ({
    id: "s" + i,
    x,
    z,
    y: shelter?shelter.y+.19:pickupElevation(x,z,kind==="oxygen"?.35:.19,seed),
    kind:seed<0&&kind==="oxygen"?"coolant":kind,
    takenBy: null,
  });});
}
export const distance = (a: V3, b: V3) =>
  Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
export function thermalStep(
  core: number,
  ambient: number,
  immersion: boolean,
  wind: number,
  insulated: boolean,
  sheltered: boolean,
  dt: number,
  vent = false,
  activity=0,
  wetness=0,
  boost=false,
) {
  // C_eff dT/dt = metabolic + regulated suit heat - UA(Tcore-Tambient).
  // Watts, joules/kelvin and real game seconds; astronomical time compression is NOT applied to bodies.
  const capacity=140000;
  const conductance =
    (immersion ? 90 : vent ? 60 : 16 * (1 + wind * 0.03)*(1+wetness*.5)) *
    (insulated ? 0.38 : 1) *
    (sheltered ? 0.18 : 1);
  const heat=130+Math.min(1,activity)*220+(core<37?250:core>37.5?-300:0)+(sheltered?(core<37?2400:core>37.4?-1800:0):0)+(boost?(core<37?1800:core>37.3?-1800:0):0);
  const next=core+(heat+(ambient-core)*conductance)*dt/capacity;return ambient<=37?Math.min(37.2,next):next;
}
export function exposure(
  p: Player,
  water: { level: number; depth: number },
  time: number,
  dt: number,
  seed=42,
  duration=1800,
) {
  const e = environment(time,seed,duration),planet=planetForSeed(seed),
    submerged = water.depth > 0.3 && water.level > p.y + EYE_HEIGHT,
    immersed = water.depth > 0.3 && water.level > p.y - 0.3,
    c = chemistry(p.x, p.z, water.depth, seed),
    caveHeat=caveThermalRise(p,seed),
    vent = caveHeat>0||c.temperature > (planet.robotic?planet.air+180:40),
    shelter = !!p.shelter,
    rawAmbient = caveHeat>0?planet.air+caveHeat:vent
      ? c.temperature
      : immersed
        ? Math.max(3, 14 - water.depth * 0.35)
        : e.air;
  const ambient=planet.robotic?38+(rawAmbient-planet.air)/12:rawAmbient;
  p.wetness=Math.max(0,Math.min(1,(p.wetness??0)+dt*(immersed?.25:shelter?-.04:-.009)));
  // Fictional sealed suits recycle respiratory gas in air; submersion disables that system and uses the finite tank.
  if (submerged)
    p.oxygen = Math.max(0, p.oxygen - dt * (p.input.sprint ? 2.8 : 2.2));
  p.temperature = thermalStep(
    p.temperature,
    ambient,
    immersed,
    e.wind,
    p.insulated || p.thermalUntil>time,
    shelter,
    dt,
    vent,
    Math.hypot(p.vx,p.vz)/8,
    p.wetness,
    p.thermalUntil>time,
  );
  p.coldSeconds=p.temperature<33.5?(p.coldSeconds??0)+dt:Math.max(0,(p.coldSeconds??0)-dt*2);
  p.coldStage=p.temperature<33.5&&p.coldSeconds>20?"critical":p.temperature<35?"severe":p.temperature<36?"cold":"normal";
  const drowning = submerged && p.oxygen <= 0 ? 9 : 0,
    hot = Math.max(0, p.temperature - 39.5) * 3,
    corrosive=immersed&&c.pH<4?(4-c.pH)*.35:0,
    cold = p.coldStage==="critical"?Math.min(4,Math.max(0,33.5-p.temperature)*.8):0;
  p.health = Math.max(0, p.health - Math.max(drowning,hot,cold,corrosive) * dt);
  return corrosive>0?"Corrosive brine contact":drowning > 0
    ? "Oxygen depleted"
    : hot > 0
      ? "Thermal exposure"
      : cold > 0
        ? "Hypothermia"
        : "";
}
export function shelterAt(p: Pick<Player, "x" | "y" | "z">, seed: number) {
  return shelterPlacements(seed).find(
    (s) =>
      Math.abs(p.x - s.x) < 2.5 &&
      Math.abs(p.z - s.z) < 2.6 &&
      Math.abs(p.y - (s.y + 1)) < 1.4,
  );
}
export function promptFor(
  p: Player,
  state: { supplies: Supply[]; players: Player[]; seed: number; extraction?:ExtractionState;doors?:DoorState[] },
) {
  const survey=caveStationAt(p,state.seed);if(survey)return "X · Read underground survey "+(survey.id+1);
  if(state.extraction&&canBoard(p,state.extraction))return "X · Board rescue ship";
  const door=interactionDoor(p,state.seed);if(door)return "X · "+(state.doors?.find(s=>s.id===door.id)?.target?"Close compartment door":"Open compartment door");
  const f=facility(state.seed),room=f.rooms.find(r=>Math.hypot(r.x-p.x,r.z-p.z)<2.5&&Math.abs(p.y-f.y-1)<1.5);if(room)return "X · Read "+room.name.toLowerCase()+" record";
  const supply = state.supplies.find((s) => !s.takenBy && s.active!==false && distance(p, s) < 2.7);
  if (supply)
    return (
      (supply.objectId!==3&&supply.kind!=="insulation"&&(supply.kind!=="mineral"||supply.objectId!==undefined)?"Approach to collect · ":"X · Pick up ") +
      (supply.kind === "coolant"?"coolant canister":supply.kind === "oxygen"
        ? "oxygen canister"
        : supply.kind === "insulation"
          ? "thermal liner"
          : supply.kind==="mineral"?"mineral fragment":supply.kind==="bio"?supply.id.startsWith("med-")?"medical kit":"medical organ":supply.kind==="thermal"?"thermal compound":"energy cell")
    );
  const shelter = shelterAt(p, state.seed);
  if (shelter) {
    const occupied = state.players.some(
      (q) => q.id !== p.id && q.alive && q.shelter === shelter.id,
    );
    return occupied
      ? "Shelter occupied"
      : p.shelter
        ? "X · Unseal shelter"
        : "X · Seal shelter · one occupant";
  }
  return "";
}
