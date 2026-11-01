import { lookDirection } from "./combat";
import type { V3 } from "./model";
/** Camera-local transforms in metres. The rendered barrel and server use this exact endpoint. */
export const RIFLE_OFFSET={x:.25,y:-.26,z:-.45};
export const MUZZLE_LOCAL={x:0,y:.02,z:-.5};
export function muzzlePosition(eye:V3,yaw:number,pitch:number):V3{
  const forward=lookDirection(yaw,pitch),right={x:-Math.cos(yaw),y:0,z:Math.sin(yaw)},up={x:Math.sin(yaw)*Math.sin(pitch),y:Math.cos(pitch),z:Math.cos(yaw)*Math.sin(pitch)};
  const x=RIFLE_OFFSET.x+MUZZLE_LOCAL.x,y=RIFLE_OFFSET.y+MUZZLE_LOCAL.y,z=-(RIFLE_OFFSET.z+MUZZLE_LOCAL.z);
  return {x:eye.x+right.x*x+up.x*y+forward.x*z,y:eye.y+up.y*y+forward.y*z,z:eye.z+right.z*x+up.z*y+forward.z*z};
}
export function aimFromMuzzle(muzzle:V3,target:V3){const length=Math.hypot(target.x-muzzle.x,target.y-muzzle.y,target.z-muzzle.z);return {length,direction:{x:(target.x-muzzle.x)/Math.max(.001,length),y:(target.y-muzzle.y)/Math.max(.001,length),z:(target.z-muzzle.z)/Math.max(.001,length)}};}
