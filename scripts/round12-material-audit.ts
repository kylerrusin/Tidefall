/** Reproducible CPU audit; no application or server state mutation. */
import {writeFileSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {terrainMesh,terrainApron} from '../src/geometry';
import {applyGeologicalSurface,BEDROCK_IDS} from '../src/geological-surface';
import {surfaceWeights} from '../src/terrain-material';
import {terrainCameras} from '../src/terrain-qa';
const baseline='640c4fce2456d34b5711a640ea82899f776907a9';
const audit=[42,-43].map(seed=>({seed,surfaces:[terrainMesh,terrainApron].map((make,level)=>{
 const m=make(seed),g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(m.vertices,3));g.setIndex(new THREE.BufferAttribute(m.indices,1));g.computeVertexNormals();applyGeologicalSurface(g,seed,{lod:level?2:0});
 const p=g.getAttribute('position'),n=g.getAttribute('normal'),f=g.getAttribute('surfaceField'),counts:Record<string,number>={},states={exposed:0,weathered:0,sediment:0};
 for(let i=0;i<p.count;i++){const id=BEDROCK_IDS[g.getAttribute('bedrockId').getX(i)];counts[id]=(counts[id]??0)+1;const w=surfaceWeights({x:n.getX(i),y:n.getY(i),z:n.getZ(i)},{deposition:f.getX(i),weathering:f.getY(i),competence:f.getZ(i)}),key=(['exposed','weathered','sediment'] as const).reduce((a,b)=>w[b]>w[a]?b:a);states[key]++;}
 const result={surface:level?'apron':'terrain',vertices:p.count,triangles:m.indices.length/3,geometrySha256:createHash('sha256').update(new Uint8Array(m.vertices.buffer)).update(new Uint8Array(m.indices.buffer)).digest('hex'),parentUnits:counts,macroVertexDominance:states,materialAttributeBytes:Object.entries(g.attributes).filter(([name])=>!['position','normal'].includes(name)).reduce((sum,[,a])=>sum+a.array.byteLength,0)};g.dispose();return result;
})}));
writeFileSync('evidence/round12/material-audit.json',JSON.stringify({baseline,note:'Macro dominance at mesh vertices, before fragment microheight and wetness; not an area-weighted survey.',audit},null,2)+'\n');
const old=JSON.parse(readFileSync('evidence/round12/cameras.json','utf8'));const views=terrainCameras();for(const previous of old.views){const current=views.find(v=>v.id===previous.id);if(JSON.stringify(current)!==JSON.stringify(previous))throw Error('Frozen pose changed: '+previous.id);}
writeFileSync('evidence/round12/cameras.json',JSON.stringify({baseline,views,lighting:{scenario:'server time 70; seed 42; preview duration 240',controlled:{azimuthRadians:.7,elevationDegrees:[12,55]}},note:'A–I and B5/B25/B100 have Round 11 comparisons. W/K are additional after-only verification views. B distance labels describe horizontal offsets; slant hit distances are printed on screenshots.'},null,2)+'\n');
console.log(JSON.stringify(audit,null,2));
