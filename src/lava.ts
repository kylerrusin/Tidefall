import {LAVA_N,LAVA_DX,LAVA_X,LAVA_Z} from './domain/world-sites';
export {LAVA_N,LAVA_DX,LAVA_X,LAVA_Z} from './domain/world-sites';
import {ground} from './model';

export const LAVA_PROPERTIES={density:2700,heatCapacity:1200,latentHeat:350000,emissivity:.92,solidus:1150,liquidus:1400,sourceTemperature:1500} as const;
export const solidFraction=(temperature:number)=>Math.max(0,Math.min(1,(1400-temperature)/250));
export function lavaViscosity(temperature:number){const solid=solidFraction(temperature);return Math.min(1e7,.12*Math.exp((1450-temperature)/75)/Math.max(.0001,(1-solid)**3));}
/** Conservative local depth-averaged viscous sheet with advected heat and radiative cooling. Kelvin, metres, seconds. */
export class LavaField{
 readonly bed:Float64Array;readonly depth=new Float64Array(LAVA_N*LAVA_N);readonly temperature=new Float64Array(LAVA_N*LAVA_N).fill(1200);version=0;sourceVolume=0;boundaryVolume=0;initialVolume=0;private accumulator=0;
 constructor(public seed:number,public source=true){this.bed=Float64Array.from(this.depth,(_,k)=>ground(LAVA_X+k%LAVA_N,LAVA_Z+Math.floor(k/LAVA_N),seed));for(let j=0;j<LAVA_N;j++)for(let i=0;i<LAVA_N;i++){const r=Math.hypot(i-16,j-16),k=j*LAVA_N+i;if(r<5.5){this.depth[k]=Math.max(0,.38*(1-r/5.5));this.temperature[k]=1470;}}this.initialVolume=this.volume();}
 volume(){return this.depth.reduce((sum,h)=>sum+h,0)*LAVA_DX**2;}
 advance(dt:number){this.accumulator+=dt;while(this.accumulator>=.25){this.substep(.125);this.substep(.125);this.accumulator-=.25;this.version++;}}
 private substep(dt:number){const d=this.depth,t=this.temperature,n=LAVA_N,delta=new Float64Array(d.length),energy=new Float64Array(d.length);for(let k=0;k<d.length;k++)energy[k]=d[k]*t[k];
  const transfer=(a:number,b:number)=>{const gradient=(this.bed[a]+d[a]-this.bed[b]-d[b])/LAVA_DX,from=gradient>0?a:b,to=gradient>0?b:a,h=d[from];if(h<.0001)return;const q=Math.min(h*.12,Math.abs(gradient)*22.32*h**3/(3*lavaViscosity(t[from]))*dt/LAVA_DX);delta[from]-=q;delta[to]+=q;energy[from]-=q*t[from];energy[to]+=q*t[from];};
  for(let j=0;j<n;j++)for(let i=0;i<n;i++){const k=j*n+i;if(i+1<n)transfer(k,k+1);if(j+1<n)transfer(k,k+n);}
  for(let k=0;k<d.length;k++){d[k]=Math.max(0,d[k]+delta[k]);if(d[k]>.000001)t[k]=energy[k]/d[k];if(this.source&&Math.hypot(k%n-16,Math.floor(k/n)-16)<1.4){const added=.018*dt;const mass=d[k];t[k]=(mass*t[k]+added*1500)/(mass+added);d[k]+=added;this.sourceVolume+=added;}
   if(d[k]>.000001){const cp=1200+(t[k]>1150&&t[k]<1400?350000/250:0),radiation=.92*5.670374419e-8*(t[k]**4-550**4);t[k]=Math.max(550,t[k]-radiation*dt/(2700*cp*Math.max(.03,d[k])));}
  }
 }
 sample(x:number,z:number){const i=Math.round((x-LAVA_X)/LAVA_DX),j=Math.round((z-LAVA_Z)/LAVA_DX);if(i<0||j<0||i>=LAVA_N||j>=LAVA_N)return {depth:0,temperature:550,level:-Infinity,solid:1};const k=j*LAVA_N+i;return {depth:this.depth[k],temperature:this.temperature[k],level:this.bed[k]+this.depth[k],solid:solidFraction(this.temperature[k])};}
 snapshot(){return {version:this.version,depth:Array.from(this.depth,h=>Math.round(h*1000)/1000),temperature:Array.from(this.temperature,t=>Math.round(t))};}
}
