import * as THREE from 'three';
import {geologicalTexture} from './geological-texture';
export const rockPbrReady={value:0};let loaded=0;
const load=(file:string,srgb=false)=>{if(typeof document==='undefined')return geologicalTexture;const texture=new THREE.TextureLoader().load('/materials/rock-face/'+file+'.jpg',()=>{if(++loaded===4)rockPbrReady.value=1;});texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.anisotropy=4;texture.colorSpace=srgb?THREE.SRGBColorSpace:THREE.NoColorSpace;return texture;};
export const rockPbr={albedo:load('albedo',true),normal:load('normal'),roughness:load('roughness'),occlusion:load('occlusion')};
