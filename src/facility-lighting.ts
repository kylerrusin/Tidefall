import {facility} from './facility';
export function facilityLights(seed:number){const f=facility(seed),height=seed<0?3.94:3.04;return [...f.rooms.map(r=>({x:r.x,y:f.y+height,z:r.z,angle:seed<0?.82:.68,distance:seed<0?9:4.2,power:seed<0?45:20})),...[-12,0,12].map(z=>({x:f.x,y:f.y+height,z:f.z+z,angle:seed<0?.6:.45,distance:seed<0?9:4.2,power:seed<0?55:26}))];}
export function insideFacility(p:{x:number;y:number;z:number},seed:number){const f=facility(seed);return Math.abs(p.x-f.x)<(seed<0?18:10)&&Math.abs(p.z-f.z)<(seed<0?22:19)&&p.y>=f.y&&p.y<f.y+(seed<0?4.35:3.35);}
/** Volcanic darkness needs useful close-range light; retain marine attenuation unchanged. */
export function suitLampPower(distance:number,indoor:boolean,seed=42){const base=Math.min(1,(Math.max(.05,distance-.2)/8)**2);return seed<0?Math.max(.65,base):Math.max(.0005,base)*(indoor?.32:1);}
