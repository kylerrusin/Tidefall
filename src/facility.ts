import {FACILITY_SITES} from './domain/world-sites';
import {volcanicFacility} from './volcanic-facility';
import {ground,type V3} from './model';
import {shelterPlacements,type StructuralPart} from './placement';
export type DoorState={id:string;open:number;target:boolean};
export type DoorRecipe=StructuralPart&{id:string;airlock?:string};
export type FacilityRoom={id:string;name:string;x:number;z:number;record:string;halfX?:number;halfZ?:number;sample?:string};
export type FacilityPart=StructuralPart&{finish:'metal'|'glass'|'equipment'|'light'|'pipe'};
const names=['Geology laboratory','Biology containment','Atmospheric analysis','Operations center','Equipment store','Medical station','Crew quarters','Power and maintenance','Observation gallery','Emergency refuge'];
const records=[
 'Bedded carbonates overlie an older basaltic basement. Fault fluids have deposited silica in reopened joints.',
 'Speculative coastal colonies require liquid brine and light or a local chemical energy supply. No confirmed extraterrestrial organisms are represented.',
 'The atmospheric mixture is a scenario assumption. Stellar and planetary inputs come from the retained observational catalog.',
 'The offshore fault has shifted before. Never use the tidal flats as an evacuation waiting area.',
 'Portable reserves are finite. Leave heavy survey containers on their mechanical supports.',
 'Thermal exposure develops gradually. Wet suits lose heat quickly. Seal the compartment before resting.',
 'The last crew evacuated with their personal gear. Their tidal notebook remains in the observation gallery.',
 'Emergency power feeds compartment seals and survey instruments. External communications remain intermittent.',
 'A high tide damaged the lower coastline station. These elevated rooms were retained as the emergency refuge.',
 'Rescue approaches the high survey plateau. The final boarding window is limited; incidental boarding order does not decide rank.',
];
const cache=new Map<number,ReturnType<typeof build>>();
function build(seed:number){const {x,z}=FACILITY_SITES.marine;let y=-Infinity;for(let j=-19;j<=19;j+=1)for(let i=-10;i<=10;i+=1)y=Math.max(y,ground(x+i,z+j,seed));y+=.35;
 const parts:FacilityPart[]=[],doors:DoorRecipe[]=[],rooms:FacilityRoom[]=[];
 if(seed<0)return volcanicFacility(seed);
 const add=(px:number,py:number,pz:number,sx:number,sy:number,sz:number,role:StructuralPart['role']='wall',finish:FacilityPart['finish']='metal')=>parts.push({x:x+px,y:y+py,z:z+pz,sx,sy,sz,role,finish});
 add(0,-.18,0,10,.18,19,'floor');add(0,3.35,0,10,.18,19,'roof');
 for(const sign of [-1,1])for(let r=0;r<5;r++){const rz=-14+r*7,id='facility-'+(sign<0?r:r+5),index=sign<0?r:r+5;rooms.push({id,name:names[index],x:x+sign*6,z:z+rz,record:records[index],sample:index===0?'TDF-LT-031':index===8?'TDF-LT-043':undefined});
  // Corridor wall, framed door and broad exterior observation glazing.
  add(sign*2,1.6,rz-2.3,.12,1.6,1.2);add(sign*2,1.6,rz+2.3,.12,1.6,1.2);add(sign*2,3.05,rz,.12,.18,1.1);
  doors.push({id,x:x+sign*2,y:y+1.45,z:z+rz,sx:.13,sy:1.45,sz:1.07,role:'door'});
  add(sign*10,.5,rz,.15,.5,3.5);add(sign*10,3,rz,.15,.35,3.5);add(sign*10,1.8,rz,.06,.95,3.25,'glass','glass');
  add(sign*6,1.6,rz+3.5,4,1.6,.1);add(sign*9.75,1.6,rz-3.4,.18,1.6,.15);add(sign*9.75,1.6,rz+3.4,.18,1.6,.15);
  add(sign*6,.45,rz,.28,.45,.28,'wall','equipment');add(sign*6,.9,rz,.38,.06,.38,'wall','metal');
  // Modular table, rack, instrument body and raised display. Passage around each remains >1.5 m.
  add(sign*7.5,.8,rz,1.5,.07,.55,'wall','equipment');for(const dz of [-.4,.4])add(sign*8.5,.4,rz+dz,.06,.4,.06,'wall','pipe');
  add(sign*8.5,1.15,rz,.38,.27,.32,'wall','equipment');add(sign*8.5,1.43,rz,.3,.015,.24,'wall','light');
  add(sign*4.2,1.2,rz+2.5,1.3,.08,.45,'wall','equipment');for(const py of [.4,.9,1.5])add(sign*4.2,py,rz+2.5,1.1,.05,.4,'wall','equipment');
  add(sign*6,3.12,rz,1.8,.035,.06,'wall','light');add(sign*9.5,2.8,rz,.08,.08,3.3,'wall','pipe');
  if(index===1){add(sign*7.5,1.45,rz,1,.6,.65,'glass','glass');for(const dz of [-.65,.65])add(sign*7.5,1.45,rz+dz,1,.04,.04,'wall','pipe');}
  if(index===2)for(let k=0;k<4;k++){add(sign*8.8,.6,rz-2+k*.45,.18,.5,.18,'wall','equipment');add(sign*8.8,1.15,rz-2+k*.45,.08,.08,.08,'wall','pipe');}
  if(index===3)for(const dz of [-1.6,1.6]){add(sign*6,1,rz+dz,.9,.1,.45,'wall','equipment');add(sign*6,1.4,rz+dz+.3,.75,.35,.05,'wall','light');}
  if(index===4)for(let k=0;k<6;k++)add(sign*(5.3+(k%2)*1.5),.35+Math.floor(k/2)*.65,rz+2,.6,.3,.5,'wall','equipment');
  if(index===5){add(sign*6,.5,rz+1,1.6,.35,.65,'wall','equipment');add(sign*6,.9,rz+1,1.5,.07,.6,'wall','metal');add(sign*8,1.4,rz+1,.1,.7,.1,'wall','pipe');}
  if(index===6)for(const py of [.5,1.8]){add(sign*7,py,rz+1.6,1.7,.1,.65,'wall','equipment');add(sign*8.3,py+.15,rz+1.6,.3,.1,.6,'wall','metal');}
  if(index===7){add(sign*7,1,rz-1.7,1.8,1,.4,'wall','equipment');for(let k=0;k<5;k++)add(sign*(5.5+k*.65),1.2,rz-2.15,.1,.5,.04,'wall','light');}
  if(index===8)for(const dz of [-1.5,1.5])add(sign*7,.35,rz+dz,1,.3,.5,'wall','equipment');
  if(index===9){add(sign*7.7,1.25,rz-2.2,1.5,1.25,.4,'wall','equipment');add(sign*7.7,1.25,rz-2.65,.06,1,.04,'wall','light');}
 }
 // End walls have a true outer door and an inner airlock door in the central passage.
 add(0,1.6,19,10,1.6,.15);for(const sign of [-1,1]){add(sign*6,1.6,-19,4,1.6,.15);add(sign*6,1.6,-17.5,4,1.6,.1);}
 for(const dz of [-19,-17]){doors.push({id:dz===-19?'airlock-outer':'airlock-inner',airlock:'entrance',x,y:y+1.45,z:z+dz,sx:1.85,sy:1.45,sz:.13,role:'door'});add(0,3.05,dz,2,.18,.18);}
 // Terraced steps and piers are sampled against actual terrain, never floating foundations.
 const entry=ground(x,z-26,seed);for(let i=0;i<20;i++){const pz=z-19.3-i*.35,top=y-(y-entry)*i/20,bottom=ground(x,pz,seed)-.1;if(top>bottom)add(0,(top+bottom)/2-y,pz-z,1.7,(top-bottom)/2,.18,'foundation');}
 for(const px of [-9,0,9])for(const pz of [-17,-10,-3,4,11,17]){const base=ground(x+px,z+pz,seed)-.4;add(px,(y+base)/2-y,pz,.35,(y-base)/2,.35,'foundation');}
 for(const rz of [-17,-10,-3,4,11,17]){add(0,-.45,rz,9.5,.22,.12,'foundation','pipe');for(const sign of [-1,1]){add(sign*9.8,1.65,rz,.12,1.65,.12,'wall','pipe');add(sign*6,3.12,rz,3.8,.07,.06,'wall','pipe');}}
 return {x,y,z,parts,doors,rooms};
}
export function facility(seed:number){let f=cache.get(seed);if(!f){f=build(seed);cache.set(seed,f);if(cache.size>8)cache.delete(cache.keys().next().value!);}return f;}
export function doorRecipes(seed:number):DoorRecipe[]{return [...facility(seed).doors,...shelterPlacements(seed).map(s=>({id:'shelter-'+s.id,x:s.x,y:s.y+1.5,z:s.z-3,sx:2.78,sy:1.5,sz:.13,role:'door' as const}))];}
export const initialDoors=(seed:number):DoorState[]=>doorRecipes(seed).map(d=>({id:d.id,open:d.id.endsWith('airlock-inner')?0:1,target:!d.id.endsWith('airlock-inner')}));
export function interactionDoor(p:V3&{yaw:number},seed:number){const score=(d:DoorRecipe)=>{const dx=d.x-p.x,dz=d.z-p.z,length=Math.max(.01,Math.hypot(dx,dz)),facing=(dx*Math.sin(p.yaw)+dz*Math.cos(p.yaw))/length;return Math.hypot(dx,d.y-p.y,dz)+Math.max(0,.6-facing)*3;};return doorRecipes(seed).filter(d=>Math.hypot(d.x-p.x,d.y-p.y,d.z-p.z)<2.8).sort((a,b)=>score(a)-score(b))[0];}
export function doorPosition(d:DoorRecipe,state:DoorState):V3{return {x:d.x,y:d.y+state.open*d.sy,z:d.z};}
export function doorSize(d:DoorRecipe,state:DoorState){return {x:d.sx,y:d.sy*Math.max(.005,1-state.open),z:d.sz};}
export function protectedRoom(p:V3,seed:number,doors:DoorState[]){const f=facility(seed);if(Math.abs(p.y-(f.y+1))>1.5)return null;return f.rooms.find(r=>Math.abs(p.x-r.x)<(r.halfX??3.6)&&Math.abs(p.z-r.z)<(r.halfZ??3.25)&&(doors.find(d=>d.id===r.id)?.open??1)<.03)??null;}
export function commandDoor(id:string,states:DoorState[],seed:number,occupied:(recipe:DoorRecipe)=>boolean){const d=states.find(d=>d.id===id),recipe=doorRecipes(seed).find(d=>d.id===id);if(!d||!recipe)return false;
 if(d.target&&occupied(recipe))return false;
 if(!d.target&&recipe.airlock){const other=doorRecipes(seed).find(o=>o.id!==id&&o.airlock===recipe.airlock)!,state=states.find(s=>s.id===other.id);if((state?.open??1)>.03||state?.target){if(state&&!occupied(other))state.target=false;return false;}}
 d.target=!d.target;return true;}
