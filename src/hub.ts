import {CylinderGeometry,ConeGeometry,BoxGeometry,Matrix4,Quaternion,Vector3,type BufferGeometry} from 'three';
import {LANDER,ground} from './model';
import {footprint} from './placement';
import type {MeshData} from './geometry';
export type HubPart=MeshData&{finish:'hull'|'shield'|'strut'|'window'};
const cache=new Map<number,HubPart[]>();
/** One world-space mesh recipe owns the landing hub's visible hull AND every solid collider. */
export function hubParts(seed:number){let result=cache.get(seed);if(result)return result;result=[];const h=ground(LANDER.x,LANDER.z,seed);
 const add=(g:BufferGeometry,finish:HubPart['finish'],x:number,y:number,z:number,q=new Quaternion())=>{g.applyMatrix4(new Matrix4().compose(new Vector3(x,y,z),q,new Vector3(1,1,1)));result!.push({vertices:Float32Array.from(g.attributes.position.array),indices:Uint32Array.from(g.index?.array??Array.from({length:g.attributes.position.count},(_,i)=>i)),finish});g.dispose();};
 add(new CylinderGeometry(2.6,3.6,4,8),'hull',LANDER.x,h+3,LANDER.z);
 add(new ConeGeometry(2.6,2,8),'shield',LANDER.x,h+5.4,LANDER.z);
 add(new BoxGeometry(2,1.3,.2),'window',LANDER.x,h+3.5,LANDER.z+2.7);
 for(const sx of [-1,1])for(const sz of [-1,1]){const x=LANDER.x+sx*3.5,z=LANDER.z+sz*3.5,bottom=footprint(x,z,.8,seed).max-.04;
  add(new CylinderGeometry(.7,.8,.3,8),'shield',x,bottom+.15,z);
  const a=new Vector3(x,bottom+.3,z),b=new Vector3(LANDER.x+sx*2.65,h+1.9,LANDER.z+sz*2.65),delta=b.clone().sub(a),mid=a.clone().add(b).multiplyScalar(.5);
  add(new CylinderGeometry(.15,.22,delta.length(),8),'strut',mid.x,mid.y,mid.z,new Quaternion().setFromUnitVectors(new Vector3(0,1,0),delta.normalize()));
 }
 cache.set(seed,result);if(cache.size>8)cache.delete(cache.keys().next().value!);return result;
}
