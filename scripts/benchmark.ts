import { Expedition, initPhysics } from "../src/simulation";
import { ground } from "../src/model";
import { creatureClearance } from "../src/creatures";
await initPhysics();
const percentile=(values:number[],q:number)=>[...values].sort((a,b)=>a-b)[Math.min(values.length-1,Math.floor(values.length*q))];
for(const seed of [42,-43])for(const count of [0,3]){
  const room=new Expedition("BENCH",seed),p=room.join();room.action(p.id,"ready");room.action(p.id,"start");room.time=9;
  p.z=-113;p.y=ground(p.x,p.z,seed)+1;room.bodies.get(p.id)!.setTranslation(p,true);
  room.stalkers.forEach((s,i)=>{
    if(i>=count){s.health=0;s.state="dead";room.stalkerColliders[i].setEnabled(false);return;}
    s.x=-18+i*8;s.z=-101;s.y=ground(s.x,s.z,seed)+creatureClearance(s.kind);s.yaw=Math.PI;s.state="idle";
    room.stalkerBodies[i].setTranslation(s,true);
  });
  room.world.step();const physics:number[]=[],ai:number[]=[];
  for(let tick=0;tick<720;tick++){
    p.health=100; // Benchmark fixture: keep the measured encounter running.
    room.step();if(tick>=120){physics.push(room.physicsMs);ai.push(room.aiMs);}
  }
  console.log(JSON.stringify({planet:seed<0?"pyrax":"tidefall",creatures:count,samples:physics.length,physicsMs:{median:percentile(physics,.5),p95:percentile(physics,.95),max:Math.max(...physics)},aiMs:{median:percentile(ai,.5),p95:percentile(ai,.95),max:Math.max(...ai)}}));
  room.dispose();
}
