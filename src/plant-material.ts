import * as THREE from 'three';
import {environmentUniforms} from './materials';
import {geologicalTexture} from './geological-texture';
/** Leaf-relative tissue and veins; wind displacement vanishes at each organism's root. */
export function plantMaterial(){
 const material=new THREE.MeshStandardMaterial({vertexColors:true,side:THREE.DoubleSide,roughness:.85});
 material.onBeforeCompile=shader=>{shader.uniforms.windTime=environmentUniforms.time;shader.uniforms.plantGrain={value:geologicalTexture};
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nuniform float windTime;attribute vec2 growthUv;attribute float growthHeight;varying vec2 plantUv;').replace('#include <begin_vertex>','#include <begin_vertex>\nplantUv=growthUv;transformed.x+=sin(position.x*.7+windTime*.8)*.045*growthHeight*growthHeight;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec2 plantUv;uniform sampler2D plantGrain;').replace('#include <color_fragment>',`#include <color_fragment>
float tissue=texture2D(plantGrain,plantUv*vec2(1.7,3.1)).r,midrib=1.-smoothstep(.018,.065,abs(plantUv.x-.5)),veins=pow(.5+.5*sin(plantUv.y*75.+abs(plantUv.x-.5)*21.),12.);
diffuseColor.rgb*=.72+tissue*.42+midrib*.12+veins*.055;`);
 };material.customProgramCacheKey=()=>"tidefall-plant-v11";return material;
}
