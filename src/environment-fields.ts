import {ground,chemistry,geology,type FieldCell} from './model';
import {SCENARIOS,planetForSeed,planetaryScience} from './planets';
import {brineProperties,gasDensity,saturationPressure} from './planet-physics';
import {weatherAt} from './climate';
import type {Water} from './water';
export type {FieldCell} from './model';
/** 17² slow cells, two-second operator split: transport → sources → reaction → habitat.
 * Concentrations are reduced scenario proxies, not a full chemical speciation model. */
export class EnvironmentFields{
  n=17;next=0;cells:FieldCell[];updates=0;
  constructor(public seed:number){this.cells=Array.from({length:289},()=>({moisture:seed<0?0:.4,salinity:seed<0?0:.035,sulfide:0,microbes:0,productivity:seed<0?0:.25}));}
  sample(x:number,z:number){return this.cells[Math.max(0,Math.min(16,Math.round((z+160)/20)))*17+Math.max(0,Math.min(16,Math.round((x+160)/20)))];}
  update(time:number,water:Water,duration=1800){if(time<this.next)return;this.next=time+2;this.updates++;const old=this.cells,weather=weatherAt(time,this.seed,duration),planet=planetForSeed(this.seed);
    this.cells=old.map((cell,k)=>{if(!planet.water)return {...cell,moisture:0,sulfide:0,microbes:0,productivity:0};const x=(k%17)*20-160,z=Math.floor(k/17)*20-160,w=water.sample(x,z),g=geology(x,z,this.seed),c=chemistry(x,z,w.depth,this.seed);
      const upstream=old[Math.max(0,Math.min(16,Math.round((z-w.v*2+160)/20)))*17+Math.max(0,Math.min(16,Math.round((x-w.u*2+160)/20)))];
      const moisture=Math.max(0,Math.min(1,cell.moisture+(w.depth>.05?.3:weather.rain*.025-.008)*(1+g.permeability*1e10)));
      const salinity=w.depth>.05?upstream.salinity*.96+.035*.04:Math.min(.12,cell.salinity+.00002*(1-weather.rain));
      const thermal=Math.max(0,1-Math.abs(c.temperature-25)/40),microbes=Math.min(1,(c.toxicity*.7+moisture*.1)*thermal),sulfide=Math.max(0,Math.min(2,upstream.sulfide*.98+c.toxicity*.04-microbes*.015));
      const photo=weather.solar.daylight*(1-weather.clouds*.8)*moisture*Math.exp(-Math.max(0,w.depth)*.15),productivity=thermal*Math.min(1,photo+microbes*.5)*(1-Math.min(1,sulfide));
      return {moisture,salinity,sulfide,microbes,productivity};});
  }
}
export function localEnvironment(x:number,z:number,time:number,seed:number,water:{depth:number;level:number;u:number;v:number},cell?:FieldCell,duration=1800){
  const p=planetForSeed(seed),s=SCENARIOS[p.id],w=weatherAt(time,seed,duration),g=geology(x,z,seed),c=chemistry(x,z,water.depth,seed),pressure=s.pressurePa*Math.exp(-Math.max(-50,ground(x,z,seed))/planetaryScience(seed).scaleHeight.value),fluid=brineProperties(p.water?c.temperature:w.air,cell?.salinity??s.waterSalinity,pressure);
  return {geology:g,weather:w,chemistry:c,pressure,airDensity:gasDensity(pressure,w.air+273.15,s.molarMass),fluid,moisture:cell?.moisture??g.moisture,sulfide:cell?.sulfide??0,microbes:cell?.microbes??0,productivity:cell?.productivity??(p.water?.25:0),habitable:p.water&&fluid.liquid&&c.temperature<50&&water.depth<2.5};
}
export function organismTraits(seed:number,heavy=false){const p=planetForSeed(seed);return {support:Math.max(.7,Math.min(1.1,Math.sqrt(8/p.gravity))),limbs:6,stance:heavy?1.25:1,metabolism:'Speculative oxygen-using coastal consumer',role:heavy?'Territorial armored grazer and scavenger':'Mobile predator',energySource:'Phototrophic coastal production and hydrothermal chemical gradients',mechanical:p.robotic};}
