import { weatherAt } from "./climate";
import { planetForSeed } from "./planets";
export const WAVES = [
  {x:.8,z:.6,length:22,weight:.55,phase:.2},
  {x:-.6,z:.8,length:11,weight:.3,phase:1.7},
  {x:.979804,z:-.19996,length:5.5,weight:.18,phase:3.1},
  {x:.301131,z:.953583,length:2.7,weight:.08,phase:4.6},
] as const;
/** Incoming carriers keep a fixed reference frequency. Multiplying changing local
 * dispersion by the absolute match clock rephased the entire wave at each snapshot.
 * Local depth still controls shoaling amplitude, shared by rendering and contact.
 * Linear finite-depth wind waves over the numerical mean surface. Amplitude
 * shoals to zero in shallow cells; oscillatory velocities drive local drag. */
export function waveAt(x:number,z:number,time:number,depth:number,seed=42,duration=1800){
  const planet=planetForSeed(seed),wind=weatherAt(time,seed,duration).wind;
  let height=0,sx=0,sz=0,u=0,v=0,vertical=0;
  if(!planet.water||depth<=.025)return {height,sx,sz,u,v,vertical};
  const attenuation=Math.min(1,depth/3),scale=(.1+wind*.035)*attenuation;
  for(const w of WAVES){
    const k=2*Math.PI/w.length,omega=Math.sqrt(planet.gravity*k*Math.tanh(k*3));
    const angle=k*(w.x*x+w.z*z)-omega*time+w.phase+Math.abs(seed)*.037,a=scale*w.weight;
    height+=a*Math.cos(angle);sx-=a*k*w.x*Math.sin(angle);sz-=a*k*w.z*Math.sin(angle);
    u+=a*omega*w.x*Math.cos(angle);v+=a*omega*w.z*Math.cos(angle);vertical+=a*omega*Math.sin(angle);
  }
  return {height,sx,sz,u,v,vertical};
}
export function waveContact(base:{level:number;depth:number;u:number;v:number},x:number,z:number,time:number,seed:number,duration=1800){
  const wave=waveAt(x,z,time,base.depth,seed,duration);
  return {level:base.level+wave.height,depth:Math.max(0,base.depth+wave.height),u:base.u+wave.u,v:base.v+wave.v,vertical:wave.vertical};
}
/** Generated from the same component table used by authoritative contact queries. */
export const WAVE_GLSL=`vec3 sharedWaves(vec2 p,float depth,float t,float wind,float gravity,float seed){
vec3 result=vec3(0.);float scale=(.1+wind*.035)*min(1.,max(0.,depth)/3.);
${WAVES.map(w=>`{float k=${(2*Math.PI/w.length).toFixed(9)};float e=exp(2.*min(8.,k*3.));float omega=sqrt(gravity*k*(e-1.)/(e+1.));float theta=k*dot(p,vec2(${w.x},${w.z}))-omega*t+${w.phase}+abs(seed)*.037;float a=scale*${w.weight};result+=vec3(a*cos(theta),-a*k*${w.x}*sin(theta),-a*k*${w.z}*sin(theta));}`).join("\n")}
return result;}`;
