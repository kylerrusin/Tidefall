import {GEOLOGY} from './geological-catalog';
import {geologicalNoise} from './geological-fields';
/** Renderer-only palette derived from the existing weathered regolith/sandstone.
 * Catalog identities and physical properties retain their original meaning. */
export function regionalPalette(source:readonly number[],seed:number,x:number,z:number,cover=0){
 const a=GEOLOGY[seed<0?'TDF-LT-031':'TDF-SD-016'].color,b=GEOLOGY[seed<0?'TDF-LT-032':'TDF-LT-046'].color;
 const mean=source.reduce((s,v)=>s+v,0)/3,variation=Math.max(-.045,Math.min(.045,(mean-.48)*.14)),regional=(geologicalNoise(x/90,z/90,Math.abs(seed)+19)-.5)*.035;
 return a.map((v,i)=>Math.max(.02,Math.min(.85,v*.7+b[i]*.3+variation+regional+Math.min(1,Math.max(0,cover))*.018+(source[i]-mean)*.12)));
}
