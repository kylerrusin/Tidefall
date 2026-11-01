import {GEOLOGY,type GeoUnit} from './geological-catalog';
import {unitNormal,type Normal3} from './triplanar';
export const smoothMaterial=(a:number,b:number,x:number)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
export type SurfaceInputs={deposition:number;weathering:number;competence:number};
export function surfaceWeights(normal:Normal3,input:SurfaceInputs,microheight=.5){normal=unitNormal(normal);const slopeAngle=Math.acos(Math.max(-1,Math.min(1,normal.y))),exposure=Math.max(smoothMaterial(20*Math.PI/180,50*Math.PI/180,slopeAngle)*clamp(input.competence),smoothMaterial(50*Math.PI/180,65*Math.PI/180,slopeAngle));let cover=clamp(clamp(input.deposition)*(1-.92*exposure)+clamp(input.weathering)*.16*(1-.75*exposure));cover=clamp(cover+(.5-clamp(microheight))*.14*(1-Math.abs(cover*2-1)));const exposed=1-smoothMaterial(.1,.44,cover),sediment=smoothMaterial(.52,.86,cover),weathered=Math.max(0,1-exposed-sediment),sum=exposed+weathered+sediment;return {exposed:exposed/sum,weathered:weathered/sum,sediment:sediment/sum,cover,slopeAngle};}
/** Existing surface units remain intact; loose cover does not become the underlying bedrock. */
export function bedrockForSurface(unit:GeoUnit,weights:{basalt:number;carbonate:number;sediment?:number},x=0,z=0){
 if(unit.id==='TDF-SD-016')return GEOLOGY['TDF-LT-034'];
 if((unit.family==='alteration'||unit.family==='mineral')&&(Math.hypot(x-68,z-2)<18||unit.id==='TDF-AL-009'))return unit;
 // Parent provinces and broad strike-aligned flows, rather than the 2.6 m sample-catalog cycle.
 // The latter aliases into vertical ribbons when interpolated across long apron triangles.
 if(weights.carbonate>.45)return GEOLOGY[z< -45&&x< -95?'TDF-LT-044':'TDF-LT-043'];
 if(weights.basalt>.45){const flow=Math.floor((z+x*.12)/90),index=(flow%3+3)%3;return GEOLOGY[['TDF-LT-034','TDF-LT-031','TDF-LT-038'][index]];}
 return GEOLOGY[(weights.sediment??0)>.35?'TDF-LT-046':'TDF-LT-034'];
}
export const SURFACE_COVER_GLSL=`
vec4 geologicalCoverage(vec3 n,vec3 field,float microheight){float angle=acos(clamp(normalize(n).y,-1.,1.)),exposure=max(smoothstep(.34906585,.87266463,angle)*clamp(field.z,0.,1.),smoothstep(.87266463,1.13446401,angle));
float cover=clamp(clamp(field.x,0.,1.)*(1.-.92*exposure)+clamp(field.y,0.,1.)*.16*(1.-.75*exposure),0.,1.);
cover=clamp(cover+(.5-clamp(microheight,0.,1.))*.14*(1.-abs(cover*2.-1.)),0.,1.);float rock=1.-smoothstep(.1,.44,cover),sediment=smoothstep(.52,.86,cover),weathered=max(0.,1.-rock-sediment);vec3 weights=vec3(rock,weathered,sediment);return vec4(weights/max(.00001,dot(weights,vec3(1.))),cover);}
`;
