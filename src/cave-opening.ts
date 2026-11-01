import type {MeshData} from './geometry';
/** One local, grid-aligned access cut. The rest of the planetary heightfield is retained. */
export const CAVE_OPENING={x:-92.5,z:-112.5,hx:5,hz:10};
export const inCaveOpening=(x:number,z:number,margin=0)=>Math.abs(x-CAVE_OPENING.x)<CAVE_OPENING.hx+margin&&Math.abs(z-CAVE_OPENING.z)<CAVE_OPENING.hz+margin;
export const caveOpeningChunk=(cx:number,cz:number)=>inCaveOpening(-140+cx*40,-140+cz*40,20);
export function openCaveEntrance(mesh:MeshData):MeshData{
 const indices:number[]=[];for(let k=0;k<mesh.indices.length;k+=3){const a=mesh.indices[k]*3,b=mesh.indices[k+1]*3,c=mesh.indices[k+2]*3;if(inCaveOpening((mesh.vertices[a]+mesh.vertices[b]+mesh.vertices[c])/3,(mesh.vertices[a+2]+mesh.vertices[b+2]+mesh.vertices[c+2])/3))continue;indices.push(mesh.indices[k],mesh.indices[k+1],mesh.indices[k+2]);}return {...mesh,indices:new Uint32Array(indices)};
}
