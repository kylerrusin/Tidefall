import * as THREE from "three";
import { useEffect, useMemo, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { controls } from "./controls";
import { visibilityReport } from "./instance-bounds";
/** F6: bounds -> three uncullled comparison copies -> off. The world stays culled. */
export function VisibilityDiagnostics({mesh}:{mesh:RefObject<THREE.InstancedMesh|null>}) {
  const {camera}=useThree();
  const data=useMemo(()=>({group:new THREE.Group(),matrix:new THREE.Matrix4(),frustum:new THREE.Frustum(),previous:-1}),[]);
  useEffect(()=>()=>{data.group.traverse(o=>{const m=o as THREE.Mesh;m.geometry?.dispose();if(m.material)(m.material as THREE.Material).dispose();});},[data]);
  useFrame(()=>{
    const rock=mesh.current,mode=controls.visibilityDebug;
    data.group.visible=mode>0;if(!rock||!mode)return;
    if(data.previous!==mode){
      for(const o of [...data.group.children]){data.group.remove(o);o.traverse(c=>{const m=c as THREE.Mesh;m.geometry?.dispose();if(m.material)(m.material as THREE.Material).dispose();});}
      rock.updateMatrixWorld();
      const box=rock.boundingBox!.clone().applyMatrix4(rock.matrixWorld);
      data.group.add(new THREE.Box3Helper(box,0x55ff99));
      const frozen=camera.clone();frozen.updateMatrixWorld();const frustum=new THREE.CameraHelper(frozen);data.group.add(frustum);
      data.frustum.setFromProjectionMatrix(data.matrix.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
      const indices=Array.from({length:rock.count},(_,i)=>{rock.getMatrixAt(i,data.matrix);const p=new THREE.Vector3().setFromMatrixPosition(data.matrix).applyMatrix4(rock.matrixWorld);return {i,d:p.distanceTo(camera.position),visible:data.frustum.containsPoint(p)};}).filter(v=>v.visible).sort((a,b)=>a.d-b.d).slice(0,3);
      for(const {i} of indices){
        rock.getMatrixAt(i,data.matrix);const world=new THREE.Matrix4().multiplyMatrices(rock.matrixWorld,data.matrix);
        data.group.add(new THREE.Box3Helper(rock.geometry.boundingBox!.clone().applyMatrix4(world),0xffc66d));
        const axes=new THREE.AxesHelper(2);axes.applyMatrix4(world);data.group.add(axes);
        if(mode===2){const copy=new THREE.Mesh(rock.geometry.clone(),new THREE.MeshBasicMaterial({color:0xff55cc,wireframe:true,depthTest:false}));copy.applyMatrix4(world);copy.frustumCulled=false;data.group.add(copy);}
      }
      data.previous=mode;
    }
    data.frustum.setFromProjectionMatrix(data.matrix.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
    visibilityReport.text=`${rock.count} rocks · visible ${rock.visible} · culled ${rock.frustumCulled} · frustum ${data.frustum.intersectsObject(rock)} · bounds radius ${rock.boundingSphere!.radius.toFixed(1)} m · geometry radius ${rock.geometry.boundingSphere!.radius.toFixed(2)} m · world origin ${rock.position.toArray().join(",")} · LOD fixed · chunk 320 m resident · ${mode===2?"3 nearest magenta copies unculled":"aggregate green / instances amber / axes origins / frozen camera frustum"}`;
  });
  return <primitive object={data.group}/>;
}
