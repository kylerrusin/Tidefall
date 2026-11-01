import * as THREE from "three";
const N=256,pixels=new Uint8Array(N*N*4);
const random=(x:number,y:number)=>{let a=Math.imul(x,374761393)^Math.imul(y,668265263);a=Math.imul(a^(a>>>13),1274126177);return ((a^(a>>>16))>>>0)/4294967295;};
const noise=(x:number,y:number)=>{const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,u=fx*fx*(3-2*fx),v=fy*fy*(3-2*fy);return (random(ix,iy)*(1-u)+random(ix+1,iy)*u)*(1-v)+(random(ix,iy+1)*(1-u)+random(ix+1,iy+1)*u)*v;};
for(let y=0;y<N;y++)for(let x=0;x<N;x++){
  const warp=noise(x/37,y/31)*3,macro=noise(x/21+warp,y/17),grain=noise(x/3.1,y/2.7),fine=random(x,y),px=x/19+warp*.2,py=y/19;
  let first=Infinity,second=Infinity;for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++){const cx=Math.floor(px)+i,cy=Math.floor(py)+j,d=(px-cx-random(cx,cy))**2+(py-cy-random(cx+71,cy+19))**2;if(d<first){second=first;first=d;}else second=Math.min(second,d);}
  const fissure=Math.max(0,1-(Math.sqrt(second)-Math.sqrt(first))/.065),k=(y*N+x)*4;
  pixels[k]=Math.round(Math.max(0,Math.min(1,.3+macro*.28+grain*.22+fine*.13-fissure*.24))*255);
  pixels[k+1]=Math.round((.6+fine*.25+grain*.14)*255);pixels[k+2]=fine>.975?220:Math.round(macro*100);pixels[k+3]=Math.round(fissure*255);
}
/** Baked warped grain, cell fractures, roughness and mineral inclusions; no fragment-stage Voronoi loops. */
export const geologicalTexture=new THREE.DataTexture(pixels,N,N);
geologicalTexture.wrapS=geologicalTexture.wrapT=THREE.RepeatWrapping;
geologicalTexture.magFilter=THREE.LinearFilter;geologicalTexture.minFilter=THREE.LinearMipmapLinearFilter;geologicalTexture.generateMipmaps=true;geologicalTexture.needsUpdate=true;
