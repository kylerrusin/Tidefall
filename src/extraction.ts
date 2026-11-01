import {EXTRACTION_SITES} from './domain/world-sites';
import {surfaceAt,type V3,type ExtractionState} from './model';
import {mission,type MissionTimeline} from './mission';
import {footprint,type StructuralPart} from './placement';
import type {Water} from './water';
export const RESCUE=mission();
export const PASSENGER_SEATS=[{x:-2.2,z:-.9},{x:-1,z:1},{x:1,z:-.9},{x:2.2,z:1}] as const;
export const passengerSeat=(color:number):V3=>({...PASSENGER_SEATS[Math.max(0,Math.min(3,color|0))],y:1.4,z:PASSENGER_SEATS[Math.max(0,Math.min(3,color|0))].z+.12});
export type {ExtractionState} from './model';
export const initialExtraction=(timeline=RESCUE):ExtractionState=>({x:0,y:190,z:-105,phase:'scheduled',site:null,boarded:[],opens:timeline.land,closes:timeline.close,timeline});
export function landingCandidates(seed:number,water:Water){return EXTRACTION_SITES.map(([x,z])=>{const f=footprint(x,z,4.5,seed);return {x,z,y:f.max+1.1,range:f.range};}).filter(p=>p.range<2.4&&surfaceAt(p.x,p.z,seed).slope<.3&&water.sample(p.x,p.z).depth<.1);}
const ease=(v:number)=>{const t=Math.max(0,Math.min(1,v));return t*t*t*(t*(t*6-15)+10);};
/** C² continuous scripted cinematic trajectory, not a spacecraft dynamics simulation. */
export function shipAt(time:number,site:V3,t:MissionTimeline=RESCUE):V3{const mid=(t.approach+t.land)/2;if(time<mid){const a=ease((time-t.approach)/(mid-t.approach));return {x:site.x-180*(1-a),z:site.z,y:190};}if(time<t.close)return {...site,y:190+(site.y-190)*ease((time-mid)/(t.land-mid))};const a=ease((time-t.launch)/(t.orbit-t.launch));return {x:site.x+160*a,y:site.y+900*a,z:site.z+60*a};}
export function flightState(time:number,t:MissionTimeline=RESCUE){return {hatch:1-ease((time-t.close)/Math.max(2,(t.launch-t.close)*.7)),gear:1-ease((time-t.launch)/5),orbit:ease((time-t.launch)/(t.orbit-t.launch)),altitude:320000*ease((time-t.launch)/(t.orbit-t.launch)),pitch:.32*ease((time-t.launch)/(t.orbit-t.launch))};}
export function shipOffset(p:V3,time:number,t:MissionTimeline=RESCUE){const pitch=flightState(time,t).pitch,c=Math.cos(pitch),s=Math.sin(pitch);return {x:p.x,y:p.y*c-p.z*s,z:p.y*s+p.z*c};}
export function shipRotation(time:number,t:MissionTimeline=RESCUE,localPitch=0){const half=(flightState(time,t).pitch+localPitch)/2;return {x:Math.sin(half),y:0,z:0,w:Math.cos(half)};}
/** Hinged at the lintel; the panel stays attached while opening outward. */
export function hatchPose(time:number,t:MissionTimeline=RESCUE){const rx=flightState(time,t).hatch*Math.PI/2;return {x:0,y:2.6-1.3*Math.cos(rx),z:-3.8-1.3*Math.sin(rx),rx};}
/** Same solid hull/ramp cuboids in physics and rendering; coordinates relative to deck. */
export function shipParts(ramp=true):StructuralPart[]{return [
 ...PASSENGER_SEATS.flatMap(s=>[{x:s.x,y:.5,z:s.z,sx:.31,sy:.15,sz:.35,role:"wall" as const,seatCollider:true},{x:s.x,y:1,z:s.z-.24,sx:.31,sy:.425,sz:.1,role:"wall" as const,seatCollider:true}]),
 {x:0,y:-.2,z:0,sx:3.2,sy:.2,sz:4,role:'floor'},{x:0,y:2.8,z:0,sx:3.2,sy:.2,sz:4,role:'roof'},
 ...[-1,1].flatMap(sign=>[{x:sign*3,y:.35,z:0,sx:.2,sy:.35,sz:4,role:'wall' as const},{x:sign*3,y:2.5,z:0,sx:.2,sy:.3,sz:4,role:'wall' as const},{x:sign*3,y:1.55,z:0,sx:.08,sy:.85,sz:3.8,role:'glass' as const},...[-3.7,-.8,2.2,3.7].map(z=>({x:sign*3,y:1.5,z,sx:.22,sy:1.3,sz:.1,role:'wall' as const}))]),
 {x:0,y:1.55,z:3.8,sx:2.8,sy:.85,sz:.08,role:'glass'},{x:0,y:.3,z:3.8,sx:3.2,sy:.3,sz:.2,role:'wall'},{x:0,y:2.55,z:3.8,sx:3.2,sy:.25,sz:.2,role:'wall'},
 ...[-1,1].map(x=>({x:x*2.45,y:1.3,z:-3.8,sx:.55,sy:1.3,sz:.2,role:'wall' as const})),{x:0,y:1.3,z:-3.8,sx:1.8,sy:1.3,sz:.13,role:'door'},
 ...(ramp?[{x:0,y:-.65,z:-6.65,sx:1.6,sy:.1,sz:2.65,rx:-Math.atan(.22),role:'foundation' as const}]:[])];}
export const canBoard=(p:V3,ship:ExtractionState)=>ship.phase==='boarding'&&!!ship.site&&Math.abs(p.x-ship.site.x)<2.6&&p.z>ship.site.z-3.3&&p.z<ship.site.z+3.5&&Math.abs(p.y-ship.site.y)<3;
