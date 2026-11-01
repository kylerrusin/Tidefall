import {regionalPalette} from './regional-palette';
import * as THREE from 'three';
import {geologicalField} from './geological-fields';
import {GEOLOGY,SURFACE_TREATMENTS} from './geological-catalog';
import {bedrockForSurface,surfaceWeights,type SurfaceInputs} from './terrain-material';
import {geology} from './model';

export const BEDROCK_IDS=Object.keys(GEOLOGY);
export const unitDebugColor=(id:string)=>{const i=Math.max(0,BEDROCK_IDS.indexOf(id));return new THREE.Color().setHSL((i*.61803398875)%1,.7,.55);};
type SurfaceOptions={lod?:number;unitId?:string;contact?:(x:number,y:number,z:number)=>number;apron?:boolean;smooth?:boolean;unitIds?:readonly string[];contactWeights?:ArrayLike<number>};
/** One attribute builder for near terrain, the apron and formation LODs. Positions and indices are untouched. */
export function applyGeologicalSurface(g:THREE.BufferGeometry,seed:number,options:SurfaceOptions={}){
 const normals=options.apron?g.getAttribute('normal'):null;
 if(options.apron&&!normals)throw new Error('Apron classification requires computed mesh normals');
 const p=g.getAttribute('position'),names=['color','coverColor','surfaceField','surfaceStyle','unitColor'] as const,arrays=Object.fromEntries(names.map(name=>[name,new Float32Array(p.count*3)])) as Record<typeof names[number],Float32Array>,ids=new Float32Array(p.count),lod=new Float32Array(p.count),c=new THREE.Color(),s=new THREE.Color();
 for(let i=0;i<p.count;i++){
  const x=p.getX(i),y=p.getY(i),z=p.getZ(i),slope=normals?Math.hypot(normals.getX(i),normals.getZ(i))/Math.max(1e-5,Math.abs(normals.getY(i))):geology(x,z,seed).slope,field=geologicalField(x,z,y,slope,seed),a=field.appearance,vertexUnit=options.unitIds?.[i]??options.unitId,contact=options.contactWeights?.[i]??options.contact?.(x,y,z)??(vertexUnit?1:0),override=vertexUnit?GEOLOGY[vertexUnit]:null,weak=!!override&&override.strengthMPa<5,unit=override?(weak?bedrockForSurface(override,field.weights,x,z):override):GEOLOGY[a.bedrockId],rgb=a.bedrockColor.map((v,k)=>v*(1-contact)+unit.color[k]*contact),inputs={deposition:a.inputs.deposition*(1-contact)+(weak?.36:0)*contact,weathering:a.inputs.weathering*(1-contact)+(weak?.65:a.inputs.weathering*.35)*contact,competence:a.inputs.competence*(1-contact)+(weak?.45:1)*contact};
  const states=options.smooth?surfaceWeights({x:g.getAttribute('normal').getX(i),y:g.getAttribute('normal').getY(i),z:g.getAttribute('normal').getZ(i)},inputs):null,appearance=states?rgb.map((v,k)=>v*(states.exposed+states.weathered*.8)+a.sedimentColor[k]*(states.sediment+states.weathered*.2)):rgb;
  const palette=regionalPalette(appearance,seed,x,z,states?.cover??0),coverPalette=regionalPalette(a.sedimentColor,seed,x,z,1);c.setRGB(...palette as [number,number,number],THREE.SRGBColorSpace);s.setRGB(...coverPalette as [number,number,number],THREE.SRGBColorSpace);
  arrays.color.set(c.toArray(),i*3);arrays.coverColor.set(s.toArray(),i*3);arrays.surfaceField.set([inputs.deposition,inputs.weathering,inputs.competence],i*3);arrays.surfaceStyle.set([SURFACE_TREATMENTS[unit.treatment],field.porosity,field.alteration],i*3);
  const id=contact>.5?unit.id:a.bedrockId;ids[i]=BEDROCK_IDS.indexOf(id);arrays.unitColor.set(unitDebugColor(id).toArray(),i*3);lod[i]=options.lod??0;
 }
 for(const name of names)g.setAttribute(name,new THREE.BufferAttribute(arrays[name],3));g.setAttribute('bedrockId',new THREE.BufferAttribute(ids,1));g.setAttribute('materialLod',new THREE.BufferAttribute(lod,1));return g;
}
/** Inspector reads the actual rendered triangle attributes, including formation contacts and its active LOD. */
export function renderedGeologicalSurface(hit:THREE.Intersection){
 const mesh=hit.object as THREE.Mesh,g=mesh.geometry,face=hit.face;if(!g||!face||(!g.hasAttribute('surfaceField')||!g.hasAttribute('bedrockId')||!g.hasAttribute('materialLod')))return null;
 const local=mesh.worldToLocal(hit.point.clone()),p=g.getAttribute('position'),a=new THREE.Vector3().fromBufferAttribute(p,face.a),b=new THREE.Vector3().fromBufferAttribute(p,face.b),c=new THREE.Vector3().fromBufferAttribute(p,face.c),bary=THREE.Triangle.getBarycoord(local,a,b,c,new THREE.Vector3());if(!bary)return null;
 const vertices=[face.a,face.b,face.c],weights=bary.toArray(),sample=(name:string)=>{const attr=g.getAttribute(name);return new THREE.Vector3(...[0,1,2].map(k=>vertices.reduce((sum,v,i)=>sum+attr.getComponent(v,k)*weights[i],0)) as [number,number,number]);};
 const normal=sample('normal').applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld)),f=sample('surfaceField'),inputs:SurfaceInputs={deposition:f.x,weathering:f.y,competence:f.z},states=surfaceWeights(normal,inputs),largest=weights.indexOf(Math.max(...weights)),unit=GEOLOGY[BEDROCK_IDS[g.getAttribute('bedrockId').getX(vertices[largest])]];
 return {unit,inputs,states,lod:g.getAttribute('materialLod').getX(face.a)};
}
