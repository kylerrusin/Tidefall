import {organismTraits} from "./environment-fields";
import {EcologicalCreatureView} from './EcologicalCreatureView';
import {morphology} from './biology';
import * as THREE from "three";
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { connection } from "./client";
import { controls } from "./controls";
import { MachineView } from "./MachineView";
import { COMBAT } from "./combat";
import { creaturePose } from "./creature-animation";
import { ground } from "./model";
// All organisms share these resources. Six articulated limbs use lightweight joints.
const shell=new THREE.SphereGeometry(1,20,12), joint=new THREE.SphereGeometry(1,8,6);
const bone=new THREE.CylinderGeometry(1,0.65,1,7), plate=new THREE.ConeGeometry(1,1,5);
const armor=new THREE.MeshStandardMaterial({color:"#3e6564",roughness:0.67,metalness:0.08});
const underside=new THREE.MeshStandardMaterial({color:"#283b43",roughness:0.9});
const horn=new THREE.MeshStandardMaterial({color:"#b4c3a0",roughness:0.58});
const limbMaterial=new THREE.MeshStandardMaterial({color:"white",roughness:.65});
const ridgeArmor=new THREE.MeshStandardMaterial({color:"#65574b",roughness:.95,metalness:.1});
const weakTissue=new THREE.MeshStandardMaterial({color:"#eda46e",emissive:"#a34516",emissiveIntensity:.7});
const up=new THREE.Vector3(0,1,0);
export function CreatureView({id}:{id:number}) {const kind=connection.state?.stalkers.find(s=>s.id===id)?.kind;return kind==="surveyor"||kind==="sentinel"?<MachineView id={id}/>:kind&&['ambusher','grazer','scuttler','skimmer'].includes(kind)?<EcologicalCreatureView id={id}/>:<OrganismView id={id}/>;}
function OrganismView({id}:{id:number}) {
  const heavy=connection.state?.stalkers.find(s=>s.id===id)?.kind==="ridgeback",size=heavy?1.63:1;
  const form=useMemo(()=>morphology(connection.state?.seed??42,id,heavy?'ridgeback':'stalker'),[id,heavy]);
  const root=useRef<THREE.Group>(null), torso=useRef<THREE.Group>(null), head=useRef<THREE.Group>(null), organ=useRef<THREE.Mesh>(null);
  const limbs=useRef<THREE.InstancedMesh>(null), phase=useRef(0), lastTerrain=useRef(0), floors=useRef(new Array<number>(6).fill(-0.7));
  const memory=useMemo(()=>({a:new THREE.Vector3(),b:new THREE.Vector3(),dir:new THREE.Vector3(),transform:new THREE.Object3D(),feet:Array.from({length:6},()=>new THREE.Vector3(Infinity,0,0)),swing:new Array<boolean>(6).fill(true)}),[]);
  const glow=useMemo(()=>new THREE.MeshStandardMaterial({color:"#9aecd0",emissive:"#56d8b8",emissiveIntensity:1.2,roughness:0.3}),[]);
  useEffect(()=>()=>glow.dispose(),[glow]);
  useEffect(()=>{if(!limbs.current)return;const c=new THREE.Color();for(let i=0;i<18;i++)limbs.current.setColorAt(i,c.set(i%3===2?"#b4c3a0":"#3e6564"));limbs.current.instanceColor!.needsUpdate=true;},[]);
  useFrame((_,dt)=>{
    const state=connection.state, latest=state?.stalkers.find(s=>s.id===id), r=root.current;
    if(!latest||!r||!state)return;
    const s=connection.history.sampleStalker(id,performance.now()/1000)??latest;
    r.visible=latest.health>0 || state.time-(latest.diedAt??-100)>0 && state.time-(latest.diedAt??-100)<5;
    if(!r.visible)return;
    const far=connection.presentation?Math.hypot(s.x-connection.presentation.x,s.z-connection.presentation.z)>70:false;
    // Transform interpolation continues; detailed gait is throttled when distant.
    r.position.set(s.x,s.y,s.z);r.rotation.y=s.yaw;r.scale.set(size*form.width,size*organismTraits(state.seed,heavy).support,size*(.95+form.variant*.01));
    const pose=creaturePose(latest,state.time,s.motionSpeed??Math.hypot(s.vx,s.vz));
    if(torso.current){torso.current.position.y=pose.breathing-pose.death*0.48;torso.current.rotation.z=pose.flinch+pose.death*0.75;torso.current.scale.y=1+pose.charge*0.1;}
    if(head.current){head.current.rotation.x=-(pose.charge*0.35+pose.lunge);head.current.rotation.y=pose.alert?0:Math.sin(state.time*.75+id)*0.15;}
    glow.emissive.set(pose.charge>0?"#ff9664":pose.alert?"#c4e57b":"#56d8b8");glow.emissiveIntensity=1.1+pose.charge*3;
    if(organ.current)organ.current.scale.setScalar(0.14+pose.charge*0.15);
    phase.current+=dt*(s.motionSpeed??Math.hypot(s.vx,s.vz))*(heavy?2.4:3.2);
    if(far && state.time-lastTerrain.current<0.12)return;
    if(state.time-lastTerrain.current>0.08){
      lastTerrain.current=state.time;
      for(let i=0;i<6;i++){
        const side=i<3?-1:1,z=(i%3-1)*0.65,x=side*1.25;
        const wx=s.x+(Math.cos(s.yaw)*x+Math.sin(s.yaw)*z)*size,wz=s.z+(-Math.sin(s.yaw)*x+Math.cos(s.yaw)*z)*size;
        floors.current[i]=Math.max(-1.05,Math.min(-0.25,(ground(wx,wz,state.seed)-s.y+0.08)/size));
      }
    }
    const segment=(index:number,a:THREE.Vector3,b:THREE.Vector3,width:number)=>{
      if(!limbs.current)return;const o=memory.transform;o.position.copy(a).add(b).multiplyScalar(.5);memory.dir.copy(b).sub(a);o.scale.set(width,memory.dir.length(),width);o.quaternion.setFromUnitVectors(up,memory.dir.normalize());o.updateMatrix();limbs.current.setMatrixAt(index,o.matrix);
    };
    for(let i=0;i<6;i++){
      const side=i<3?-1:1,z=(i%3-1)*0.57;
      const cycle=phase.current+(i%2)*Math.PI+(i<3?0:Math.PI),stride=Math.sin(cycle)*pose.gait*.25;
      const lift=Math.max(0,Math.cos(cycle))*pose.gait*.22,foot=memory.feet[i],swing=Math.cos(cycle)>0;
      const planted=!swing&&pose.gait>.05;
      if(!planted||memory.swing[i]||!Number.isFinite(foot.x)||Math.hypot(foot.x-s.x,foot.z-s.z)>2.4*size){const lx=side*1.3,lz=z-stride;foot.set(s.x+(Math.cos(s.yaw)*lx+Math.sin(s.yaw)*lz)*size,0,s.z+(-Math.sin(s.yaw)*lx+Math.cos(s.yaw)*lz)*size);foot.y=ground(foot.x,foot.z,state.seed)+.045;}
      memory.swing[i]=swing;const dx=foot.x-s.x,dz=foot.z-s.z,fx=(Math.cos(s.yaw)*dx-Math.sin(s.yaw)*dz)/size,fz=(Math.sin(s.yaw)*dx+Math.cos(s.yaw)*dz)/size,fy=(foot.y-s.y)/size+lift;
      const a=memory.a.set(side*.43,-.04-pose.death*.2,z),b=memory.b.set(side*.94,-.05-pose.death*.3,z+stride*.4);
      segment(i*3,a,b,.095);
      a.copy(b);b.set(fx,Math.max(-1.25,fy),fz);
      segment(i*3+1,a,b,.072);
      a.copy(b);b.set(fx+side*.07,Math.max(-1.25,fy)+.015,fz+.1);
      segment(i*3+2,a,b,.045);
    }
    if(limbs.current)limbs.current.instanceMatrix.needsUpdate=true;
  });
  return <group ref={root} userData={{creatureId:id}}>
    <group ref={torso}>
      {heavy && <><mesh geometry={shell} material={ridgeArmor} position={[0,.27,0]} scale={[.78,.5,.8]} castShadow/>{[-1,1].map(side=><mesh key={side} geometry={plate} material={horn} position={[side*.55,.7,-.2]} scale={[.22,.65,.28]} rotation={[0,0,side*.3]}/>)}<mesh geometry={shell} material={weakTissue} position={[0,.03,-.86]} scale={[.37,.25,.16]}/></>}
      <mesh geometry={shell} material={underside} scale={[.64,.35,.86]} castShadow/>
      {[-1,0,1].map((n)=><group key={n} position={[0,.18,n*.4]}>
        <mesh geometry={shell} material={heavy?ridgeArmor:armor} scale={[.69,.29,.35]} castShadow/>
        <mesh geometry={plate} material={horn} position={[0,.36,-.06]} scale={[.13,.24,.2]} rotation={[-.4,0,0]}/>
        {[-1,1].map(side=><mesh key={side} geometry={joint} material={glow} position={[side*.58,.1,0]} scale={[.06,.045,.18]}/>)}
      </group>)}
      <group ref={head} position={[0,.03,.7]}>
        <mesh geometry={shell} material={armor} scale={[.4,.28,.36]} castShadow/>
        {[-1,1].map(side=><group key={side} position={[side*.25,0,.23]} rotation={[.3,side*.3,0]}>
          <mesh geometry={bone} material={horn} scale={[.06,.35,.06]} rotation={[1.1,0,side*.2]} position={[0,-.1,.08]}/>
          <mesh geometry={joint} material={glow} scale={[.08,.09,.08]} position={[side*.04,.13,0]}/>
          <mesh geometry={bone} material={underside} scale={[.025,.46,.025]} position={[side*.07,.3,0]} rotation={[.2,0,-side*.4]}/>
        </group>)}
        <mesh ref={organ} geometry={shell} material={glow} position={[0,.05,.32]} scale={.14}/>
      </group>
    <instancedMesh ref={limbs} args={[bone,limbMaterial,18]} frustumCulled={false}/>
    </group>
    {import.meta.env.DEV && <CreatureDebug id={id}/>}
  </group>;
}
function CreatureDebug({id}:{id:number}) {
  const ref=useRef<THREE.Group>(null);
  useFrame(()=>{if(ref.current)ref.current.visible=controls.physicsDebug;});
  return <group ref={ref} visible={false}>
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,.1,0]}><ringGeometry args={[COMBAT.stalker.vision-.04,COMBAT.stalker.vision,64,1,-Math.PI/2-COMBAT.stalker.visionHalfAngle,COMBAT.stalker.visionHalfAngle*2]}/><meshBasicMaterial color="#f6cd79" side={THREE.DoubleSide} transparent opacity={.35}/></mesh>
    <mesh><sphereGeometry args={[.8,12,8]}/><meshBasicMaterial color="#9df5db" wireframe/></mesh>
  </group>;
}
