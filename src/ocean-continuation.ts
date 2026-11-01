import {terrainApron,TERRAIN_RING_VERTICES as ringSize} from './geometry';
import {distantTerrainHeight} from './model';
import {solidHeight} from './surface-query';
import {surfaceGrid,gridSample,wetSupport,clipWetTriangle,type ShoreVertex} from './hydraulic-surface';
/** Continue all four numerical-grid edges over the existing apron, with identical boundary vertices. */
export function oceanContinuationBuffers(seed:number){
 const mesh=terrainApron(seed),points=Array.from({length:mesh.vertices.length/3},(_,i)=>({x:mesh.vertices[i*3],z:mesh.vertices[i*3+2],bed:i<ringSize?solidHeight(mesh.vertices[i*3],mesh.vertices[i*3+2],seed):mesh.vertices[i*3+1]})),indices=Array.from(mesh.indices);
 const previous=points.length-ringSize;
 for(let i=0;i<ringSize;i++){const p=points[previous+i],x=p.x*4,z=p.z*4;points.push({x,z,bed:distantTerrainHeight(x,z,seed)});const a=previous+i,b=previous+(i+1)%ringSize,c=a+ringSize,d=b+ringSize;indices.push(a,b,c,b,d,c);}
 const max=indices.length*2;
 return {points,indices,nodes:points.map(p=>({...p,y:0,depth:0,u:0,v:0} as ShoreVertex)),position:new Float32Array(max*3),depth:new Float32Array(max),flow:new Float32Array(max*2),count:0};
}
export function updateOceanContinuation(out:ReturnType<typeof oceanContinuationBuffers>,levels:ArrayLike<number>,sea:number){
 const eta=surfaceGrid(levels),support=wetSupport(levels);
 out.points.forEach((p,i)=>{const edge=gridSample(eta,Math.max(-160,Math.min(160,p.x)),Math.max(-160,Math.min(160,p.z))),distance=Math.max(Math.abs(p.x),Math.abs(p.z))-160,t=Math.min(1,Math.max(0,distance/80)),blend=t*t*(3-2*t),level=(Number.isFinite(edge)?edge:sea)*(1-blend)+sea*blend;out.nodes[i].y=level;out.nodes[i].depth=Math.min(level-p.bed,distance<.01&&gridSample(support,p.x,p.z)<=.001?-.025:Infinity);});
 let cursor=0;
 const write=(p:ShoreVertex)=>{const k=cursor*3;out.position[k]=p.x;out.position[k+1]=p.y+.008;out.position[k+2]=p.z;out.depth[cursor]=Math.max(0,p.depth);out.flow[cursor*2]=p.u;out.flow[cursor*2+1]=p.v;cursor++;};
 for(let k=0;k<out.indices.length;k+=3){const a=out.nodes[out.indices[k]],b=out.nodes[out.indices[k+1]],c=out.nodes[out.indices[k+2]];if(!Number.isFinite(a.x+a.y+a.z+b.x+b.y+b.z+c.x+c.y+c.z)||Math.abs((b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x))<1e-7||Math.max(a.depth,b.depth,c.depth)<=0)continue;if(Math.min(a.depth,b.depth,c.depth)>=0){write(a);write(b);write(c);continue;}const polygon=clipWetTriangle([a,b,c]);for(let j=1;j<polygon.length-1;j++){write(polygon[0]);write(polygon[j]);write(polygon[j+1]);}}
 out.count=cursor;return cursor;
}
