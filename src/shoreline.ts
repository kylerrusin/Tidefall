import {solidHeight} from './surface-query';
import {ground,TERRAIN_DX,TERRAIN_GRID} from './model';
import {surfaceGrid,gridSample,wetSupport,clipWetTriangle,type ShoreVertex} from './hydraulic-surface';
/** Reusable fixed buffers: rebuilt at snapshot cadence, not per render frame. */
export function shorelineBuffers(seed:number){
  const max=(TERRAIN_GRID-1)**2*12,position=new Float32Array(max*3),depth=new Float32Array(max),flow=new Float32Array(max*2),bed=new Float64Array(TERRAIN_GRID**2);
  for(let j=0;j<TERRAIN_GRID;j++)for(let i=0;i<TERRAIN_GRID;i++)bed[j*TERRAIN_GRID+i]=solidHeight(i*TERRAIN_DX-160,j*TERRAIN_DX-160,seed);
  const nodes:ShoreVertex[]=Array.from({length:TERRAIN_GRID**2},(_,k)=>({x:(k%TERRAIN_GRID)*TERRAIN_DX-160,z:Math.floor(k/TERRAIN_GRID)*TERRAIN_DX-160,y:0,depth:0,u:0,v:0}));
  return {position,depth,flow,bed,nodes,count:0};
}
export function updateShoreline(out:ReturnType<typeof shorelineBuffers>,levels:ArrayLike<number>,ux:ArrayLike<number>=[],uz:ArrayLike<number>=[]){
  const eta=surfaceGrid(levels),support=wetSupport(levels),nodes=out.nodes,N=TERRAIN_GRID;
  for(let j=0;j<N;j++)for(let i=0;i<N;i++){const k=j*N+i,p=nodes[k],cell=Math.round(j/2)*65+Math.round(i/2);p.y=gridSample(eta,p.x,p.z);p.depth=Math.min(p.y-out.bed[k],gridSample(support,p.x,p.z)>.001?Infinity:-.025);p.u=ux[cell]??0;p.v=uz[cell]??0;}
  let cursor=0;
  const write=(p:ShoreVertex)=>{const k=cursor*3;out.position[k]=p.x;out.position[k+1]=p.y+.008;out.position[k+2]=p.z;out.depth[cursor]=Math.max(0,p.depth);out.flow[cursor*2]=p.u;out.flow[cursor*2+1]=p.v;cursor++;};
  const emit=(a:ShoreVertex,b:ShoreVertex,c:ShoreVertex)=>{if(Math.abs((b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x))<1e-7)return;write(a);write(b);write(c);};
  const visit=(a:ShoreVertex,b:ShoreVertex,c:ShoreVertex)=>{if(!Number.isFinite(a.y+b.y+c.y)||Math.max(a.depth,b.depth,c.depth)<=0)return;if(Math.min(a.depth,b.depth,c.depth)>=0){emit(a,b,c);return;}const p=clipWetTriangle([a,b,c]);for(let q=1;q<p.length-1;q++)emit(p[0],p[q],p[q+1]);};
  for(let j=0;j<N-1;j++)for(let i=0;i<N-1;i++){const k=j*N+i;visit(nodes[k],nodes[k+N],nodes[k+1]);visit(nodes[k+1],nodes[k+N],nodes[k+N+1]);}
  out.count=cursor;return cursor;
}
