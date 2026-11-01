import RAPIER from "@dimforge/rapier3d-compat";
import { chemistry, surfaceAt, type Player, type Supply } from "./model";
import { pickupElevation } from "./placement";
import type { Water } from "./water";
type ResourceWorld={world:RAPIER.World;seed:number;time:number;players:Map<string,Player>;supplies:Supply[];resourceAt:number;resourceSerial:number;water:Water};
const SITES=[[-18,-105],[18,-105],[-28,-90],[28,-90],[-75,-78],[73,-74],[-103,-30],[102,-35],[-102,30],[110,28],[-50,-75],[48,-70]];
/** Reuse five slots, rotate dry sites and keep two/three accessible medical supplies. */
export function replenishMedical(r:ResourceWorld,force=false){
  if(!force&&r.time<r.resourceAt)return;r.resourceAt=r.time+5;
  const crew=[...r.players.values()].filter(p=>p.alive&&p.connected),minimum=Math.min(3,2+Math.floor(crew.length/3)),cooldown=Math.max(55,95-crew.length*7-r.time/25);
  for(const supply of r.supplies.filter(s=>s.id.startsWith("med-"))){
    if(supply.takenBy&&supply.respawnAt===undefined)supply.respawnAt=r.time+cooldown;
    if(!supply.takenBy&&supply.active!==false&&supply.expires!<r.time){supply.active=false;supply.respawnAt=r.time+30;}
  }
  const available=()=>r.supplies.filter(s=>s.kind==="bio"&&!s.takenBy&&s.active!==false&&r.water.sample(s.x,s.z).depth<.3).length;
  for(let attempt=0;attempt<SITES.length&&available()<minimum;attempt++){
    let slot=r.supplies.find(s=>s.id.startsWith("med-")&&(!!s.takenBy||s.active===false)&&(s.respawnAt??Infinity)<=r.time);
    const generated=r.supplies.filter(s=>s.id.startsWith("med-"));if(!slot&&generated.length>=5)break;
    const [x,z]=SITES[(r.resourceSerial+attempt)%SITES.length],surface=surfaceAt(x,z,r.seed),y=pickupElevation(x,z,.19,r.seed);
    if(surface.slope>.5||r.water.sample(x,z).depth>.25||chemistry(x,z,0,r.seed).temperature>(r.seed<0?1400:45)||crew.some(p=>Math.hypot(p.x-x,p.z-z)<10))continue;
    if(r.world.intersectionWithShape({x,y,z},{x:0,y:0,z:0,w:1},new RAPIER.Cuboid(.24,.16,.24)))continue;
    if(r.supplies.some(s=>s!==slot&&!s.takenBy&&s.active!==false&&Math.hypot(s.x-x,s.z-z)<6))continue;
    if(!slot){slot={id:`med-${generated.length}`,kind:"bio",x,y,z,takenBy:null,generation:0};r.supplies.push(slot);}
    Object.assign(slot,{x,y,z,takenBy:null,active:true,generation:(slot.generation??0)+1,respawnAt:undefined,expires:r.time+120});
    r.resourceSerial=(r.resourceSerial+attempt+3)%SITES.length;
  }
}
