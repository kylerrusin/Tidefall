import {applyGeologicalSurface} from './geological-surface';
import * as THREE from 'three';
import {useMemo,useEffect,useRef} from 'react';
import {useFrame} from '@react-three/fiber';
import {geologicalMaterial} from './materials';
import {GEOLOGY} from './geological-catalog';
import {heroOutcrops,simplifyOutcrop} from './hero-outcrop';
function HeroOutcrop({id,seed}:{id:number;seed:number}){const ref=useRef<THREE.Group>(null),h=useMemo(()=>heroOutcrops(seed)[id],[seed,id]),data=useMemo(()=>{const material=geologicalMaterial('white',true,true,true,0,true);material.side=THREE.DoubleSide;const geometries=[h.mesh,simplifyOutcrop(h.mesh,.2),simplifyOutcrop(h.mesh,.45)].map((m,level)=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(m.vertices,3));g.setIndex(new THREE.BufferAttribute(m.indices,1));g.computeVertexNormals();applyGeologicalSurface(g,seed,{lod:level,unitId:h.unitId});g.computeBoundingBox();g.computeBoundingSphere();return g;});return {material,geometries};},[h]);useEffect(()=>()=>{data.material.dispose();data.geometries.forEach(g=>g.dispose());},[data]);useFrame(({camera})=>{const d=Math.hypot(camera.position.x-h.x,camera.position.z-h.z),level=d<65?0:d<140?1:2;ref.current?.children.forEach((mesh,i)=>mesh.visible=i===level);});return <group ref={ref} name={'survey-outcrop-'+id} userData={{inspection:'rock',identity:h.unitId,addedOutcrop:h.id>=2}}>{data.geometries.map((g,i)=><mesh key={i} geometry={g} material={data.material} castShadow receiveShadow/>)}</group>;}
export function FormationView({seed}:{seed:number}){const heroes=useMemo(()=>heroOutcrops(seed),[seed]);return <>{heroes.map(({id})=><HeroOutcrop key={'hero'+id} seed={seed} id={id}/>)}</>;}
