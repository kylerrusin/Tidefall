import {Triangle,Vector3} from 'three';

type GeologicalMesh={vertices:Float32Array;indices:Uint32Array;faceRanges:{end:number;id:string}[]};
/** Resolve the actual static triangle at a hit, including vertical and overlapping exposures.
 * Rapier 0.21's ray feature is local to a triangle, rather than a mesh triangle index.
 * Build a small XZ index lazily; sampling never rebuilds terrain or scans the whole mesh.
 */
export function meshGeologyAt(mesh:GeologicalMesh){
 let cells:Map<string,number[]>|undefined;
 const size=4,epsilon=.015,key=(x:number,z:number)=>Math.floor(x/size)+','+Math.floor(z/size);
 const a=new Vector3(),b=new Vector3(),c=new Vector3(),point=new Vector3(),nearest=new Vector3(),triangle=new Triangle(a,b,c);
 return (hit:{x:number;y?:number;z:number})=>{
  if(hit.y===undefined)return undefined;
  if(!cells){cells=new Map();for(let face=0;face<mesh.indices.length/3;face++){
   const ids=[mesh.indices[face*3],mesh.indices[face*3+1],mesh.indices[face*3+2]],xs=ids.map(i=>mesh.vertices[i*3]),zs=ids.map(i=>mesh.vertices[i*3+2]);
   for(let z=Math.floor((Math.min(...zs)-epsilon)/size);z<=Math.floor((Math.max(...zs)+epsilon)/size);z++)for(let x=Math.floor((Math.min(...xs)-epsilon)/size);x<=Math.floor((Math.max(...xs)+epsilon)/size);x++){const k=x+','+z,list=cells.get(k);if(list)list.push(face);else cells.set(k,[face]);}
  }}
  point.set(hit.x,hit.y,hit.z);let best=epsilon*epsilon,faceIndex=-1;
  for(const face of cells.get(key(hit.x,hit.z))??[]){a.fromArray(mesh.vertices,mesh.indices[face*3]*3);b.fromArray(mesh.vertices,mesh.indices[face*3+1]*3);c.fromArray(mesh.vertices,mesh.indices[face*3+2]*3);triangle.closestPointToPoint(point,nearest);const d=nearest.distanceToSquared(point);if(d<best){best=d;faceIndex=face;}}
  if(faceIndex<0)return undefined;
  let lo=0,hi=mesh.faceRanges.length-1;while(lo<hi){const mid=(lo+hi)>>>1;if(faceIndex<mesh.faceRanges[mid].end)hi=mid;else lo=mid+1;}
  return mesh.faceRanges[lo]?.id;
 };
}
