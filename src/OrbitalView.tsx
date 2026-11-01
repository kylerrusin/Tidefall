import {cloudNoise} from './cloud-noise';
import * as THREE from 'three';
import {useMemo,useRef,useEffect} from 'react';
import {useFrame} from '@react-three/fiber';
import {connection} from './client';
import {flightState} from './extraction';
import {weatherAt} from './climate';
import {planetForSeed} from './planets';
import {CLOUD_GLSL} from './cloud-shader';
/** Compressed cinematic horizon. Surface is a scenario reconstruction, not a measured exoplanet map. */
export function OrbitalView(){const root=useRef<THREE.Group>(null),mat=useMemo(()=>new THREE.ShaderMaterial({uniforms:{cloudNoise:{value:cloudNoise},axis:{value:new THREE.Vector3(0,.34,.94)},sun:{value:new THREE.Vector3()},marine:{value:1},cloud:{value:.6}},vertexShader:`varying vec3 n;varying vec3 eyeRay;void main(){n=normal;vec4 world=modelMatrix*vec4(position,1.);eyeRay=cameraPosition-world.xyz;gl_Position=projectionMatrix*viewMatrix*world;}`,fragmentShader:`uniform vec3 sun,axis;uniform float marine,cloud;varying vec3 n;varying vec3 eyeRay;${CLOUD_GLSL}
void main(){vec3 d=normalize(n);float land=fbm(d*5.+fbm(d*13.)*.3),ice=smoothstep(.8,.95,abs(dot(d,axis))),bank=smoothstep(.5,.67,fbm(d*12.+fbm(d*4.)));vec3 ocean=vec3(.018,.12,.19),rock=vec3(.22,.27,.23);vec3 base=mix(ocean,rock,smoothstep(.47,.54,land));base=mix(vec3(.2,.105,.065)+land*.12,base,marine);base=mix(base,vec3(.75,.81,.8),ice*marine);base=mix(base,vec3(.8,.82,.8),bank*cloud*marine);float light=max(.07,dot(d,sun));float limb=pow(1.-max(0.,dot(d,normalize(eyeRay))),3.);gl_FragColor=vec4(base*light+vec3(.07,.2,.35)*limb*marine*.22,1.);
#include <colorspace_fragment>
}`}),[]);
 useEffect(()=>()=>mat.dispose(),[mat]);
 useFrame(({camera,scene})=>{const s=connection.state,p=s?.players.find(p=>p.id===connection.id),f=s?flightState(connection.worldTime(),s.extraction.timeline):null,visible=p?.extractedAt!=null&&!!f&&f.orbit>.55;if(root.current){root.current.visible=visible;root.current.position.set(camera.position.x,camera.position.y-650,camera.position.z+80);}if(!visible||!s)return;const w=weatherAt(s.time,s.seed,s.extraction.timeline.duration);mat.uniforms.sun.value.set(w.solar.direction.x,w.solar.direction.y,w.solar.direction.z);const profile=planetForSeed(s.seed);mat.uniforms.axis.value.set(0,Math.sin(profile.latitude),Math.cos(profile.latitude));mat.uniforms.marine.value=profile.water?1:0;mat.uniforms.cloud.value=w.clouds;if(scene.fog){const fog=scene.fog as THREE.Fog;fog.near=3000;fog.far=5000;}});
 return <group ref={root} visible={false}><mesh material={mat}><sphereGeometry args={[610,72,48]}/></mesh><mesh scale={1.008}><sphereGeometry args={[610,48,32]}/><meshBasicMaterial color="#5097c5" transparent opacity={.055} side={THREE.BackSide} depthWrite={false}/></mesh></group>;
}
