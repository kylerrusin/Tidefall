import {SHELTERS} from './domain/world-sites';
export {SHELTERS} from './domain/world-sites';
import { solidHeight } from "./surface-query";


export type StructuralPart={seatCollider?:boolean;rx?:number;x:number;y:number;z:number;sx:number;sy:number;sz:number;role?:"foundation"|"floor"|"wall"|"roof"|"glass"|"door"};
const cache=new Map<number,ReturnType<typeof buildShelters>>();
export function footprint(x:number,z:number,half:number,seed:number){
  const heights:number[]=[];for(let j=-2;j<=2;j++)for(let i=-2;i<=2;i++)heights.push(solidHeight(x+i*half/2,z+j*half/2,seed));
  return {min:Math.min(...heights),max:Math.max(...heights),range:Math.max(...heights)-Math.min(...heights)};
}
function buildShelters(seed:number){return SHELTERS.map(site=>{
  let chosen:{x:number;z:number;min:number;max:number;range:number}={x:site.x,z:site.z,...footprint(site.x,site.z,3.2,seed)},score=Infinity;
  for(let ring=0;ring<=12;ring++)for(let i=0;i<(ring?12:1);i++){
    const x=site.x+Math.cos(i*Math.PI/6)*ring*3,z=site.z+Math.sin(i*Math.PI/6)*ring*3,f=footprint(x,z,3.2,seed),cost=f.range+ring*.16;
    if(f.range<=2.8&&cost<score){chosen={x,z,...f};score=cost;}
  }
  if(!Number.isFinite(score))throw new Error(`No supported shelter site for ${site.id}`);
  const {x,z}=chosen,supportMax=Math.max(...[-1,1].flatMap(a=>[-1,1].map(b=>footprint(x+a*2.65,z+b*2.65,.38,seed).max))),y=Math.max(chosen.max,supportMax)+.22,parts:StructuralPart[]=[
    {x,y:y-.15,z,sx:3.1,sy:.15,sz:3.1,role:"floor"},
    {x,y:y+3.3,z,sx:3.1,sy:.25,sz:3.1,role:"roof"},
    {x,y:y+1.5,z:z+3,sx:3.1,sy:1.5,sz:.2,role:"wall"},
    ...[-1,1].map(sign=>({x:x+sign*3,y:y+1.5,z,sx:.2,sy:1.5,sz:3.1,role:"wall" as const})),
  ];
  const entry=footprint(x,z-6.3,1.2,seed).max+.1;
  for(let j=0;j<10;j++){const pz=z-3.1-(j+.5)*.32,top=y-(y-entry)*(j+.5)/10,bottom=footprint(x,pz,1.2,seed).min-.12;if(top>bottom+.06)parts.push({x,y:(top+bottom)/2,z:pz,sx:1.2,sy:(top-bottom)/2,sz:.165,role:"foundation"});}
  const supports=[-1,1].flatMap(a=>[-1,1].map(b=>{
    const px=x+a*2.65,pz=z+b*2.65,f=footprint(px,pz,.38,seed),bottom=f.min-.18,top=y-.1;
    parts.push({x:px,y:(bottom+top)/2,z:pz,sx:.38,sy:(top-bottom)/2,sz:.38,role:"foundation"});
    return {x:px,z:pz,bottom,top,groundMin:f.min,groundMax:f.max};
  }));
  return {...site,x,z,y,range:chosen.range,supports,parts};
});}
export function shelterPlacements(seed:number){let result=cache.get(seed);if(!result){result=buildShelters(seed);cache.set(seed,result);if(cache.size>8)cache.delete(cache.keys().next().value!);}return result;}
/** A small axis-aligned pickup rests on its complete support footprint. */
export function pickupElevation(x:number,z:number,halfHeight:number,seed:number){return footprint(x,z,.26,seed).max+halfHeight-.015;}
