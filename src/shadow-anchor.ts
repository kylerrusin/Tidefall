/** Quantize the directional shadow in its own light plane, not world X/Z.
 * World-axis rounding moves diagonally across shadow texels when the sun rotates. */
export function shadowAnchor(p:{x:number;y:number;z:number},d:{x:number;y:number;z:number},span=128,resolution=2048){
 const n=Math.hypot(d.x,d.y,d.z)||1,dx=d.x/n,dy=d.y/n,dz=d.z/n,r=Math.hypot(dx,dz)||1,rx=dz/r,rz=-dx/r,ux=dy*rz,uy=dz*rx-dx*rz,uz=-dy*rx,step=span/resolution;
 const right=Math.round((p.x*rx+p.z*rz)/step)*step,up=Math.round((p.x*ux+p.y*uy+p.z*uz)/step)*step,depth=p.x*dx+p.y*dy+p.z*dz;
 return {x:right*rx+up*ux+depth*dx,y:up*uy+depth*dy,z:right*rz+up*uz+depth*dz};
}
