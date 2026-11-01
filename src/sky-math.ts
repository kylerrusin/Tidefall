import type { V3 } from "./model";
/** Assumed aligned equatorial/orbital planes and site longitude; these are not measured spin axes. */
export function inertialToLocal(v:V3,planet:{rotation:number;latitude:number;siteAngle:number},physicalTime:number):V3{
  const theta=planet.siteAngle+physicalTime*Math.PI*2/planet.rotation,c=Math.cos(theta),s=Math.sin(theta),lat=planet.latitude;
  return {x:v.x*s-v.y*c,y:(v.x*c+v.y*s)*Math.cos(lat)+v.z*Math.sin(lat),z:-(v.x*c+v.y*s)*Math.sin(lat)+v.z*Math.cos(lat)};
}
export function equatorialPosition(raDegrees:number,decDegrees:number,distancePc:number):V3{
  const ra=raDegrees*Math.PI/180,dec=decDegrees*Math.PI/180;return {x:distancePc*Math.cos(dec)*Math.cos(ra),y:distancePc*Math.cos(dec)*Math.sin(ra),z:distancePc*Math.sin(dec)};
}
