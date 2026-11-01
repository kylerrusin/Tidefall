import * as THREE from 'three';
const size=64,data=new Uint8Array(size*size*4),hash=(x:number,z:number)=>{let n=Math.imul(x&63,374761393)^Math.imul(z&63,668265263);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)>>>24;};
// R is this Y slice, G the next one. One bilinear fetch reconstructs trilinear 3D value noise.
for(let z=0;z<size;z++)for(let x=0;x<size;x++){const k=(z*size+x)*4;data[k]=hash(x,z);data[k+1]=hash(x+17,z+37);data[k+2]=0;data[k+3]=255;}
export const cloudNoise=new THREE.DataTexture(data,size,size);cloudNoise.wrapS=cloudNoise.wrapT=THREE.RepeatWrapping;cloudNoise.magFilter=cloudNoise.minFilter=THREE.LinearFilter;cloudNoise.generateMipmaps=false;cloudNoise.needsUpdate=true;
