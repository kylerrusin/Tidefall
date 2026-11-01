import * as THREE from "three";
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { connection } from "./client";
import { controls } from "./controls";
import { RIFLE_OFFSET, MUZZLE_LOCAL } from "./weapon";
export const renderedMuzzle=new THREE.Vector3();
export function FirstPersonRifle(){
  const root=useRef<THREE.Group>(null),flash=useRef<THREE.Mesh>(null),offset=useMemo(()=>new THREE.Vector3(),[]);
  useFrame(({camera})=>{const r=root.current;if(!r)return;r.visible=!!connection.presentation?.alive&&connection.state?.status==="running"&&controls.slot===1&&!controls.inventory&&!controls.menu&&!controls.tutorial;
    offset.set(RIFLE_OFFSET.x,RIFLE_OFFSET.y,RIFLE_OFFSET.z).applyQuaternion(camera.quaternion);r.position.copy(camera.position).add(offset);r.quaternion.copy(camera.quaternion);r.updateMatrixWorld();renderedMuzzle.set(MUZZLE_LOCAL.x,MUZZLE_LOCAL.y,MUZZLE_LOCAL.z).applyMatrix4(r.matrixWorld);
    if(flash.current){flash.current.visible=performance.now()<controls.flashUntil;flash.current.rotation.z=performance.now()*.03;}
  });
  return <group ref={root}>
    <mesh position={[0,0,-.12]} castShadow><boxGeometry args={[.12,.13,.35]}/><meshStandardMaterial color="#263c46" metalness={.65} roughness={.36}/></mesh>
    <mesh position={[0,.02,-.36]} rotation={[Math.PI/2,0,0]}><cylinderGeometry args={[.035,.045,.28,12]}/><meshStandardMaterial color="#758487" metalness={.8} roughness={.27}/></mesh>
    <mesh position={[0,-.1,.01]} rotation={[.25,0,0]}><boxGeometry args={[.07,.18,.085]}/><meshStandardMaterial color="#28343a" roughness={.8}/></mesh>
    <mesh position={[.063,.015,-.14]}><boxGeometry args={[.012,.055,.17]}/><meshStandardMaterial color="#6cd6c0" emissive="#42af95" emissiveIntensity={1.1}/></mesh>
    <mesh ref={flash} position={[MUZZLE_LOCAL.x,MUZZLE_LOCAL.y,MUZZLE_LOCAL.z]}><octahedronGeometry args={[.085]}/><meshBasicMaterial color="#c0fff2" transparent opacity={.8}/></mesh>
  </group>;
}
