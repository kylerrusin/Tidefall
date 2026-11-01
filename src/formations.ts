import {worldSubstrate,ground} from './model';
import {substrateData,substrateBodyMesh,substrateSurface} from './geological-substrate';
import {ROCK_FAMILIES,type SubstrateSite} from './domain/substrate';
export const FORMATION_TYPES=ROCK_FAMILIES;
export type Formation=SubstrateSite&{kind:SubstrateSite['family'];width:number;length:number;height:number};
/** Compatibility names now resolve the global substrate, never a second overlaid surface. */
export const formations=(seed:number):Formation[]=>worldSubstrate(seed).sites.filter(s=>!s.fragment).map(s=>({...s,kind:s.family,width:s.sx,length:s.sz,height:s.sy}));
export const formationMesh=(f:Formation,seed:number,lod=0)=>substrateBodyMesh(substrateData(seed).bodies.find(b=>b.site.id===f.id)!,lod);
export const formationSurface=substrateSurface;
export function formationContactBlend(x:number,y:number,z:number,seed:number){const t=Math.max(0,Math.min(1,(y-ground(x,z,seed)-.02)/.83));return t*t*(3-2*t);}
