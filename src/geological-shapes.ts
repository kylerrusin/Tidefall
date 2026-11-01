import type {MeshData} from './geometry';
import {ROCK_FAMILIES,type RockFamily} from './domain/substrate';
import {substrateHash} from './substrate-field';
const cache=new Map<string,MeshData>();
/** Original closed structural meshes, shared by every world, instance and collision batch. */
export function geologicalShape(family:RockFamily,variant:number,lod=0):MeshData{
 const key=family+':'+variant+':'+lod,cached=cache.get(key);if(cached)return cached;
 const vertices:number[]=[],indices:number[]=[],seed=1907+variant*199+ROCK_FAMILIES.indexOf(family)*1009;
 const h=(a:number,b:number)=>substrateHash(seed,a,b),farSides=lod===2?5:6;
 function body(profile:[number,number][],sides:number,ox=0,oz=0,wx=1,wz=1,hy=1,oy=0,angle=0){
  // Variant-dependent bedding, thickness and relative lobe dimensions are geometry, not color swaps.
  wx*=.84+h(52,9)*.34;wz*=.82+h(53,9)*.36;hy*=.8+h(54,9)*.4;angle+=(h(55,9)-.5)*.27;
  const start=vertices.length/3,c=Math.cos(angle),s=Math.sin(angle);
  const varied=profile.map(([y,r],j)=>[y+(j&&j<profile.length-1?(h(j,82)-.5)*.055:0),r*(.9+h(j,83)*.2)] as [number,number]);
  const selected=lod===0?varied:family==='stratified'||family==='shelf'?varied:varied.filter((_,i)=>i===0||i===varied.length-1||i%(lod===1?2:3)===0);
  for(let j=0;j<selected.length;j++){const [y,r]=selected[j];for(let i=0;i<sides;i++){const a=i*Math.PI*2/sides,structure=.88+h(i,3)*.19,breakage=(h(i,j+10)-.5)*.1,px=Math.cos(a)*(r*structure+breakage)*wx+(y+.2)*(.12+h(3,4)*.15),pz=Math.sin(a)*(r*(.9+h(i,9)*.18)+breakage)*wz;vertices.push(ox+px*c+pz*s,oy+y*hy+px*.045+(j===selected.length-1?(h(i,77)-.5)*.11*hy:0),oz-px*s+pz*c);}}
  for(let j=0;j<selected.length-1;j++)for(let i=0;i<sides;i++){const a=start+j*sides+i,b=start+j*sides+(i+1)%sides,c=a+sides,d=b+sides;indices.push(a,c,b,b,c,d);}
  const bottom=vertices.length/3;vertices.push(ox,oy+selected[0][0]*hy,oz);const top=vertices.length/3;vertices.push(ox+(selected.at(-1)![0]+.2)*(.12+h(3,4)*.15)*Math.cos(angle),oy+selected.at(-1)![0]*hy,oz-(selected.at(-1)![0]+.2)*(.12+h(3,4)*.15)*Math.sin(angle));
  for(let i=0;i<sides;i++){indices.push(bottom,start+i,start+(i+1)%sides);const a=start+(selected.length-1)*sides;indices.push(top,a+(i+1)%sides,a+i);}
 }
 const n=lod===0?10:lod===1?8:6;
 if(family==='rounded'){
  const p:[number,number][]=[[-.35,.72],[-.08,1.06],[.15,1.16],[.45,1.1],[.7,.85],[.9,.56],[1,.17]];body(p,n,0,0,1.1,.8,1);body(p,n,.5+h(1,1)*.2,(h(1,2)-.5)*.8,.62,.72,.65,-.14,.4);
 }else if(family==='stratified'){
  const p:[number,number][]=[[-.35,.85],[-.04,1.02],[.03,1.15],[.29,1.08],[.34,.9],[.58,1.02],[.65,.77],[.91,.82],[1,.6]];body(p,Math.max(6,n-2),0,0,1.3,.75,1,0,(h(1,1)-.5)*.15);if(lod<2)body(p,6,-.8,.23,.53,.7,.62,-.17,.27);
 }else if(family==='fractured'){
  const p:[number,number][]=[[-.35,.82],[0,1.04],[.53,.89],[1,.62]];body(p,farSides,0,0,1,.9,1,0,.1);body(p,farSides,.58+h(4,3)*.3,.2,.67,.6,.6+h(4,4)*.36,-.06,.7);if(lod<2&&variant%3!==0)body(p,6,-.62,-.3,.55,.65,.6,-.12,-.3);
 }else if(family==='tower'){
  const p:[number,number][]=[[-.3,1.12],[.02,.86],[.4,.71],[.76,.59],[1,.36]];body(p,lod===2?5:Math.max(6,n-2),-.1,0,.8,.74,1);body(p,farSides,.5+h(4,3)*.3,.15,.61,.64,.45+h(4,4)*.35,-.12,.25);
 }else if(family==='shelf'){
  const p:[number,number][]=[[-.35,.9],[0,.94],[.34,.82],[.41,1.13],[.55,1.08],[.63,.84],[.8,.83],[.9,1.05],[1,.92]];body(p,Math.max(6,n-2),0,0,1.45,.68,1,0,.06);if(lod<2)body([[-.35,.9],[0,1],[.48,.8],[.58,.9]],6,-.9,.22,.55,.8,.75,-.08,.5);
 }else{
  const p:[number,number][]=[[-.45,.8],[0,1],[.14,1.04],[.5,.9],[.58,.78]];body(p,farSides,0,0,1.28,.82,1,0,(h(1,1)-.5)*.4);body(p,farSides,.65,.4,.7,.7,.65+h(4,4)*.35,-.15,.45);if(lod<2&&variant%3!==0)body(p,6,-.72,.32,.6,.65,.55,-.16,-.3);
 }
 const result={vertices:new Float32Array(vertices),indices:new Uint32Array(indices)};cache.set(key,result);return result;
}
