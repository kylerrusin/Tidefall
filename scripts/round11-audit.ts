import {writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {terrainMesh,terrainApron} from '../src/geometry';
import {geology} from '../src/model';
import {geologicalField} from '../src/geological-fields';
import {biosphere} from '../src/biology';
import {oceanContinuationBuffers,updateOceanContinuation} from '../src/ocean-continuation';
import {Water} from '../src/water';
import {weatherAt} from '../src/climate';
const hash=(data:{vertices:Float32Array;indices:Uint32Array})=>createHash('sha256').update(new Uint8Array(data.vertices.buffer)).update(new Uint8Array(data.indices.buffer)).digest('hex');
const maps=[42,-43].map(seed=>{let samples=0,previouslySuppressed=0,substantialRock=0,steep=0,steepRich=0,regolith=0,regolithRich=0;for(let z=-125;z<145;z+=5)for(let x=-145;x<145;x+=5){const g=geology(x,z,seed);samples++;if(g.unit.treatment==='grains')previouslySuppressed++;if(g.appearance.rock>.4)substantialRock++;if(g.slope>.5){steep++;if(g.appearance.rock>.95)steepRich++;}if(g.unitId==='TDF-SD-016'){regolith++;if(g.appearance.rock>.4)regolithRich++;}}return {seed,samples,previouslySuppressedNormalAndRoughness:previouslySuppressed,substantialRock,steep,steepRich,regolith,regolithRich,terrainSha256:hash(terrainMesh(seed)),apronSha256:hash(terrainApron(seed))};});
let switches=0,maxJump=0;for(const seed of [42,-43])for(const x of [-90,-60,0,55,100]){let previous=geologicalField(x,15,0,.32,seed);for(let h=.025;h<65;h+=.025){const g=geologicalField(x,15,h,.32,seed);if(g.unitId!==previous.unitId||g.facies!==previous.facies)switches++;maxJump=Math.max(maxJump,...g.color.map((v,k)=>Math.abs(v-previous.color[k])));previous=g;}}
const plants=biosphere(42),neighbors=plants.map((p,i)=>Math.min(...plants.filter((_,j)=>j!==i).map(q=>Math.hypot(p.x-q.x,p.z-q.z))));
const water=new Water(42),continuation=oceanContinuationBuffers(42),samples:number[]=[];for(let i=0;i<80;i++){const start=performance.now();updateOceanContinuation(continuation,water.levels(),weatherAt(0).sea);samples.push(performance.now()-start);}samples.sort((a,b)=>a-b);
const evidence={at:new Date().toISOString(),baseline:'22ca0f69edbeb2e6e069c6170b2c367f971d16f4',maps,appearanceContinuity:{sampleStepMetres:.025,catalogOrFaciesSwitches:switches,maxColorComponentJump:maxJump},plants:{count:plants.length,clusters:new Set(plants.map(p=>p.cluster)).size,forms:[...new Set(plants.map(p=>p.form))],within4mOfNeighbor:neighbors.filter(d=>d<4).length,meanNearestNeighborMetres:neighbors.reduce((a,b)=>a+b,0)/neighbors.length,minSize:Math.min(...plants.map(p=>p.size)),maxSize:Math.max(...plants.map(p=>p.size))},waterContinuation:{boundaryVertices:512,sides:4,renderedTriangles:continuation.count/3,cpuMs:{median:samples[40],p95:samples[76],max:samples.at(-1)}},limits:['CPU timings are local microbenchmarks, not a whole-frame or controlled GPU benchmark.','Coverage weights measure material eligibility, not photographic quality.','Reference example image was not present in the accessible attachment.']};
await writeFile('ROUND11-evidence.json',JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify(evidence,null,2));
