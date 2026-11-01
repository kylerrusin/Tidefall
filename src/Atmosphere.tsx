import {lampIntensity} from './lamp-response';
import {terrainQA} from './terrain-qa';
import {caveLocation} from './caves';
import * as THREE from "three";
import {insideFacility,suitLampPower} from "./facility-lighting";
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { connection } from "./client";
import { hash } from "./model";
import { weatherAt } from "./climate";
import { planetForSeed } from "./planets";
export function SuitLight(){
  const light=useRef<THREE.SpotLight>(null),fill=useRef<THREE.SpotLight>(null),target=useMemo(()=>new THREE.Object3D(),[]),direction=useMemo(()=>new THREE.Vector3(),[]);
  const range=useRef({distance:16,timer:0});
  useFrame(({camera},dt)=>{if(!light.current)return;const show=!(import.meta.env.DEV&&terrainQA.active&&!terrainQA.flashlight);light.current.visible=show;if(fill.current)fill.current.visible=show;const s=connection.state,w=weatherAt(s?.time??0,s?.seed??42,s?.extraction.timeline.duration);camera.getWorldDirection(direction);light.current.position.copy(camera.position).addScaledVector(direction,.2);target.position.copy(camera.position).addScaledVector(direction,25);target.updateMatrixWorld();range.current.timer+=dt;const pred=connection.prediction;if(pred&&range.current.timer>.12){range.current.timer=0;const hit=pred.world.castRay({origin:camera.position,dir:direction,pointAt:(t:number)=>({x:camera.position.x+direction.x*t,y:camera.position.y+direction.y*t,z:camera.position.z+direction.z*t})},30,true,undefined,undefined,pred.collider,pred.body);range.current.distance=hit?.timeOfImpact??16;}const seed=s?.seed??42,volcanic=seed<0,power=suitLampPower(range.current.distance,insideFacility(camera.position,seed),seed)*(volcanic?1.5:1),response=1-Math.exp(-dt*8);light.current.distance=volcanic?85:65;light.current.intensity=lampIntensity(light.current.intensity,(20+135*w.solar.night)*power,dt);if(fill.current){fill.current.position.copy(light.current.position);fill.current.distance=volcanic?55:35;fill.current.angle=volcanic?1.22:1.15;fill.current.intensity=lampIntensity(fill.current.intensity,(10+55*w.solar.night)*power,dt);}});
  return <><primitive object={target}/><spotLight ref={light} target={target} color="#c8dfe8" intensity={20} distance={65} angle={.72} penumbra={1} decay={2} castShadow shadow-mapSize={[512,512]} shadow-bias={-.0001} shadow-normalBias={.02}/><spotLight ref={fill} target={target} color="#a8c0d0" intensity={20} distance={35} angle={1.15} penumbra={1} decay={2} castShadow shadow-mapSize={[256,256]} shadow-bias={-.0001} shadow-normalBias={.02}/></>;
}
export function NightStars(){
  const ref=useRef<THREE.Points>(null),material=useMemo(()=>new THREE.PointsMaterial({color:"#c9d5ed",size:1.7,transparent:true,depthWrite:false,sizeAttenuation:true}),[]);
  const geometry=useMemo(()=>{const g=new THREE.BufferGeometry(),p=new Float32Array(2400*3);for(let i=0;i<2400;i++){const y=hash(74,i,1)*2-1,a=hash(74,i,2)*Math.PI*2,r=Math.sqrt(1-y*y);p.set([Math.cos(a)*r*1080,y*1080,Math.sin(a)*r*1080],i*3);}g.setAttribute("position",new THREE.BufferAttribute(p,3));g.computeBoundingSphere();return g;},[]);
  useEffect(()=>()=>{geometry.dispose();material.dispose();},[geometry,material]);
  useFrame(({camera})=>{const s=connection.state,w=weatherAt(s?.time??0,s?.seed??42,s?.extraction.timeline.duration);if(ref.current)ref.current.position.copy(camera.position);material.opacity=w.solar.night**4*(1-w.clouds*.94)*.12;});
  return <points ref={ref} geometry={geometry} material={material} renderOrder={-90}/>;
}
export function WeatherEffects(){
  const ref=useRef<THREE.LineSegments>(null);
  const geometry=useMemo(()=>{const g=new THREE.BufferGeometry(),p=new Float32Array(600*2*3);for(let i=0;i<600;i++){const x=(hash(391,i,1)-.5)*60,y=hash(391,i,2)*38,z=(hash(391,i,3)-.5)*60;p.set([x,y,z,x,y+.65,z],i*6);}g.setAttribute("position",new THREE.BufferAttribute(p,3));g.boundingSphere=new THREE.Sphere(new THREE.Vector3(0,19,0),50);return g;},[]);
  const material=useMemo(()=>new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{time:{value:0},amount:{value:0},wind:{value:new THREE.Vector2()},color:{value:new THREE.Color("#a1b7be")}},vertexShader:`uniform float time;uniform vec2 wind;void main(){vec3 p=position;p.y=mod(p.y-time*18.,38.);p.xz+=wind*(38.-p.y)*.018;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,fragmentShader:`uniform vec3 color;uniform float amount;void main(){gl_FragColor=vec4(color,amount);}`}),[]);
  useEffect(()=>()=>{geometry.dispose();material.dispose();},[geometry,material]);
  useFrame(({camera})=>{const s=connection.state,time=s?.time??0,w=weatherAt(time,s?.seed??42,s?.extraction.timeline.duration);if(ref.current){ref.current.position.set(camera.position.x,camera.position.y-19,camera.position.z);ref.current.visible=w.storm>.05&&!caveLocation(camera.position,s?.seed??42);}material.uniforms.time.value=time+Math.min(.12,(performance.now()-connection.lastState)/1000);material.uniforms.amount.value=w.storm*(.12+w.solar.daylight*.2);material.uniforms.wind.value.set(w.windX,w.windZ);material.uniforms.color.value.set(planetForSeed(s?.seed??42).water?"#a8bec8":"#b8a18e");});
  return <lineSegments ref={ref} geometry={geometry} material={material} frustumCulled={false}/>;
}
export function ThermalTerrain({seed}:{seed:number}){
  const ref=useRef<THREE.Mesh>(null);
  const material=useMemo(()=>new THREE.ShaderMaterial({uniforms:{time:{value:0}},vertexShader:`varying vec2 uv0;void main(){uv0=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`uniform float time;varying vec2 uv0;void main(){float fracture=pow(abs(sin(uv0.x*25.+sin(uv0.y*15.+time*.3))),9.);vec3 c=mix(vec3(.12,.055,.035),vec3(1.,.29,.045),fracture*.85);gl_FragColor=vec4(c,1.);}`}),[]);
  useEffect(()=>()=>material.dispose(),[material]);
  useFrame(({clock})=>{material.uniforms.time.value=connection.state?.time??clock.elapsedTime;});
  return <group><mesh ref={ref} position={[68,8.08,2]} rotation={[-Math.PI/2,0,0]} material={material}><circleGeometry args={[7,48]}/></mesh><pointLight position={[68,11,2]} color="#ff7035" intensity={60} distance={28}/></group>;
}
