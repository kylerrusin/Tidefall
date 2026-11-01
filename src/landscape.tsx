import {GeologicalTerrain} from './GeologicalTerrain';
import {applyGeologicalSurface} from './geological-surface';
import {qaSunDirection,terrainQA} from './terrain-qa';
import {stellarSpectrum} from "./planet-physics";
import {CLOUD_GLSL} from './cloud-shader';
import {cloudNoise} from './cloud-noise';
import {flightState} from './extraction';
import * as THREE from "three";
import { useMemo, useRef, useEffect, memo } from "react";
import { useFrame } from "@react-three/fiber";
import { connection } from "./client";
import {
  DX,
  GRID,
  LANDER,
  SITES,
  astronomy,
  chemistry,
  geology,
  ground,
  hash,
  terrain,
} from "./model";
import { terrainApron, caveMesh, terrainMesh } from "./geometry";
import { geologicalMaterial, terrainSurfaceMaterial, environmentUniforms } from "./materials";
import { Water } from "./water";
import { refreshInstanceBounds } from "./instance-bounds";
import { weatherAt } from "./climate";
import { inertialToLocal } from "./sky-math";
import { GALACTIC_NORTH } from "./astronomy-catalog";
import { TIME_COMPRESSION } from "./model";
import { planetForSeed } from "./planets";
function meshGeometry(data: { vertices: Float32Array; indices: Uint32Array }) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(data.vertices, 3));
  g.setIndex(new THREE.BufferAttribute(data.indices, 1));
  g.computeVertexNormals();
  g.computeBoundingBox(); g.computeBoundingSphere();
  return g;
}
export const Terrain = memo(function Terrain({seed}:{seed:number}) {return <GeologicalTerrain seed={seed}/>;});
export {CaveView as Cave} from './CaveView';
export { Ocean } from "./OceanSurface";
function plantMesh() {
  const v: number[] = [],
    idx: number[] = [];
  for (let leaf = 0; leaf < 5; leaf++) {
    const a = (leaf / 5) * Math.PI * 2;
    for (let j = 0; j < 7; j++) {
      const t = j / 6,
        r = Math.sin(t * Math.PI * 0.75) * 1.1,
        w = Math.sin(t * Math.PI) * 0.22;
      for (const side of [-1, 1])
        v.push(
          Math.cos(a) * r + Math.cos(a + Math.PI / 2) * w * side,
          t * 2.4,
          Math.sin(a) * r + Math.sin(a + Math.PI / 2) * w * side,
        );
    }
    const b = leaf * 14;
    for (let j = 0; j < 6; j++) {
      const k = b + j * 2;
      idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
    }
  }
  return meshGeometry({
    vertices: new Float32Array(v),
    indices: new Uint32Array(idx),
  });
}
export {Biosphere as Vegetation} from "./Biosphere";
export function Sky(){
  const ref=useRef<THREE.Mesh>(null);
  const mat=useMemo(()=>new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:{time:environmentUniforms.time,storm:environmentUniforms.storm,day:{value:1},sun:{value:new THREE.Vector3()},starTint:{value:new THREE.Color()},clouds:{value:0},eye:{value:new THREE.Vector3()},wind:{value:new THREE.Vector2()},column:{value:.24},aerosol:{value:.08},starRadius:{value:.02},galacticPole:{value:new THREE.Vector3()}},vertexShader:`varying vec3 direction;void main(){direction=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`
    uniform float time,storm,clouds,day,column,aerosol,starRadius;uniform vec3 sun,starTint,galacticPole,eye;uniform vec2 wind;varying vec3 direction;
    ${CLOUD_GLSL}
    void main(){vec3 d=normalize(direction);float h=max(0.,d.y),mu=dot(d,sun),airmass=1./max(.08,h+.08);
      vec3 beta=column*vec3(.55,1.1,2.6);vec3 transmission=exp(-beta*airmass);float rayleigh=.059683*(1.+mu*mu);float mie=.079577*(1.-.7*.7)/pow(max(.03,1.+.7*.7-1.4*mu),1.5);
      vec3 c=vec3(.007,.012,.025)+(1.-transmission)*starTint*(rayleigh*6.+mie*aerosol*4.)*day;
      float disc=smoothstep(cos(starRadius*1.01),cos(starRadius*.99),mu);c+=starTint*disc*(1.-storm*.9)*2.;
      vec4 bank=cloudLayer(d,eye,sun,wind,time,clouds,day,8.);c=mix(c,bank.rgb,bank.a);
      float band=exp(-pow(dot(d,galacticPole)*10.,2.));c+=vec3(.018,.014,.03)*band*(1.-day)*(1.-storm);
      float flash=(1.-smoothstep(.03,.15,mod(time,18.)))*smoothstep(.65,.9,storm)*pow(max(0.,dot(d,normalize(vec3(.35,.55,-.6)))),28.);c+=vec3(.4,.43,.5)*flash;gl_FragColor=vec4(c,1.);
#include <colorspace_fragment>
    }`}),[]);
  useEffect(()=>()=>mat.dispose(),[mat]);
  mat.uniforms.cloudNoise??={value:cloudNoise};
  useFrame(({camera})=>{ref.current?.position.copy(camera.position);const state=connection.state,time=state?.time??0,seed=state?.seed??42,planet=planetForSeed(seed),weather=weatherAt(time,seed,state?.extraction.timeline.duration),pole=inertialToLocal(GALACTIC_NORTH,planet,time*TIME_COMPRESSION);mat.uniforms.day.value=weather.solar.daylight;mat.uniforms.sun.value.set(...Object.values(qaSunDirection(weather.solar.direction)) as [number,number,number]);mat.uniforms.starTint.value.setRGB(...stellarSpectrum(planet.observed.st_teff));mat.uniforms.clouds.value=import.meta.env.DEV&&terrainQA.active&&terrainQA.cloudCover>=0?terrainQA.cloudCover:weather.clouds;const boarded=state?.players.find(p=>p.id===connection.id)?.extractedAt!=null,flight=state?flightState(connection.worldTime(),state.extraction.timeline):null,extinction=boarded&&flight?Math.exp(-flight.altitude/8500):1;mat.uniforms.column.value=planet.opticalDepth*extinction;mat.uniforms.clouds.value*=extinction;mat.uniforms.eye.value.copy(camera.position);mat.uniforms.wind.value.set(weather.windX,weather.windZ);mat.uniforms.day.value*=Math.sqrt(extinction);mat.uniforms.aerosol.value=planet.aerosol;mat.uniforms.starRadius.value=weather.solar.angularRadius;mat.uniforms.galacticPole.value.set(pole.x,pole.y,pole.z);});
  return <mesh name="planetary-sky" ref={ref} renderOrder={-100}><sphereGeometry args={[1350,40,24]}/><primitive object={mat} attach="material"/></mesh>;
}
export function TerrainContinuation({seed}:{seed:number}){const geometry=useMemo(()=>applyGeologicalSurface(meshGeometry(terrainApron(seed)),seed,{lod:2,apron:true,smooth:true}),[seed]),material=useMemo(()=>terrainSurfaceMaterial(true),[]);useEffect(()=>()=>{geometry.dispose();material.dispose();},[geometry,material]);return <mesh name="terrain-continuation" userData={{inspection:'terrain'}} geometry={geometry} material={material} receiveShadow/>;}
export function DistantRidges({ seed }: { seed: number }) {return null;}
