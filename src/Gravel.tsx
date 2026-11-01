import {GRAVEL_GEOMETRY} from './rock-asset';
import * as THREE from "three";
import {useEffect,useMemo,useRef} from "react";
import {solidSurface as surfaceAt} from './surface-query';
import {hash} from "./model";
import {refreshInstanceBounds} from "./instance-bounds";
export function Gravel({seed}:{seed:number}){
  const ref=useRef<THREE.InstancedMesh>(null),points=useMemo(()=>{const list=[];for(let i=0;i<2400;i++){const x=(hash(seed,i,821)-.5)*265,z=hash(seed,i,822)*240-120,s=surfaceAt(x,z,seed);if(s.slope>.7||s.height< -2||hash(seed,i,823)>(s.slope>.2?.85:.5))continue;list.push({x,y:s.height,z,size:.025+hash(seed,i,824)*.105,angle:hash(seed,i,825)*6.28});}return list;},[seed]);
  useEffect(()=>{const object=new THREE.Object3D(),color=new THREE.Color();points.forEach((p,i)=>{object.position.set(p.x,p.y+p.size*.35,p.z);object.scale.set(p.size,p.size*.55,p.size*.8);object.rotation.set(.2,p.angle,.1);object.updateMatrix();ref.current!.setMatrixAt(i,object.matrix);ref.current!.setColorAt(i,color.set(seed<0?"#504947":"#77766a").multiplyScalar(.75+hash(seed,i,826)*.5));});refreshInstanceBounds(ref.current!);},[points,seed]);
  return <instancedMesh ref={ref} args={[undefined,undefined,points.length]} receiveShadow><primitive object={GRAVEL_GEOMETRY} attach="geometry"/><meshStandardMaterial color="white" roughness={.95}/></instancedMesh>;
}
