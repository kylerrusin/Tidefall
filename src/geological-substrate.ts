import {openCaveEntrance,caveOpeningChunk} from './cave-opening';
import {ground,terrain,geology,worldSubstrate,regionalTerrainHeight} from './model';
import {geologicalShape} from './geological-shapes';
import {substrateClearance} from './substrate-field';
import type {MeshData} from './geometry';
import type {SubstrateSite,SubstrateMesh} from './domain/substrate';
export type PreparedRock={site:SubstrateSite;height:number;gx:number;gz:number;mesh:MeshData;bounds:{minX:number;maxX:number;minZ:number;maxZ:number}};
const caches=new Map<number,ReturnType<typeof generate>>();
const now=()=>performance.now();
function transform(site:SubstrateSite,height:number,gx:number,gz:number,local:ArrayLike<number>):Float32Array{
 const vertices=new Float32Array(local.length),c=Math.cos(site.strike),s=Math.sin(site.strike);
 for(let i=0;i<local.length;i+=3){const dx=local[i]*site.sx*c+local[i+2]*site.sz*s,dz=-local[i]*site.sx*s+local[i+2]*site.sz*c;vertices.set([site.x+dx,height+gx*dx+gz*dz+local[i+1]*site.sy,site.z+dz],i);}return vertices;
}
function prepare(site:SubstrateSite,seed:number):PreparedRock{
 const raw=geologicalShape(site.family,site.variant),center=ground(site.x,site.z,seed),gx=(ground(site.x+2,site.z,seed)-ground(site.x-2,site.z,seed))/4,gz=(ground(site.x,site.z+2,seed)-ground(site.x,site.z-2,seed))/4;
 let residual=Infinity,meanResidual=0,supportSamples=0;const c=Math.cos(site.strike),s=Math.sin(site.strike);
 // Full footprint support and every basal vertex, rather than centre-height placement.
 for(let j=-2;j<=2;j++)for(let i=-2;i<=2;i++){const dx=i*site.sx*.8,dz=j*site.sz*.8;meanResidual+=ground(site.x+dx,site.z+dz,seed)-center-gx*dx-gz*dz;supportSamples++;}
 for(const shape of [0,1,2].map(lod=>geologicalShape(site.family,site.variant,lod)))for(let i=0;i<shape.vertices.length;i+=3)if(shape.vertices[i+1]<=.02){const dx=shape.vertices[i]*site.sx*c+shape.vertices[i+2]*site.sz*s,dz=-shape.vertices[i]*site.sx*s+shape.vertices[i+2]*site.sz*c;residual=Math.min(residual,ground(site.x+dx,site.z+dz,seed)-center-gx*dx-gz*dz-shape.vertices[i+1]*site.sy);}
 const height=center+Math.min(meanResidual/supportSamples*.25,residual)-Math.min(.25,site.sy*.16),vertices=transform(site,height,gx,gz,raw.vertices),xs=Array.from(vertices).filter((_,i)=>i%3===0),zs=Array.from(vertices).filter((_,i)=>i%3===2);
 return {site,height,gx,gz,mesh:{vertices,indices:raw.indices},bounds:{minX:Math.min(...xs),maxX:Math.max(...xs),minZ:Math.min(...zs),maxZ:Math.max(...zs)}};
}
function generate(seed:number){
 const start=now(),field=worldSubstrate(seed),bodies=field.sites.map(site=>prepare(site,seed)),bins=new Map<string,number[]>();
 for(let id=0;id<bodies.length;id++){const b=bodies[id];if(b.site.fragment)continue;const p=b.mesh.vertices,t=b.mesh.indices;for(let k=0;k<t.length;k+=3){const a=t[k]*3,c=t[k+1]*3,d=t[k+2]*3,det=(p[c+2]-p[d+2])*(p[a]-p[d])+(p[d]-p[c])*(p[a+2]-p[d+2]);if(Math.abs(det)<1e-9)continue;for(let z=Math.floor(Math.min(p[a+2],p[c+2],p[d+2])/4);z<=Math.floor(Math.max(p[a+2],p[c+2],p[d+2])/4);z++)for(let x=Math.floor(Math.min(p[a],p[c],p[d])/4);x<=Math.floor(Math.max(p[a],p[c],p[d])/4);x++){const key=x+':'+z,list=bins.get(key)??[];list.push(id,k);bins.set(key,list);}}}
 return {bodies,bins,generationMs:now()-start,bufferBytes:bodies.reduce((n,b)=>n+b.mesh.vertices.byteLength+b.mesh.indices.byteLength,0)};
}
export function substrateData(seed:number){let data=caches.get(seed);if(!data){data=generate(seed);caches.set(seed,data);if(caches.size>4)caches.delete(caches.keys().next().value!);}return data;}
export function substrateBodyMesh(body:PreparedRock,lod:number):MeshData{if(lod===0)return body.mesh;const raw=geologicalShape(body.site.family,body.site.variant,lod);return {vertices:transform(body.site,body.height,body.gx,body.gz,raw.vertices),indices:raw.indices};}
/** Exact top-surface query over the same closed static geometry used for walking. */
export function substrateSurface(x:number,z:number,seed:number){
 const data=substrateData(seed),list=data.bins.get(Math.floor(x/4)+':'+Math.floor(z/4))??[];let best:{height:number;unitId:string;normal:{x:number;y:number;z:number};slope:number}|null=null;
 for(let q=0;q<list.length;q+=2){const body=data.bodies[list[q]],k=list[q+1],p=body.mesh.vertices,t=body.mesh.indices,a=t[k]*3,b=t[k+1]*3,c=t[k+2]*3,det=(p[b+2]-p[c+2])*(p[a]-p[c])+(p[c]-p[b])*(p[a+2]-p[c+2]);if(Math.abs(det)<1e-9)continue;const u=((p[b+2]-p[c+2])*(x-p[c])+(p[c]-p[b])*(z-p[c+2]))/det,v=((p[c+2]-p[a+2])*(x-p[c])+(p[a]-p[c])*(z-p[c+2]))/det;if(u< -1e-6||v< -1e-6||u+v>1.000001)continue;const height=u*p[a+1]+v*p[b+1]+(1-u-v)*p[c+1];if(best&&height<=best.height)continue;const ax=p[b]-p[a],ay=p[b+1]-p[a+1],az=p[b+2]-p[a+2],bx=p[c]-p[a],by=p[c+1]-p[a+1],bz=p[c+2]-p[a+2];let nx=ay*bz-az*by,ny=az*bx-ax*bz,nz=ax*by-ay*bx;if(ny<0){nx=-nx;ny=-ny;nz=-nz;}const length=Math.hypot(nx,ny,nz);best={height,unitId:body.site.unitId,normal:{x:nx/length,y:ny/length,z:nz/length},slope:Math.hypot(nx,nz)/Math.max(1e-8,ny)};
 }return best;
}
const meshCache=new Map<string,SubstrateMesh>();
export function substrateChunkMesh(seed:number,cx:number,cz:number,lod=0,visible=true):SubstrateMesh{
 const key=[seed,cx,cz,lod,visible].join(':'),cached=meshCache.get(key);if(cached)return cached;
 const vertices:number[]=[],indices:number[]=[],units:string[]=[],contacts:number[]=[],faceRanges:{end:number;id:string}[]=[];
 for(const body of substrateData(seed).bodies){const site=body.site;if(site.fragment&&visible||site.chunkX!==cx||site.chunkZ!==cz)continue;const mesh=substrateBodyMesh(body,site.fragment?2:lod),offset=vertices.length/3;vertices.push(...mesh.vertices);for(let i=0;i<mesh.vertices.length;i+=3){units.push(site.unitId);contacts.push(Math.max(0,Math.min(1,(mesh.vertices[i+1]-ground(mesh.vertices[i],mesh.vertices[i+2],seed)+.12)/1.5)));}for(let k=0;k<mesh.indices.length;k+=3){const a=mesh.indices[k],b=mesh.indices[k+1],c=mesh.indices[k+2];if(visible&&[a,b,c].every(i=>mesh.vertices[i*3+1]<ground(mesh.vertices[i*3],mesh.vertices[i*3+2],seed)-.04))continue;indices.push(a+offset,b+offset,c+offset);}faceRanges.push({end:indices.length/3,id:site.unitId});}
 const result={vertices:new Float32Array(vertices),indices:new Uint32Array(indices),units,contacts:new Float32Array(contacts),faceRanges};meshCache.set(key,result);if(meshCache.size>600)meshCache.delete(meshCache.keys().next().value!);return result;
}
/** All LODs keep every boundary sample, so unlike independently decimated grids they cannot crack. */
export function terrainChunkMesh(seed:number,cx:number,cz:number,lod=0):MeshData{
 const vertices:number[]=[],indices:number[]=[],map=new Map<string,number>(),step=caveOpeningChunk(cx,cz)?1:lod===0?1:lod===1?2:4;
 const vertex=(i:number,j:number)=>{const key=i+':'+j,existing=map.get(key);if(existing!==undefined)return existing;const x=-160+cx*40+i*2.5,z=-160+cz*40+j*2.5,id=vertices.length/3;vertices.push(x,terrain(x,z,seed),z);map.set(key,id);return id;};
 if(step===1){for(let j=0;j<=16;j++)for(let i=0;i<=16;i++)vertex(i,j);for(let j=0;j<16;j++)for(let i=0;i<16;i++){const a=vertex(i,j),b=vertex(i+1,j),c=vertex(i,j+1),d=vertex(i+1,j+1);indices.push(a,c,b,b,c,d);}}
 else for(let j=0;j<16;j+=step)for(let i=0;i<16;i+=step){const polygon:number[]=[],edge=(x:number,z:number,dx:number,dz:number,boundary:boolean)=>{const count=boundary?step:1;for(let t=0;t<count;t++)polygon.push(vertex(x+dx*t/count,z+dz*t/count));};edge(i,j,0,step,i===0);edge(i,j+step,step,0,j+step===16);edge(i+step,j+step,0,-step,i+step===16);edge(i+step,j,-step,0,j===0);const center=vertex(i+step/2,j+step/2);for(let k=0;k<polygon.length;k++)indices.push(center,polygon[k],polygon[(k+1)%polygon.length]);}
 return openCaveEntrance({vertices:new Float32Array(vertices),indices:new Uint32Array(indices)});
}
export function substrateCoverage(seed:number){return Array.from({length:64},(_,id)=>{const x=id%8,z=Math.floor(id/8),bodies=substrateData(seed).bodies.filter(b=>b.site.chunkX===x&&b.site.chunkZ===z),h:number[]=[],relief:number[]=[];let protectedSamples=0,rockSamples=0,volumeSamples=0;for(let j=0;j<=16;j+=2)for(let i=0;i<=16;i+=2){const px=-160+x*40+i*2.5,pz=-160+z*40+j*2.5,y=ground(px,pz,seed),g=geology(px,pz,seed);h.push(y);relief.push(y-regionalTerrainHeight(px,pz,seed));if(substrateClearance(px,pz,seed)<.85)protectedSamples++;if(g.appearance.rock>.5)rockSamples++;if((substrateSurface(px,pz,seed)?.height??-Infinity)>y+.1)volumeSamples++;}return {x,z,processed:true,classification:geology(-140+x*40,-140+z*40,seed).material,protectedFraction:protectedSamples/h.length,exposedRockSampleFraction:rockSamples/h.length,visibleVolumeSampleFraction:volumeSamples/h.length,reliefMin:Math.min(...relief),reliefMax:Math.max(...relief),bodies:bodies.filter(b=>!b.site.fragment).length,fragments:bodies.filter(b=>b.site.fragment).length,families:[...new Set(bodies.map(b=>b.site.family))],heightMin:Math.min(...h),heightMax:Math.max(...h),lodTriangles:[0,1,2].map(lod=>substrateChunkMesh(seed,x,z,lod).indices.length/3)};});}
