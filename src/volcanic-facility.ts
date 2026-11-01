import {FACILITY_SITES} from './domain/world-sites';
import {solidHeight as ground} from './surface-query';
import {footprint} from './placement';
import type {FacilityPart,FacilityRoom,DoorRecipe} from './facility';
/** A broad raised ceramic-shielded installation, sharing the authoritative architecture/door contract. */
export function volcanicFacility(seed:number){const {x,z}=FACILITY_SITES.volcanic;let y=-Infinity;for(let dz=-22;dz<=22;dz+=2)for(let dx=-18;dx<=18;dx+=2)y=Math.max(y,ground(x+dx,z+dz,seed));y+=1.2;const parts:FacilityPart[]=[],rooms:FacilityRoom[]=[],doors:DoorRecipe[]=[];
 const add=(px:number,py:number,pz:number,sx:number,sy:number,sz:number,finish:FacilityPart['finish']='metal',role:FacilityPart['role']='wall')=>parts.push({x:x+px,y:y+py,z:z+pz,sx,sy,sz,finish,role});
 add(0,-.3,0,18,.3,22,'metal','floor');add(0,4.35,0,18,.3,22,'metal','roof');
 const names=['Thermal sample laboratory','Robotic service bay','Cooling plant','Magma observation gallery','Pressure and gas analysis','Power distribution','Communications and control','Emergency chassis refuge'];
 const records=['Melt temperatures, cooling and viscosity are local reduced-model values. No surface sample has been returned from 55 Cancri e.','The exterior expedition uses a fictional heat-shielded telepresence chassis. Ordinary exposed human survival is not represented.','Raised ceramic shields and closed compartments reduce the modeled thermal load. Cooling reserves remain finite.','Webb observations support a possible volatile atmosphere. This visible local lava landscape is an assumed reconstruction.','The scenario pressure and local chemistry remain assumptions, distinct from the measured planetary mass, radius and orbit.','Remote instrument power and coolant distribution share the insulated service spine.','Surface geometry, lava transport and protective doors are synchronized by the simulation server.','Close the compartment door before servicing the chassis. Launch requires boarding the rescue cabin before the hatch closes.'];
 for(const side of [-1,1])for(let j=0;j<4;j++){const index=(side<0?0:4)+j,rz=-15+j*10,id='pyrax-bay-'+index;rooms.push({id,name:names[index],record:records[index],x:x+side*10.5,z:z+rz,halfX:6.3,halfZ:4.55});
  add(side*3.3,2,rz-3.2,.2,2,1.8);add(side*3.3,2,rz+3.2,.2,2,1.8);add(side*3.3,3.55,rz,.2,.55,1.45);doors.push({id,x:x+side*3.3,y:y+1.5,z:z+rz,sx:.2,sy:1.5,sz:1.4,role:'door'});
  add(side*18,.6,rz,.32,.6,5);add(side*18,3.8,rz,.32,.5,5);add(side*18,2.15,rz,.12,.95,4.6,'glass','glass');
  add(side*10.5,2.05,rz+5,7.5,2.05,.2);add(side*10.5,.5,rz,.45,.5,.45,'equipment');
  for(const dz of [-3,3]){add(side*13,.85,rz+dz,3,.12,.7,'equipment');for(const dx of [-2.5,2.5])add(side*13+dx,.4,rz+dz,.08,.4,.5,'pipe');add(side*13,1.5,rz+dz,2.4,.5,.3,'equipment');for(let k=0;k<5;k++)add(side*13-2+k,1.6,rz+dz-.32,.27,.12,.025,'light');}
  for(const dx of [-17,-10,-3.5]){add(side*Math.abs(dx),3.9,rz,.08,.08,4.5,'pipe');add(side*Math.abs(dx),2.1,rz+4.7,.12,2.1,.13,'pipe');}
  add(side*10,4.02,rz,4,.04,.08,'light');
 }
 add(0,2.05,22,18,2.05,.3);for(const side of [-1,1])add(side*10.6,2.05,-22,7.4,2.05,.3);
 for(const dz of [-22,-18]){doors.push({id:dz===-22?'pyrax-airlock-outer':'pyrax-airlock-inner',airlock:'thermal-entry',x,y:y+1.65,z:z+dz,sx:2.8,sy:1.65,sz:.2,role:'door'});add(0,3.8,dz,3.2,.55,.3);}
 for(const px of [-16,0,16])for(let dz=-20;dz<=20;dz+=8){const b=footprint(x+px,z+dz,.6,seed).min-.25;add(px,(b+y)/2-y,dz,.6,(y-b)/2,.6,'pipe','foundation');add(px,-.55,dz,1.2,.25,1.2,'equipment','foundation');}
 for(const dz of [-19,-11,-3,5,13,21])add(0,-.65,dz,17.5,.3,.2,'pipe','foundation');
 const run=18,entry=ground(x,z-22-run,seed),rise=y-entry;parts.push({x,y:(y+entry)/2-.12,z:z-22-run/2,sx:2.7,sy:.12,sz:Math.hypot(run,rise)/2,rx:-Math.atan2(rise,run),finish:'metal',role:'foundation'});
 for(const side of [-1,1])for(const dz of [-26,-32,-38]){const top=entry+(dz+22+run)/run*rise-.2,bottom=footprint(x+side*2.2,z+dz,.3,seed).min-.2;if(top>bottom)add(side*2.2,(top+bottom)/2-y,dz,.25,(top-bottom)/2,.25,'pipe','foundation');}
 return {x,y,z,parts,doors,rooms};
}
