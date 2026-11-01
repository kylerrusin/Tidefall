import {VisualWater} from './visual-water';
import {terrainQA} from './terrain-qa';
import * as THREE from "three";
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { connection } from "./client";
import { ground } from "./model";
import { planetForSeed } from "./planets";
import { weatherAt } from "./climate";
import { Water } from "./water";
import { WAVE_GLSL } from "./waves";
import {shorelineBuffers,updateShoreline} from "./shoreline";
import {oceanContinuationBuffers,updateOceanContinuation} from './ocean-continuation';
const N=129,DX=320/(N-1);
export function Ocean({seed}:{seed:number}){return planetForSeed(seed).water?<TidalOcean seed={seed}/>:null;}
function TidalOcean({seed}:{seed:number}){
  const lastFar=useRef(-Infinity),visual=useMemo(()=>new VisualWater(),[seed]),lastTime=useRef(0),lastSnapshot=useRef(0);
  const far=useMemo(()=>{const buffers=oceanContinuationBuffers(seed),geometry=new THREE.BufferGeometry();for(const [name,size]of [['position',3],['depth',1],['flow',2]] as const)geometry.setAttribute(name,new THREE.BufferAttribute(buffers[name],size).setUsage(THREE.DynamicDrawUsage));geometry.boundingSphere=new THREE.Sphere(new THREE.Vector3(),7200);return {buffers,geometry};},[seed]);
  const initial=useMemo(()=>new Water(seed).levels(),[seed]);
  const data=useMemo(()=>{const buffers=shorelineBuffers(seed),geometry=new THREE.BufferGeometry();updateShoreline(buffers,initial);geometry.setAttribute("position",new THREE.BufferAttribute(buffers.position,3).setUsage(THREE.DynamicDrawUsage));geometry.setAttribute("depth",new THREE.BufferAttribute(buffers.depth,1).setUsage(THREE.DynamicDrawUsage));geometry.setAttribute("flow",new THREE.BufferAttribute(buffers.flow,2).setUsage(THREE.DynamicDrawUsage));geometry.setDrawRange(0,buffers.count);geometry.boundingSphere=new THREE.Sphere(new THREE.Vector3(0,10,0),260);geometry.boundingBox=new THREE.Box3(new THREE.Vector3(-160,-60,-160),new THREE.Vector3(160,100,160));return {geometry,buffers,last:initial as ArrayLike<number>};},[seed,initial]);
  const material=useMemo(()=>new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,
    uniforms:{geoDebug:import.meta.env.DEV?terrainQA.mode:{value:0},time:{value:0},wind:{value:3},gravity:{value:7.8},seed:{value:seed},day:{value:1},storm:{value:0},star:{value:new THREE.Vector3(-.48,.77,-.38)}},
    vertexShader:`uniform float time;uniform float wind;uniform float gravity;uniform float seed;attribute float depth;attribute vec2 flow;varying vec3 world;varying float h;varying vec2 current;${WAVE_GLSL}
void main(){h=depth;current=flow;vec3 p=position;vec3 wave=sharedWaves(p.xz,max(.01,h),time,wind,gravity,seed);p.y+=wave.x;world=(modelMatrix*vec4(p,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(world,1.);}`,
    fragmentShader:`uniform float geoDebug;uniform float time;uniform float wind;uniform float gravity;uniform float seed;uniform float day;uniform float storm;uniform vec3 star;varying vec3 world;varying float h;varying vec2 current;${WAVE_GLSL}
float waterHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float waterNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(waterHash(i),waterHash(i+vec2(1,0)),f.x),mix(waterHash(i+vec2(0,1)),waterHash(i+vec2(1,1)),f.x),f.y);}
void main(){if(h<0.)discard;vec3 wave=sharedWaves(world.xz,max(.01,h),time,wind,gravity,seed);vec3 view=normalize(cameraPosition-world);vec2 p=world.xz*2.8+vec2(time*.17,-time*.11),ripple=vec2(waterNoise(p+vec2(.13,0))-waterNoise(p-vec2(.13,0)),waterNoise(p+vec2(0,.13))-waterNoise(p-vec2(0,.13)))*.055;vec3 n=normalize(vec3(-wave.y+ripple.x,1.,-wave.z+ripple.y));float fres=.0204+.9796*pow(1.-abs(dot(view,n)),5.);float opticalPath=max(0.,h)/max(.28,abs(dot(view,n)));vec3 transmission=exp(-opticalPath*vec3(.24,.095,.055));vec3 color=mix(vec3(.025,.14,.19),vec3(.16,.31,.25),transmission);vec3 sky=mix(vec3(.045,.075,.14),vec3(.45,.61,.67),day)*(1.-storm*.35);color=mix(color,sky,fres*.85);float turbulence=waterNoise(world.xz*.7+vec2(time*.16,time*.09)),shore=(1.-smoothstep(.04,1.2,h))*smoothstep(.28,.78,turbulence);float crest=smoothstep(.45,.9,wave.x)*(wind/28.);float foam=clamp(shore+crest*.4+min(.18,length(current)*.04)*turbulence,0.,1.);color+=vec3(.6,.69,.64)*foam*.48;float glint=pow(max(0.,dot(reflect(-star,n),view)),110.)*max(0.,star.y);color+=vec3(1.,.86,.62)*glint*.7;color*=.3+.7*day;float haze=1.-exp(-length(cameraPosition-world)*.0018);color=mix(color,sky,haze*.65);gl_FragColor=vec4(color,clamp(.32+(1.-transmission.g)*.58+fres*.12,.3,.96)*smoothstep(0.,.24,h));
${import.meta.env?.DEV?'if(geoDebug==20.||geoDebug==21.)gl_FragColor=vec4(.05,.65,1.,1.);':''}
#include <colorspace_fragment>
}`,
  }),[]);
  useEffect(()=>()=>{data.geometry.dispose();far.geometry.dispose();material.dispose();},[data,far,material]);
  useFrame((_,dt)=>{
    if(import.meta.env.DEV)material.wireframe=terrainQA.active&&terrainQA.mode.value===21;
    const state=connection.state,matching=state?.seed===seed;const now=performance.now()/1000;visual.receive(matching?state.water:initial,matching?state.currentsX:[],matching?state.currents:[],now);const interpolated=visual.update(now),levels=visual.levels;
    if(matching&&state.time<lastSnapshot.current-1)lastTime.current=state.time;lastSnapshot.current=matching?state.time:0;const desired=matching?connection.worldTime():0;const time=lastTime.current=Math.max(lastTime.current,desired),weather=weatherAt(time,seed,state?.extraction.timeline.duration);
    const changed=levels!==data.last||interpolated;
    if(changed){updateShoreline(data.buffers,levels,visual.x,visual.z);data.last=levels;for(const key of ["position","depth","flow"])data.geometry.attributes[key].needsUpdate=true;data.geometry.setDrawRange(0,data.buffers.count);}
    if(changed||Math.abs(weather.sea-lastFar.current)>.025){lastFar.current=weather.sea;updateOceanContinuation(far.buffers,levels,weather.sea);for(const key of ['position','depth','flow'])far.geometry.attributes[key].needsUpdate=true;far.geometry.setDrawRange(0,far.buffers.count);}
    material.uniforms.time.value=time;material.uniforms.wind.value=weather.wind;material.uniforms.gravity.value=planetForSeed(seed).gravity;material.uniforms.seed.value=seed;material.uniforms.day.value=weather.solar.daylight;material.uniforms.storm.value=weather.storm;material.uniforms.star.value.set(weather.solar.direction.x,weather.solar.direction.y,weather.solar.direction.z);
  });
  return <><mesh name="ocean-surface" geometry={data.geometry} material={material}/><mesh name="offshore-boundary" geometry={far.geometry} material={material}/></>;
}
