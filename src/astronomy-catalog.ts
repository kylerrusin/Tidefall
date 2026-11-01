import catalog from "./data/stars.json";
import neighbors from "./data/neighbors.json";
import { planetForSeed } from "./planets";
import { equatorialPosition, inertialToLocal } from "./sky-math";
import { TIME_COMPRESSION, type V3 } from "./model";
export type SkyObject={id:string;name:string;type:string;direction:V3;magnitude:number;distancePc?:number;note:string;colorIndex:number|null;phase?:number;angularRadius?:number;illumination?:V3};
export const skySelection:{current:SkyObject|null;scanner:boolean}={current:null,scanner:false};
const cache=new Map<number,Omit<SkyObject,"direction">[]&{vectors?:V3[]}>();
const normalize=(p:V3)=>{const length=Math.hypot(p.x,p.y,p.z);return {x:p.x/length,y:p.y/length,z:p.z/length};};
/** Static catalog displacement/proper-motion calculation is done once per observing world. */
export function observedCatalog(seed:number){
  const key=seed<0?-1:1,existing=cache.get(key);if(existing)return existing;
  const planet=planetForSeed(seed),host=planet.observed,hostStar=planet.robotic?catalog.records.find(s=>s.hip===43587):undefined;
  const observer=hostStar?{x:hostStar.position[0]+hostStar.velocity[0]*26,y:hostStar.position[1]+hostStar.velocity[1]*26,z:hostStar.position[2]+hostStar.velocity[2]*26}:equatorialPosition(host.ra,host.dec,host.sy_dist);
  const result:Omit<SkyObject,"direction">[]&{vectors?:V3[]}=[];result.vectors=[];
  for(const star of catalog.records){
    if(planet.robotic&&star.hip===43587)continue;
    const p={x:star.position[0]+star.velocity[0]*26-observer.x,y:star.position[1]+star.velocity[1]*26-observer.y,z:star.position[2]+star.velocity[2]*26-observer.z},distance=Math.hypot(p.x,p.y,p.z);if(distance<1e-5)continue;
    result.push({id:star.id,name:star.name,type:"Catalog star",magnitude:star.absoluteMagnitude+5*Math.log10(distance/10),distancePc:distance,colorIndex:star.colorIndex,note:`${star.hip?"HIP "+star.hip:star.id} · HYG 4.1, epoch 2000 propagated to 2026. Distance uncertainty unavailable; host displacement uses catalog/Archive coordinates. Radial-velocity completeness is limited.`});result.vectors.push(normalize(p));
  }
  cache.set(key,result);return result;
}
export function catalogAt(seed:number,time:number){const records=observedCatalog(seed),planet=planetForSeed(seed);return records.map((star,i)=>({...star,direction:inertialToLocal(records.vectors![i],planet,time*TIME_COMPRESSION)}));}
/** Gray Lambert sphere, zero inclination and explicitly assumed initial orbital phase. */
export function neighboringPlanet(seed:number,time:number):SkyObject|null{
  const p=planetForSeed(seed),body=neighbors.records.find(b=>b.hostname===p.observed.hostname);if(!body||!body.pl_rade||!body.pl_orbsmax||!body.pl_orbper)return null;
  const t=time*TIME_COMPRESSION,phase=t*2*Math.PI/body.pl_orbper/86400+1.2,observerPhase=t*2*Math.PI/p.rotation;
  const bx=body.pl_orbsmax*Math.cos(phase),by=body.pl_orbsmax*Math.sin(phase),ox=p.orbit*Math.cos(observerPhase),oy=p.orbit*Math.sin(observerPhase),dx=bx-ox,dy=by-oy,d=Math.hypot(dx,dy);
  const cosAlpha=Math.max(-1,Math.min(1,(-bx*(ox-bx)-by*(oy-by))/(body.pl_orbsmax*d))),alpha=Math.acos(cosAlpha),lit=(Math.sin(alpha)+(Math.PI-alpha)*Math.cos(alpha))/Math.PI;
  const flux=p.observed.luminosity/body.pl_orbsmax**2*.3*lit*(body.pl_rade*6.371e6/(d*1.495978707e11))**2;
  return {id:body.pl_name,name:body.pl_name,type:"Neighboring exoplanet",direction:inertialToLocal(normalize({x:dx,y:dy,z:0}),p,t),magnitude:-26.74-2.5*Math.log10(Math.max(1e-20,flux)),phase:(1+cosAlpha)/2,angularRadius:Math.asin(body.pl_rade*6.371e6/(d*1.495978707e11)),illumination:inertialToLocal(normalize({x:-bx,y:-by,z:0}),p,t),colorIndex:.7,note:"Measured orbit; catalog radius (55 Cnc b may be estimated); assumed albedo 0.3, circular coplanar orbit and initial phase. Gray optical brightness approximation, not a measured ephemeris."};
}
export function opticalMagnitude(star:SkyObject,daylight:number,opticalDepth:number,clouds:number){return star.magnitude+1.086*opticalDepth/Math.max(.08,star.direction.y)+clouds*4+daylight*10;}
export function selectCelestial(objects:SkyObject[],forward:V3,daylight:number,opticalDepth:number,clouds:number,scanner=false){
  if(forward.y<0)return null;let best:SkyObject|null=null,score=(scanner?2:1.25)*Math.PI/180;
  for(const star of objects){if(star.direction.y< -Math.sin(star.angularRadius??0)||(!scanner&&opticalMagnitude(star,daylight,opticalDepth,clouds)>6.2))continue;
    const dot=star.direction.x*forward.x+star.direction.y*forward.y+star.direction.z*forward.z,angle=Math.max(0,Math.acos(Math.max(-1,Math.min(1,dot)))-(star.angularRadius??0));if(angle<score){score=angle;best=star;}}
  return best;
}
export const GALACTIC_NORTH={x:-.867666,y:-.198076,z:.455984}; // IAU J2000 north Galactic pole
