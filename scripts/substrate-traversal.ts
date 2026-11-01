import {rockPlacements} from '../src/geometry';
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {Expedition,initPhysics} from '../src/simulation';
import {substrateData} from '../src/geological-substrate';
import {ground,geology} from '../src/model';
import {solidHeight} from '../src/surface-query';
import {moveCharacter,copyPosition} from '../src/locomotion';
type TraversalResult={seed:number;bodyId:number;family:string;start:{x:number;y:number;z:number};end:{x:number;y:number;z:number};walked:number;groundedFrames:number;minClearance:number;jetpackRise:number};
export async function substrateTraversal(seed:number){
 await initPhysics();const room=new Expedition('SUB-WALK',seed),p=room.join(),body=room.bodies.get(p.id)!,collider=room.colliders.get(p.id)!,controller=room.controllers.get(p.id)!,results:TraversalResult[]=[];
 try{for(const rock of substrateData(seed).bodies.filter(b=>!b.site.fragment&&b.site.x< -35&&b.site.z<20)){
  if(results.some(r=>r.family===rock.site.family))continue;
  const x=rock.bounds.maxX+1.5,start=rock.site.z-6,end=start+12;if(x>150||start< -145||end>145)continue;
  // This probe measures formation contacts; independent solid fragments are legitimate obstacles.
  if(rockPlacements(seed).some(r=>Math.abs(x-r.x)<r.size*2+.45&&r.z>start-r.size*2&&r.z<end+r.size*2))continue;
  if(Array.from({length:13},(_,i)=>start+i).some(z=>geology(x,z,seed).slope>.5||ground(x,z,seed)<12||solidHeight(x,z,seed)>ground(x,z,seed)+.1))continue;
  Object.assign(p,{x,z:start,y:solidHeight(x,start,seed)+1.02,vx:0,vy:0,vz:0,pushX:0,pushZ:0,fuel:100,grounded:false,lastJump:false});body.setTranslation(p,true);body.setNextKinematicTranslation(p);room.world.step();let grounded=0,minClearance=Infinity;
  const step=(z:number,jump=false)=>{moveCharacter(p,{x:0,z,yaw:0,jump,sprint:false,seq:p.ack+1},body,collider,controller,{depth:0,level:-100,u:0,v:0},[],1/60,seed,70,240);room.world.step();copyPosition(p,body);minClearance=Math.min(minClearance,p.y-ground(p.x,p.z,seed));if(p.grounded)grounded++;assert.ok(minClearance>.90,'capsule clipped terrain');};
  for(let i=0;i<60;i++)step(0);for(let i=0;i<160;i++)step(1);const walked=p.z-start;assert.ok(walked>11.5,`unexpected contact snag ${seed}/${rock.site.id}: ${walked}m`);for(let i=0;i<45;i++)step(0);const before=p.y;for(let i=0;i<40;i++)step(0,true);const rise=p.y-before;assert.ok(rise>1,'jetpack failed to rise');for(let i=0;i<300;i++)step(0);assert.ok(p.grounded,'jetpack did not land');assert.ok(p.y-solidHeight(p.x,p.z,seed)<1.25,'unsupported landing');results.push({seed,bodyId:rock.site.id,family:rock.site.family,start:{x,y:solidHeight(x,start,seed)+1.02,z:start},end:{x:p.x,y:p.y,z:p.z},walked,groundedFrames:grounded,minClearance,jetpackRise:rise});if(results.length===2)break;
 }assert.equal(results.length,2,'two representative geological routes required');return results;
 }finally{room.dispose();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const results=[];for(const seed of [42,-43])results.push(...await substrateTraversal(seed));writeFileSync('evidence/global-substrate/traversal.json',JSON.stringify(results,null,2)+'\n');console.log(JSON.stringify(results));}
