import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {triplanarWeights,triplanarNormal,triplanarCoordinates,unitNormal} from '../src/triplanar';
import {surfaceWeights} from '../src/terrain-material';
import {geologicalField,reconstructedAppearance} from '../src/geological-fields';
import {applyGeologicalSurface,renderedGeologicalSurface,BEDROCK_IDS} from '../src/geological-surface';
import {geologicalMaterial} from '../src/materials';
import {terrainMesh,terrainApron} from '../src/geometry';
import {formations,formationMesh,formationContactBlend} from '../src/formations';
const flat={x:0,y:0,z:1};

test('triplanar weights normalize for axis, grazing, zero and invalid normals',()=>{
 for(const n of [{x:0,y:0,z:0},{x:NaN,y:0,z:0},...Array.from({length:400},(_,i)=>({x:Math.sin(i*.73),y:Math.cos(i*.31),z:Math.sin(i*.27)}))]){const w=triplanarWeights(n);assert.ok(w.every(v=>Number.isFinite(v)&&v>=0));assert.ok(Math.abs(w.reduce((a,b)=>a+b,0)-1)<1e-12);}
});
test('flat normal maps preserve the geometric normal on all signed projection frames',()=>{
 for(let i=0;i<200;i++){const n=unitNormal({x:Math.sin(i*1.7),y:Math.cos(i*.2),z:Math.cos(i*.9)}),mapped=triplanarNormal(n,[flat,flat,flat]);assert.ok(Math.hypot(n.x-mapped.x,n.y-mapped.y,n.z-mapped.z)<1e-12);}
 for(const sign of [-1,1]){const n={x:sign,y:0,z:0},mapped=triplanarNormal(n,[{x:.3,y:0,z:1},flat,flat]);assert.ok(mapped.x*sign>0&&mapped.z*sign<0);}
});
test('a 2.4 metre repeat has the same scale on horizontal and vertical signed faces',()=>{
 const p={x:70,y:20,z:-40};for(const sign of [-1,1]){const horizontal=triplanarCoordinates(p,{x:0,y:sign,z:0}),h=triplanarCoordinates({...p,x:p.x+2.4},{x:0,y:sign,z:0}),vertical=triplanarCoordinates(p,{x:sign,y:0,z:0}),v=triplanarCoordinates({...p,y:p.y+2.4},{x:sign,y:0,z:0});assert.ok(Math.abs(h[1][0]-horizontal[1][0]-1)<1e-12);assert.ok(Math.abs(v[0][1]-vertical[0][1]-1)<1e-12);}
});
test('cover weights stay bounded, normalized and restricted to adjacent material states',()=>{
 const seen=new Set<string>();for(let d=0;d<=1;d+=.025)for(const slope of [0,.25,1,3])for(const microheight of [0,.5,1]){const w=surfaceWeights({x:-slope,y:1,z:0},{deposition:d,weathering:.6,competence:1},microheight),a=[w.exposed,w.weathered,w.sediment];assert.ok(a.every(v=>Number.isFinite(v)&&v>=0&&v<=1));assert.ok(Math.abs(a.reduce((a,b)=>a+b)-1)<1e-12);assert.ok(a.filter(v=>v>1e-8).length<=2);seen.add(['rock','weathered','sediment'][a.indexOf(Math.max(...a))]);}assert.equal(seen.size,3);
 const cover={deposition:.8,weathering:.5,competence:1};assert.ok(surfaceWeights({x:0,y:1,z:0},cover).sediment>.6);assert.ok(surfaceWeights({x:3,y:1,z:0},cover).exposed>.9);
 assert.ok(surfaceWeights({x:3,y:1,z:0},{deposition:.86,weathering:.65,competence:.3}).exposed>.99,'unconsolidated cover clears from very steep faces');
});
test('world material fields are deterministic, diverse and continuous inside the same unit',()=>{
 const units=new Set<string>();let smooth=0;for(const seed of [42,-43])for(let x=-120;x<130;x+=10)for(let z=-100;z<100;z+=10){const a=geologicalField(x,z,10,.3,seed),b=geologicalField(x+.001,z,10,.3,seed);assert.deepEqual(a,geologicalField(x,z,10,.3,seed));units.add(a.appearance.bedrockId);if(a.unitId===b.unitId){smooth++;assert.ok(Math.abs(a.appearance.inputs.deposition-b.appearance.inputs.deposition)<.001);}}assert.ok(smooth>900);assert.ok(units.size>=3);
});
test('bedrock parent units do not inherit the fine catalog cycle across a tall apron face',()=>{
 for(const [x,z]of [[100,-250],[-110,-250],[0,-250]]){const ids=new Set<string>();for(let height=25;height<180;height+=.25)ids.add(geologicalField(x,z,height,.7,42).appearance.bedrockId);assert.equal(ids.size,1,`${x},${z} has aliased parent units`);}
});
test('dry weak regolith keeps granular cover without adding water or clouds to Pyrax',()=>{const a=reconstructedAppearance(0,0,10,0,-43,{basalt:1,carbonate:0,sediment:0,regolith:0},'TDF-SD-017');assert.ok(a.states.sediment>.99);assert.equal(a.sedimentId,'TDF-SD-017');});
const triangle=()=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([0,10,0,10,10,0,0,10,10],3));g.setIndex([0,2,1]);g.computeVertexNormals();return g;};
test('material identities and deposition fields do not depend on an LOD normal or level',()=>{
 const a=triangle(),b=triangle();b.setAttribute('normal',new THREE.Float32BufferAttribute([1,0,0,1,0,0,1,0,0],3));applyGeologicalSurface(a,42,{lod:0});applyGeologicalSurface(b,42,{lod:2});for(const name of ['bedrockId','color','coverColor','surfaceField','surfaceStyle'])assert.deepEqual(a.getAttribute(name).array,b.getAttribute(name).array);assert.equal(b.getAttribute('materialLod').getX(0),2);a.dispose();b.dispose();
});
test('real near/apron boundary and nested formation vertices share their material fields',()=>{
 const geometry=(m:{vertices:Float32Array;indices:Uint32Array})=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(m.vertices,3));g.setIndex(new THREE.BufferAttribute(m.indices,1));g.computeVertexNormals();return g;};
 const near=applyGeologicalSurface(geometry(terrainMesh(42)),42),far=applyGeologicalSurface(geometry(terrainApron(42)),42,{lod:2}),p=near.getAttribute('position'),lookup=new Map<string,number>();for(let i=0;i<p.count;i++)lookup.set(p.getX(i)+':'+p.getZ(i),i);
 for(let i=0;i<512;i++){const v=far.getAttribute('position'),j=lookup.get(v.getX(i)+':'+v.getZ(i))!;assert.notEqual(j,undefined);for(const name of ['color','surfaceField','coverColor'])for(let k=0;k<3;k++)assert.equal(far.getAttribute(name).getComponent(i,k),near.getAttribute(name).getComponent(j,k));}
 const f=formations(42)[0],options={unitId:f.unitId,contact:(x:number,y:number,z:number)=>formationContactBlend(x,y,z,42)},a=applyGeologicalSurface(geometry(formationMesh(f,42,0)),42,options),b=applyGeologicalSurface(geometry(formationMesh(f,42,1)),42,{...options,lod:1});for(const g of [a,b]){assert.ok(g.getAttribute('position').count>10);for(const name of ['color','surfaceField','bedrockId'])assert.ok(Array.from(g.getAttribute(name).array).every(Number.isFinite));}
 for(const g of [near,far,a,b])g.dispose();
});
test('inspection interpolates the visible triangle field and preserves formation identity',()=>{
 const g=applyGeologicalSurface(triangle(),42,{lod:1,unitId:'TDF-LT-043'}),m=new THREE.Mesh(g,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));m.position.set(4,2,-5);m.updateMatrixWorld(true);const hit=new THREE.Raycaster(new THREE.Vector3(6,30,-3),new THREE.Vector3(0,-1,0)).intersectObject(m)[0],surface=renderedGeologicalSurface(hit)!;assert.ok(surface);assert.equal(surface.unit.id,'TDF-LT-043');assert.equal(surface.unit.id,BEDROCK_IDS[g.getAttribute('bedrockId').getX(hit.face!.a)]);assert.equal(surface.lod,1);assert.equal(surface.inputs.deposition,0);assert.equal(surface.states.exposed,1);g.dispose();m.material.dispose();
});
test('a weathered-regolith formation retains cover above its parent bedrock',()=>{const g=applyGeologicalSurface(triangle(),42,{unitId:'TDF-SD-016'}),m=new THREE.Mesh(g,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));m.updateMatrixWorld(true);const hit=new THREE.Raycaster(new THREE.Vector3(2,30,2),new THREE.Vector3(0,-1,0)).intersectObject(m)[0],surface=renderedGeologicalSurface(hit)!;assert.equal(surface.unit.id,'TDF-LT-034');assert.ok(surface.states.weathered>.99);assert.ok(surface.inputs.deposition>.35);g.dispose();m.material.dispose();});
test('near, solid rock and far material variants inject valid shared shader contracts',()=>{
 for(const [blend,far]of [[true,false],[false,false],[true,true]]){const mat=geologicalMaterial('white',true,blend,blend,0,blend,far),shader={...THREE.ShaderLib.standard,uniforms:{...THREE.ShaderLib.standard.uniforms}};mat.onBeforeCompile(shader as never,{} as never);assert.ok(shader.fragmentShader.includes('geoMappedNormal'));assert.ok(shader.fragmentShader.includes('geologicalCoverage'));assert.ok(!/\b(?:NaN|Infinity|undefined)\b/.test(shader.fragmentShader));assert.ok(shader.vertexShader.includes('vGeoNormal=inverseTransformDirection'));mat.dispose();}
 for(const n of [{x:0,y:1,z:0},{x:-1,y:0,z:0},{x:.01,y:.000001,z:-1}])for(const p of [{x:1200,y:-50,z:-1200},{x:0,y:0,z:0}])assert.ok(triplanarCoordinates(p,n).flat().every(Number.isFinite));
});
