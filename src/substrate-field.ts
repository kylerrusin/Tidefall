import {CAVE_OPENING} from './cave-opening';
import {geologicalField,geologicalNoise as noise} from './geological-fields';
import {LANDER,SITES,SHELTERS,FACILITY_SITES,EXTRACTION_SITES,GEOLOGY_REFERENCES,LAVA_N,LAVA_DX,LAVA_X,LAVA_Z} from './domain/world-sites';
import type {SubstrateField,SubstrateSite,RockFamily} from './domain/substrate';
export const SUBSTRATE_CHUNK_SIZE=40,SUBSTRATE_CHUNKS=8,SUBSTRATE_CELL=16;
export const smooth=(a:number,b:number,v:number)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t);};
export function substrateHash(seed:number,x:number,z:number){let a=Math.imul((x|0)^seed,374761393)^Math.imul(z|0,668265263);a=Math.imul(a^(a>>>13),1274126177);return ((a^(a>>>16))>>>0)/4294967296;}
const box=(x:number,z:number,cx:number,cz:number,hx:number,hz:number)=>Math.hypot(Math.max(0,Math.abs(x-cx)-hx),Math.max(0,Math.abs(z-cz)-hz));
/** Authored access and active-fluid beds remain intact, with a local feathered margin. */
export function substrateClearance(x:number,z:number,seed:number){
 const f=seed<0?FACILITY_SITES.volcanic:FACILITY_SITES.marine;
 let distance=Math.min(Math.hypot(x-LANDER.x,z-LANDER.z)-22,box(x,z,f.x,f.z,seed<0?20:12,seed<0?24:21),box(x,z,f.x,f.z-(seed<0?31:23),4,seed<0?11:5));
 distance=Math.min(distance,box(x,z,CAVE_OPENING.x,CAVE_OPENING.z,6,11));
 for(const site of SITES)distance=Math.min(distance,Math.hypot(x-site.x,z-site.z)-(site.kind==='cavern'?14:site.kind==='vent'?17:9));
 for(const site of SHELTERS)distance=Math.min(distance,Math.hypot(x-site.x,z-site.z)-9);
 for(const [cx,cz]of EXTRACTION_SITES)distance=Math.min(distance,Math.hypot(x-cx,z-cz)-7);
 for(const site of GEOLOGY_REFERENCES)distance=Math.min(distance,Math.hypot(x-site.x,z-site.z)-7);
 if(seed<0){const half=(LAVA_N-1)*LAVA_DX/2;distance=Math.min(distance,box(x,z,LAVA_X+half,LAVA_Z+half,half+9,half+9));}
 return smooth(0,9,distance);
}
const fieldCache=new Map<number,SubstrateField>();
/** A single world lattice owns features; chunks group shared world-coordinate records. */
export function createSubstrateField(seed:number,sampleBase:(x:number,z:number,seed:number)=>number):SubstrateField{
 const cached=fieldCache.get(seed);if(cached)return cached;
 const sites:SubstrateSite[]=[],bins=new Map<string,SubstrateSite[]>();let id=0;
 for(let j=0;j<20;j++)for(let i=0;i<20;i++){
  const h=(salt:number)=>substrateHash(seed+salt,i,j),x=-152+i*16+(h(11)-.5)*9,z=-152+j*16+(h(12)-.5)*9,base=sampleBase(x,z,seed),sx=(sampleBase(x+2,z,seed)-sampleBase(x-2,z,seed))/4,sz=(sampleBase(x,z+2,seed)-sampleBase(x,z-2,seed))/4,g=geologicalField(x,z,base,Math.hypot(sx,sz),seed),clear=substrateClearance(x,z,seed);
  const exposure=Math.max(.12,Math.min(1,g.weights.basalt*.95+g.weights.carbonate*.92+g.weights.regolith*.58+g.weights.sediment*.16)),weathering=g.appearance.inputs.weathering;
  if(clear<.85)continue;
  const choose=h(17);let family:RockFamily;
  if(seed<0)family=choose<.70?'volcanic':choose<.94?'fractured':'tower';
  else if(g.weights.carbonate>.4)family=choose<.34?'stratified':choose<.60?'shelf':choose<.90?'rounded':'tower';
  else if(g.weights.basalt>.4)family=choose<.50?'fractured':choose<.82?'rounded':'stratified';
  else family=choose<.70?'rounded':'fractured';
  if(exposure<.3&&h(18)<.45)continue;
  const wide=exposure>.5?3.2+h(21)*3.7:1.4+h(21)*1.4,height=family==='tower'?4.5+h(22)*5:family==='volcanic'?1.3+h(22)*2.4:1.8+h(22)*3.5;
  const unitId=seed<0?(family==='tower'?'TDF-LT-033':family==='volcanic'?'TDF-LT-035':'TDF-LT-032'):g.appearance.bedrockId;
  const principal:SubstrateSite={id:id++,x,z,family,variant:Math.floor(h(23)*6),strike:g.strike+(noise(x/65,z/70,seed+24)-.5)*.6,sx:family==="tower"?wide*.43:wide,sy:height*Math.max(.22,exposure),sz:wide*(family==="tower"?.42:.65+h(25)*.8),exposure,weathering,unitId,chunkX:Math.min(7,Math.max(0,Math.floor((x+160)/40))),chunkZ:Math.min(7,Math.max(0,Math.floor((z+160)/40))),fragment:false};
  const edge=Math.max(.35,(157-Math.max(Math.abs(x),Math.abs(z)))/2.1);principal.sx=Math.min(principal.sx,edge);principal.sz=Math.min(principal.sz,edge);
  for(let pass=0;pass<5;pass++){const c=Math.cos(principal.strike),s=Math.sin(principal.strike);let valid=true;for(let j=-2;j<=2;j++)for(let i=-2;i<=2;i++){const dx=i*principal.sx,dz=j*principal.sz;if(substrateClearance(x+dx*c+dz*s,z-dx*s+dz*c,seed)<.55)valid=false;}if(valid)break;principal.sx*=.7;principal.sz*=.7;}
  if(principal.sx<.7||principal.sz<.7)continue;
  sites.push(principal);
  for(let k=0;k<(exposure>.55?2:1);k++){if(seed>=0&&h(71+k)>(exposure>.7?.67:.53))continue;const a=principal.strike+(k?2.25:-.65),r=wide*(1.15+h(31+k)*.35),px=x+Math.cos(a)*r,pz=z+Math.sin(a)*r;if(Math.abs(px)>155||Math.abs(pz)>155||substrateClearance(px,pz,seed)<.95)continue;sites.push({...principal,id:id++,x:px,z:pz,family:seed<0?'volcanic':'fractured',variant:Math.floor(h(41+k)*6),sx:wide*.34,sy:Math.min(.35,height*.12),sz:wide*.3,strike:principal.strike+.2*(h(43+k)-.5),fragment:true,chunkX:Math.min(7,Math.max(0,Math.floor((px+160)/40))),chunkZ:Math.min(7,Math.max(0,Math.floor((pz+160)/40)))});}
 }
 for(const site of sites){const radius=Math.hypot(site.sx,site.sz)*1.7+5;for(let z=Math.floor((site.z-radius)/16);z<=Math.floor((site.z+radius)/16);z++)for(let x=Math.floor((site.x-radius)/16);x<=Math.floor((site.x+radius)/16);x++){const key=x+':'+z,list=bins.get(key)??[];list.push(site);bins.set(key,list);}}
 const field={seed,sites,bins};fieldCache.set(seed,field);if(fieldCache.size>8)fieldCache.delete(fieldCache.keys().next().value!);return field;
}
export function substrateReliefAt(x:number,z:number,field:SubstrateField){
 const clear=substrateClearance(x,z,field.seed);if(!clear)return 0;let relief=0;
 for(const site of field.bins.get(Math.floor(x/16)+':'+Math.floor(z/16))??[]){if(site.fragment)continue;const dx=x-site.x,dz=z-site.z,c=Math.cos(site.strike),s=Math.sin(site.strike),u=(dx*c-dz*s)/(site.sx*1.9),v=(dx*s+dz*c)/(site.sz*1.9),q=u*u+v*v;if(q>=1)continue;const t=Math.max(0,(Math.sqrt(q)-.4)/.6),envelope=1-t*t*t*(10-15*t+6*t*t);let profile:number;
  if(site.family==='stratified'||site.family==='shelf')profile=.35+.6*smooth(-.7,-.35,v+u*.2)+.75*smooth(-.1,.15,v+u*.17)-.4*Math.exp(-(((u-.2-v*.2)/.15)**2));
  else if(site.family==='fractured')profile=Math.max(0,1-Math.abs(u+.25*v)*1.1-Math.abs(v)*.45)-.2*Math.exp(-(((u-.18)/.13)**2));
  else if(site.family==='volcanic')profile=.55*smooth(-.6,-.3,v+u*.3)+.5*smooth(.08,.3,v-u*.15)-.2*Math.exp(-(((u+.2*v)/.12)**2));
  else profile=Math.max(0,1-(u+.13*v)**2*1.3-v*v*.8)+.25*Math.exp(-(((u+.4)/.3)**2));
  relief=Math.max(relief,profile*envelope*Math.min(2.7,site.sy*.5));
 }
 return (relief+(noise(x/21,z/26,field.seed+310)-.5)*.28)*clear;
}
