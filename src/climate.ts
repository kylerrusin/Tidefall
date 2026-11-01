import {SCENARIOS} from "./planets";
import {weatherClock} from './mission';
import {saturationPressure} from "./planet-physics";
import { TIME_COMPRESSION, astronomy } from "./model";
import { inertialToLocal } from "./sky-math";
import { planetForSeed } from "./planets";
const smooth=(a:number,b:number,v:number)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t);};
/** One accelerated astronomical clock for rotation and lunar motion. */
export function solarState(time:number,seed=42){
  const planet=planetForSeed(seed),phase=time*TIME_COMPRESSION*Math.PI*2/planet.rotation;
  const direction=inertialToLocal({x:-Math.cos(phase),y:-Math.sin(phase),z:0},planet,time*TIME_COMPRESSION);
  const radius=Math.asin(planet.observed.st_rad*6.957e8/(planet.orbit*1.495978707e11)),light=smooth(-radius-.12,radius+.15,direction.y);
  return {direction,elevation:Math.asin(direction.y),daylight:light,night:1-light,angularRadius:radius,physicalTime:time*TIME_COMPRESSION,daySeconds:planet.rotation/TIME_COMPRESSION};
}
export function weatherAt(time:number,seed=42,duration=1800){
  const planet=planetForSeed(seed),solar=solarState(time,seed);
  const t=weatherClock(time,duration),pulse=(a:number,b:number,c:number)=>smooth(a,b,t)*(1-smooth(b,c,t));
  const storm=Math.max(pulse(40,95,155)*.48,pulse(170,255,335)*.8,pulse(345,405,465),pulse(460,510,550)),front=smooth(420,510,t);
  const angle=.7+Math.sin(time*.003+Math.abs(seed)*.01)*.25,wind=3+storm*22+front*12;
  const air=planet.robotic?planet.air+90*storm+160*front:planet.air-solar.night*planet.nightCooling-24*storm-45*front;
  const gases=SCENARIOS[planet.id].gases,condensable='H2O' in gases&&gases.H2O>0,relativeHumidity=condensable?Math.min(.99,gases.H2O*SCENARIOS[planet.id].pressurePa/saturationPressure(air)+.44*storm):0,cloudSaturation=relativeHumidity*saturationPressure(air)/saturationPressure(air-7);
  const clouds=condensable?Math.max(0,Math.min(.96,(cloudSaturation-.85)*1.8)):0;
  return {storm,front,wind,windX:Math.cos(angle)*wind,windZ:Math.sin(angle)*wind,
    pressureAnomaly:-2800*storm,rain:condensable?storm*clouds:0,ash:planet.water?0:storm,clouds,visibility:1-.7*(condensable?clouds:storm),
    air,pressure:SCENARIOS[planet.id].pressurePa,
    surge:planet.water?storm*3+front*4:0,
    sea:planet.water?astronomy(time).level+storm*3+front*4:-100,
    phase:storm<.08?"clear":storm<.5?"building":front>.2?"severe":"organized storm",solar};
}

/** Actual ambient envelope during a nine-minute match; local vents are additional. */
export function ambientRange(seed:number){let min=Infinity,max=-Infinity;for(let t=0;t<=1800;t+=5){const air=weatherAt(t,seed).air;min=Math.min(min,air);max=Math.max(max,air);}return {min:Math.floor(min),max:Math.ceil(max)};}
