import * as THREE from "three";
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { connection } from "./client";
import { controls } from "./controls";
import { COMBAT } from "./combat";
import type { V3 } from "./model";
/** World-space paths, target/last-known rays, active attack arcs and spore velocity. */
export function CreatureDiagnostics() {
  const ref=useRef<THREE.LineSegments>(null),timer=useRef(0);
  const geometry=useMemo(()=>{const g=new THREE.BufferGeometry();g.setAttribute("position",new THREE.BufferAttribute(new Float32Array(2048*3),3));g.setAttribute("color",new THREE.BufferAttribute(new Float32Array(2048*3),3));g.setDrawRange(0,0);return g;},[]);
  useEffect(()=>()=>geometry.dispose(),[geometry]);
  useFrame((_,dt)=>{
    if(!ref.current)return;ref.current.visible=controls.physicsDebug;
    timer.current+=dt;if(!controls.physicsDebug||timer.current<.2)return;timer.current=0;
    const state=connection.state;if(!state)return;
    const positions=geometry.attributes.position as THREE.BufferAttribute,colors=geometry.attributes.color as THREE.BufferAttribute;let n=0;
    const line=(a:V3,b:V3,color:[number,number,number])=>{if(n>=2046)return;positions.setXYZ(n,a.x,a.y+.2,a.z);positions.setXYZ(n+1,b.x,b.y+.2,b.z);colors.setXYZ(n,...color);colors.setXYZ(n+1,...color);n+=2;};
    for(const s of state.stalkers){
      let previous:V3=s;
      for(const point of s.path){line(previous,point,[.3,1,.7]);previous=point;}
      if(s.lastKnown)line(s,s.lastKnown,[1,.6,.25]);
      if(s.state==="windup"&&s.attackKind==="melee")for(let i=0;i<24;i++){
        const angle=s.yaw-COMBAT.stalker.meleeArc+i/24*COMBAT.stalker.meleeArc*2,next=angle+COMBAT.stalker.meleeArc/12,r=COMBAT.stalker.meleeRange;
        line({x:s.x+Math.sin(angle)*r,y:s.y,z:s.z+Math.cos(angle)*r},{x:s.x+Math.sin(next)*r,y:s.y,z:s.z+Math.cos(next)*r},[1,.25,.2]);
      }
    }
    for(const p of state.projectiles)line(p,{x:p.x+p.vx,y:p.y+p.vy,z:p.z+p.vz},[1,.8,.35]);
    positions.needsUpdate=colors.needsUpdate=true;geometry.setDrawRange(0,n);
  });
  return <lineSegments ref={ref} geometry={geometry} frustumCulled={false} renderOrder={51}><lineBasicMaterial vertexColors depthTest={false}/></lineSegments>;
}
