import type {Input,Player,V3} from './model';
import {PASSENGER_SEATS,shipAt,shipOffset} from './extraction';
import type {MissionTimeline} from './mission';
export type CabinState=V3&{seat:number|null};
export const cabinWalkingAllowed=(time:number,t:MissionTimeline)=>time<t.launch||time>=t.stable;
export const cabinObstacles=()=>[...PASSENGER_SEATS.map(s=>({...s,sx:.34,sz:.4})),{x:-1.7,z:2.95,sx:.75,sz:.4},{x:1.7,z:2.95,sx:.75,sz:.4}];
/** Swept bounded deck movement in metres; same local controller on server and client. No airborne cabin movement. */
export function cabinClear(x:number,z:number){return x> -2.57&&x<2.57&&z> -3.34&&z<3.33&&!cabinObstacles().some(o=>Math.abs(x-o.x)<o.sx+.31&&Math.abs(z-o.z)<o.sz+.31);}
export function moveCabin(c:CabinState,input:Input,time:number,t:MissionTimeline,dt:number):CabinState{if(c.seat!==null||!cabinWalkingAllowed(time,t))return c;let {x,z}=c;const n=Math.max(1,Math.hypot(input.x,input.z)),dx=input.x/n*2.4*dt,dz=input.z/n*2.4*dt,steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.08));for(let i=0;i<steps;i++){if(cabinClear(x+dx/steps,z))x+=dx/steps;if(cabinClear(x,z+dz/steps))z+=dz/steps;}return {...c,x,z,y:.97};}
export function unseatPosition(seat:number,others:CabinState[]=[]):CabinState|null{const s=PASSENGER_SEATS[seat];for(const [dx,dz]of [[0,.95],[.95,0],[-.95,0],[0,-.95]]){const x=s.x+dx,z=s.z+dz;if(cabinClear(x,z)&&!others.some(p=>Math.hypot(p.x-x,p.z-z)<.65))return {x,y:.97,z,seat:null};}return null;}
export function cabinWorld(c:CabinState,time:number,site:V3,t:MissionTimeline){const ship=shipAt(time,site,t),offset=shipOffset(c,time,t);return {x:ship.x+offset.x,y:ship.y+offset.y,z:ship.z+offset.z};}
export function seatedCabin(seat:number):CabinState{return {...PASSENGER_SEATS[seat],y:.92,z:PASSENGER_SEATS[seat].z+.12,seat};}
export function nearestFreeSeat(c:CabinState,players:Player[],limit=1.55){return PASSENGER_SEATS.map((s,index)=>({index,d:Math.hypot(c.x-s.x,c.z-s.z)})).filter(s=>s.d<limit&&!players.some(p=>p.cabin?.seat===s.index)).sort((a,b)=>a.d-b.d)[0]?.index;}
