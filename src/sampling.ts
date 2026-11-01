import {GEOLOGY} from './geological-catalog';
import {SAMPLE_RULES,type Excavation} from './domain/sampling';
import type {Player,V3} from './model';
/** Pure resource transaction, called only after the normal authoritative rifle ray succeeds. */
export function extractGeology(p:Player,patches:Map<string,Excavation>,unitId:string,position:V3,normal:V3,time:number,origin:string){
 const unit=GEOLOGY[unitId];if(!unit)return null;
 const stack=p.samples.find(s=>s.unitId===unitId);
 if((!stack&&p.samples.length>=SAMPLE_RULES.slots)||(stack?.quantity??0)>=SAMPLE_RULES.stack){p.sampleNotice='Samples full. Open E and discard a sample to make room.';return null;}
 const key=unitId+':'+[position.x,position.y,position.z].map(n=>Math.floor(n/1.5)).join(':'),old=patches.get(key);
 if(old&&old.remaining<=0){p.sampleNotice='This fracture patch is depleted. Find another exposed surface.';return null;}
 if(!old&&patches.size>=SAMPLE_RULES.maxPatches){p.sampleNotice='Survey patch capacity reached. Existing fractures remain available.';return null;}
 const required=unit.strengthMPa<1?1:unit.strengthMPa>120?3:2,cost=unit.strengthMPa<1?4:unit.strengthMPa>120?9:6;
 if(p.weaponEnergy<cost){p.sampleNotice='Insufficient rifle energy for this material.';return null;}
 const patch=old??{id:key,unitId,position:{...position},normal:{...normal},remaining:SAMPLE_RULES.patchSamples,progress:0,required,updatedAt:time};
 p.weaponEnergy-=cost;patch.progress++;patch.updatedAt=time;patches.set(key,patch);
 if(patch.progress>=required){patch.progress=0;patch.remaining--;const mass=unit.strengthMPa<1?.12:.18;if(stack){stack.quantity++;stack.massKg=Math.round((stack.massKg+mass)*100)/100;if(!stack.origins.includes(origin))stack.origins.push(origin);}else p.samples.push({unitId,quantity:1,massKg:mass,origins:[origin],collectedAt:time});p.sampleNotice=unit.name+' collected · '+mass.toFixed(2)+' kg · '+patch.remaining+' samples remain in this patch.';}
 else p.sampleNotice=unit.name+' · fracture pulse '+patch.progress+'/'+required;
 return patch;
}
