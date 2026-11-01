import {GEOLOGY_REFERENCES} from './domain/world-sites';
import {rockPositions,rockIndices} from './data/rock-face-packed';
import {ground,geology} from './model';
import type {MeshData} from './geometry';
function bytes(s:string){const raw=atob(s),out=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)out[i]=raw.charCodeAt(i);return out;}
const positions=new Float32Array(bytes(rockPositions).buffer),sourceIndices=new Uint16Array(bytes(rockIndices).buffer);
export const heroPlans=GEOLOGY_REFERENCES;
const cache=new Map<number,ReturnType<typeof build>>();
function build(seed:number){return heroPlans.map((p,id)=>{const c=Math.cos(p.angle),s=Math.sin(p.angle),vertices=new Float32Array(positions.length);let lift=-Infinity;
 for(let i=0;i<positions.length;i+=3){const x=(positions[i]-.343)*p.scale,y=(positions[i+1]+.03436)*p.scale,z=(positions[i+2]+1.5524)*p.scale,wx=p.x+x*c+z*s,wz=p.z-x*s+z*c;vertices.set([wx,y,wz],i);if(y<.55)lift=Math.max(lift,ground(wx,wz,seed)-y);}
 lift-=.35;for(let i=1;i<vertices.length;i+=3)vertices[i]+=lift;const mesh={vertices,indices:Uint32Array.from(sourceIndices)},bins=new Map<string,number[]>();
 for(let k=0;k<mesh.indices.length;k+=3){const a=mesh.indices[k]*3,b=mesh.indices[k+1]*3,c=mesh.indices[k+2]*3,minX=Math.floor(Math.min(vertices[a],vertices[b],vertices[c])),maxX=Math.floor(Math.max(vertices[a],vertices[b],vertices[c])),minZ=Math.floor(Math.min(vertices[a+2],vertices[b+2],vertices[c+2])),maxZ=Math.floor(Math.max(vertices[a+2],vertices[b+2],vertices[c+2]));for(let z=minZ;z<=maxZ;z++)for(let x=minX;x<=maxX;x++){const key=x+':'+z,list=bins.get(key)??[];list.push(k);bins.set(key,list);}}
 return {id,...p,unitId:seed<0?'TDF-LT-033':id===0?'TDF-LT-046':'TDF-LT-034',mesh,bins};});}
export function heroOutcrops(seed:number){let result=cache.get(seed);if(!result){result=build(seed);cache.set(seed,result);if(cache.size>8)cache.delete(cache.keys().next().value!);}return result;}
export function heroHeight(x:number,z:number,seed:number){let height=-Infinity;for(const h of heroOutcrops(seed)){for(const k of h.bins.get(Math.floor(x)+':'+Math.floor(z))??[]){const p=h.mesh.vertices,t=h.mesh.indices,a=t[k]*3,b=t[k+1]*3,c=t[k+2]*3,det=(p[b+2]-p[c+2])*(p[a]-p[c])+(p[c]-p[b])*(p[a+2]-p[c+2]);if(Math.abs(det)<1e-10)continue;const u=((p[b+2]-p[c+2])*(x-p[c])+(p[c]-p[b])*(z-p[c+2]))/det,v=((p[c+2]-p[a+2])*(x-p[c])+(p[a]-p[c])*(z-p[c+2]))/det;if(u>=-1e-6&&v>=-1e-6&&u+v<=1.000001)height=Math.max(height,u*p[a+1]+v*p[b+1]+(1-u-v)*p[c+1]);}}return height;}
/** Vertex clustering for distant views. Full survey mesh remains authoritative for collision and support. */
export function simplifyOutcrop(mesh:MeshData,size:number):MeshData{const vertices:number[]=[],mapping:number[]=[],cells=new Map<string,number>();for(let i=0;i<mesh.vertices.length;i+=3){const v=mesh.vertices.subarray(i,i+3),key=Array.from(v,n=>Math.floor(n/size)).join(',');let index=cells.get(key);if(index===undefined){index=vertices.length/3;vertices.push(...v);cells.set(key,index);}mapping.push(index);}const indices:number[]=[];for(let i=0;i<mesh.indices.length;i+=3){const a=mapping[mesh.indices[i]],b=mapping[mesh.indices[i+1]],c=mapping[mesh.indices[i+2]];if(a!==b&&a!==c&&b!==c)indices.push(a,b,c);}return {vertices:new Float32Array(vertices),indices:new Uint32Array(indices)};}
