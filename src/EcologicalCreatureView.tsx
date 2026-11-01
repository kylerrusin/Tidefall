import * as THREE from 'three';
import {useMemo,useRef} from 'react';
import {useFrame} from '@react-three/fiber';
import {connection} from './client';
import {morphology} from './biology';
import {ground} from './model';
import {CREATURE_TYPES} from './combat';
const shell=new THREE.SphereGeometry(1,12,8),bone=new THREE.CylinderGeometry(1,.6,1,6),up=new THREE.Vector3(0,1,0);
const skin=new THREE.MeshStandardMaterial({color:'#718173',roughness:.85}),dark=new THREE.MeshStandardMaterial({color:'#354e52',roughness:.8}),tip=new THREE.MeshStandardMaterial({color:'#c6b595',roughness:.7});
export function EcologicalCreatureView({id}:{id:number}){const root=useRef<THREE.Group>(null),limbs=useRef<THREE.InstancedMesh>(null),body=useRef<THREE.Group>(null),phase=useRef(0),s=connection.state!.stalkers.find(s=>s.id===id)!,traits=useMemo(()=>morphology(connection.state!.seed,id,s.kind),[id,s.kind]),radius=CREATURE_TYPES[s.kind].radius,m=useMemo(()=>({o:new THREE.Object3D(),a:new THREE.Vector3(),b:new THREE.Vector3(),delta:new THREE.Vector3()}),[]);
 useFrame((_,dt)=>{const state=connection.state,latest=state?.stalkers.find(s=>s.id===id),r=root.current;if(!latest||!r||!state)return;const s=connection.history.sampleStalker(id,performance.now()/1000)??latest;r.visible=s.health>0||state.time-(s.diedAt??-100)<5;if(!r.visible)return;r.position.set(s.x,s.y,s.z);r.rotation.y=s.yaw;const dead=s.health<=0?Math.min(1,(state.time-(s.diedAt??state.time))*2):0;r.rotation.z=dead*.7;const speed=s.motionSpeed??Math.hypot(s.vx,s.vz);phase.current+=speed*dt*5;if(body.current){body.current.position.y=Math.sin(state.time*2.1)*.02-dead*.2;body.current.scale.y=s.state==='windup'?.8:1;}
  if(!limbs.current)return;for(let i=0;i<traits.limbs;i++){const side=i<traits.limbs/2?-1:1,k=i%(traits.limbs/2),z=(k/(traits.limbs/2-1)-.5)*radius*1.8,a=phase.current+i*2.4,stride=Math.sin(a)*Math.min(.22,speed*.06),lift=Math.max(0,Math.cos(a))*Math.min(.18,speed*.06),footX=side*radius*1.5,footZ=z-stride,wx=s.x+Math.cos(s.yaw)*footX+Math.sin(s.yaw)*footZ,wz=s.z-Math.sin(s.yaw)*footX+Math.cos(s.yaw)*footZ,fy=ground(wx,wz,state.seed)-s.y+.04+lift;
   for(let seg=0;seg<2;seg++){m.a.set(side*radius*.5,-.05,z);m.b.set(side*radius*1.05,.04,z+stride*.3);if(seg){m.a.copy(m.b);m.b.set(footX,Math.max(-radius*1.4,fy),footZ);}m.delta.copy(m.b).sub(m.a);m.o.position.copy(m.a).add(m.b).multiplyScalar(.5);m.o.scale.set(traits.limbThickness,m.delta.length(),traits.limbThickness);m.o.quaternion.setFromUnitVectors(up,m.delta.normalize());m.o.updateMatrix();limbs.current.setMatrixAt(i*2+seg,m.o.matrix);}
  }limbs.current.instanceMatrix.needsUpdate=true;
 });
 return <group ref={root} userData={{creatureId:id}}><group ref={body}>{Array.from({length:traits.segments},(_,i)=><mesh key={i} geometry={shell} material={s.kind==='ambusher'?dark:skin} position={[0,0,(i/(traits.segments-1)-.5)*radius*1.4*traits.aspect]} scale={[radius*.72*traits.width,radius*(s.kind==='ambusher'?.32:.55),radius*.45]}/>)}{s.kind==='skimmer'?[-1,1].map(side=><mesh key={side} geometry={shell} material={dark} position={[side*radius,0,0]} scale={[radius*1.1,.05,radius*.8]}/>):<mesh geometry={shell} material={tip} position={[0,.02,radius*traits.aspect]} scale={[radius*.35,radius*.25,radius*.3]}/>}{traits.limbs>0&&<instancedMesh ref={limbs} args={[bone,dark,traits.limbs*2]} frustumCulled={false}/>}</group></group>;
}
