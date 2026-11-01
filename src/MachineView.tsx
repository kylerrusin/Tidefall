import * as THREE from "three";
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { connection } from "./client";
import { surfaceAt } from "./model";
const steel=new THREE.MeshStandardMaterial({color:"#46484a",metalness:.72,roughness:.46}),ceramic=new THREE.MeshStandardMaterial({color:"#b59c6b",roughness:.68}),rubber=new THREE.MeshStandardMaterial({color:"#212b2d",roughness:.94});
export function MachineView({id}:{id:number}){
  const root=useRef<THREE.Group>(null),head=useRef<THREE.Group>(null),jets=useRef<THREE.Group>(null),wheel=useRef<THREE.Group>(null),memory=useMemo(()=>new THREE.Vector3(),[]);
  const drone=connection.state?.stalkers.find(s=>s.id===id)?.kind==="surveyor";
  useFrame((_,dt)=>{const state=connection.state,latest=state?.stalkers.find(s=>s.id===id),r=root.current;if(!latest||!state||!r)return;const s=connection.history.sampleStalker(id,performance.now()/1000)??latest;
    const dead=latest.health<=0,age=state.time-(latest.diedAt??state.time);r.visible=!dead||age<5;r.position.set(s.x,s.y,s.z);r.rotation.set(0,s.yaw,0);
    if(!drone){const n=surfaceAt(s.x,s.z,state.seed).normal;memory.set(n.x,n.y,n.z);r.rotation.x=Math.max(-.3,Math.min(.3,Math.atan2(n.z,n.y)*Math.cos(s.yaw)+Math.atan2(n.x,n.y)*Math.sin(s.yaw)));r.rotation.z=Math.max(-.3,Math.min(.3,-Math.atan2(n.x,n.y)*Math.cos(s.yaw)));}
    if(dead){r.rotation.z=Math.min(1,age*2)*.7;r.position.y-=Math.min(.5,age*.4);}
    if(head.current)head.current.rotation.x=latest.state==="windup"?-.15:0;
    if(jets.current){jets.current.visible=drone&&!dead;jets.current.scale.y=.7+Math.sin(state.time*40)*.15+(latest.state==="windup"?.7:0);}
    if(wheel.current)for(const part of wheel.current.children)part.rotation.x+=Math.hypot(s.vx,s.vz)*dt*3;
  });
  return <group ref={root} userData={{creatureId:id}}>
    {drone?<><mesh material={steel}><boxGeometry args={[.85,.45,.65]}/></mesh>{[-1,1].map(side=><group key={side} position={[side*.62,-.04,0]}><mesh material={ceramic}><cylinderGeometry args={[.23,.3,.23,12]}/></mesh><mesh material={steel} position={[-side*.2,.04,0]}><boxGeometry args={[.45,.08,.13]}/></mesh></group>)}<group ref={jets}>{[-1,1].map(side=><mesh key={side} position={[side*.62,-.36,0]} rotation={[Math.PI,0,0]}><coneGeometry args={[.14,.5,10]}/><meshBasicMaterial color="#7dd7f4" transparent opacity={.7}/></mesh>)}</group></>:
      <><mesh material={steel} position={[0,-.35,0]} castShadow><boxGeometry args={[1.45,.8,1.8]}/></mesh>{[-1,1].map(side=><mesh key={side} material={rubber} position={[side*.88,-.85,0]}><boxGeometry args={[.32,.45,1.9]}/></mesh>)}<group ref={wheel}>{[-1,1].flatMap(side=>[-.65,0,.65].map(z=><mesh key={`${side}-${z}`} material={ceramic} position={[side*1.05,-.85,z]} rotation={[0,0,Math.PI/2]}><cylinderGeometry args={[.25,.25,.08,10]}/></mesh>))}</group><mesh material={ceramic} position={[0,.2,-.25]} rotation={[-.2,0,0]} castShadow><boxGeometry args={[1.25,.5,1.25]}/></mesh><mesh position={[0,-.1,-.95]}><boxGeometry args={[.5,.35,.15]}/><meshStandardMaterial color="#f3b563" emissive="#e47825" emissiveIntensity={.8}/></mesh></>}
    <group ref={head} position={[0,drone?.08:.3,drone?.38:.45]}>
      <mesh material={steel}><sphereGeometry args={[drone?.24:.35,14,10]}/></mesh><mesh position={[0,.04,drone?.19:.28]}><circleGeometry args={[drone?.13:.17,20]}/><meshStandardMaterial color={drone?"#83dcff":"#ffb463"} emissive={drone?"#2895c6":"#d26228"} emissiveIntensity={2}/></mesh>
    </group>
  </group>;
}
