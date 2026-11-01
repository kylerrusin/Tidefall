import * as THREE from 'three';
import {useFrame} from '@react-three/fiber';
import {useMemo,useRef} from 'react';
import {connection} from './client';
import {shipAt,shipParts,flightState,hatchPose,PASSENGER_SEATS} from './extraction';
export function ExtractionShip(){
 const root=useRef<THREE.Group>(null),jets=useRef<THREE.Group>(null),hatch=useRef<THREE.Mesh>(null),gear=useRef<THREE.Group>(null),parts=useMemo(()=>shipParts().filter(p=>p.role!=='door'&&!p.seatCollider),[]);
 useFrame(()=>{const s=connection.state,e=s?.extraction,r=root.current;if(!r)return;r.visible=!!e?.site&&s!.time>=e.timeline.approach;if(!e?.site)return;const time=connection.frameTime,p=shipAt(time,e.site,e.timeline),f=flightState(time,e.timeline);r.position.set(p.x,p.y,p.z);r.rotation.x=f.pitch;for(const child of r.children)if(child.userData.ramp)child.visible=e.phase==='boarding';if(hatch.current){const h=hatchPose(time,e.timeline);hatch.current.position.set(h.x,h.y,h.z);hatch.current.rotation.x=h.rx;}if(gear.current)gear.current.scale.y=Math.max(.05,f.gear);if(jets.current){jets.current.visible=e.phase!=='boarding';jets.current.scale.y=1+Math.sin(time*32)*.08;}});
 return <group ref={root} name="extraction-ship" userData={{inspection:'rescue'}}>
 {parts.map((p,i)=><mesh key={i} userData={{ramp:p.role==='foundation'}} position={[p.x,p.y,p.z]} rotation={[p.rx??0,0,0]} receiveShadow><boxGeometry args={[p.sx*2,p.sy*2,p.sz*2]}/><meshStandardMaterial color={p.role==='glass'?'#a4bec6':p.role==='foundation'?'#a8b5ad':p.role==='roof'?'#d9ddd3':'#596e75'} transparent={p.role==='glass'} opacity={p.role==='glass'?.12:1} depthWrite={p.role!=='glass'} roughness={p.role==='glass'?.28:.72} metalness={.35}/></mesh>)}
 <mesh ref={hatch} position={[0,2.6,-5.1]}><boxGeometry args={[3.6,2.6,.26]}/><meshStandardMaterial color="#8a9c9b" metalness={.6} roughness={.35}/></mesh>
 {PASSENGER_SEATS.map(({x,z})=><group key={x} position={[x,.5,z]}><mesh><boxGeometry args={[.62,.3,.7]}/><meshStandardMaterial color="#283f49"/></mesh><mesh position={[0,.5,-.24]} rotation={[-.15,0,0]}><boxGeometry args={[.62,.85,.14]}/><meshStandardMaterial color="#354d59"/></mesh><mesh position={[0,.48,-.33]}><boxGeometry args={[.08,.8,.04]}/><meshStandardMaterial color="#c4b087"/></mesh></group>)}
 {[-1,1].map(x=><group key={'console'+x} position={[x*1.7,.65,2.95]}><mesh><boxGeometry args={[1.5,.7,.8]}/><meshStandardMaterial color="#273c47"/></mesh><mesh position={[0,.48,-.08]} rotation={[-.45,0,0]}><boxGeometry args={[1.15,.55,.04]}/><meshStandardMaterial color="#2b554e" emissive="#4fa898" emissiveIntensity={.8}/></mesh></group>)}
 {[-3,-1.8,0,1.8,3].map(z=><group key={'rib'+z} position={[0,2.5,z]}><mesh><boxGeometry args={[5.7,.13,.13]}/><meshStandardMaterial color="#a4b1aa" metalness={.6} roughness={.4}/></mesh><mesh position={[0,-.12,0]}><boxGeometry args={[1.2,.035,.1]}/><meshBasicMaterial color="#c6e6d6"/></mesh></group>)}
 <group ref={gear}>{[-1,1].flatMap(x=>[-2.5,2.5].map(z=><group key={x+','+z} position={[x*2.6,-.8,z]}><mesh><cylinderGeometry args={[.12,.18,1.5,8]}/><meshStandardMaterial color="#a5b1ae" metalness={.8}/></mesh><mesh position={[0,-.8,0]}><boxGeometry args={[.9,.18,1]}/><meshStandardMaterial color="#27343c"/></mesh></group>))}</group>
 {[-1,1].map(x=><group key={x} position={[x*3.8,1.2,1]}><mesh rotation={[Math.PI/2,0,0]}><cylinderGeometry args={[.65,.85,4,16]}/><meshStandardMaterial color="#85999a" metalness={.7} roughness={.35}/></mesh><mesh position={[0,-1.6,0]}><cylinderGeometry args={[.45,.6,.5,12]}/><meshStandardMaterial color="#273d46"/></mesh></group>)}
 <group ref={jets}>{[-1,1].map(x=><mesh key={x} position={[x*3.8,-1.4,1]} rotation={[Math.PI,0,0]}><coneGeometry args={[.4,2,12]}/><meshBasicMaterial color="#8ce5f4" transparent opacity={.65}/></mesh>)}</group>
 <pointLight position={[0,2,0]} color="#b9d9ce" intensity={22} distance={10}/>
 </group>;
}
