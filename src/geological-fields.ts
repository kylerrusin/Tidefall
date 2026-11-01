import {geologicalIdentity,FACIES_PROPERTIES,GEOLOGY} from './geological-catalog';
import {bedrockForSurface,surfaceWeights} from './terrain-material';
const blend=(a:number,b:number,x:number)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
export const GEO_MATERIALS={
 basalt:{density:2900,friction:.85,strengthMPa:150,resistance:.95,conductivity:1.7,solubility:.02,permeability:1e-16,repose:55,color:[.32,.35,.39]},
 carbonate:{density:2600,friction:.7,strengthMPa:60,resistance:.65,conductivity:2.1,solubility:.7,permeability:1e-13,repose:48,color:[.65,.62,.55]},
 sediment:{density:1750,friction:.65,strengthMPa:.08,resistance:.15,conductivity:.8,solubility:.2,permeability:1e-10,repose:32,color:[.56,.53,.43]},
 regolith:{density:2100,friction:.75,strengthMPa:2,resistance:.4,conductivity:1.1,solubility:.1,permeability:1e-12,repose:35,color:[.48,.51,.47]}
} as const;
/** Continuous weathering/deposition appearance. Catalog identity and physical properties stay discrete. */
export function geologicalNoise(x:number,z:number,seed=42){const i=Math.floor(x),j=Math.floor(z),a=blend(0,1,x-i),b=blend(0,1,z-j),hash=(p:number,q:number)=>{let n=Math.imul(p^seed,374761393)^Math.imul(q,668265263);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967296;};return (hash(i,j)*(1-a)+hash(i+1,j)*a)*(1-b)+(hash(i,j+1)*(1-a)+hash(i+1,j+1)*a)*b;}
export function reconstructedAppearance(x:number,z:number,height:number,slope:number,seed:number,weights:{basalt:number;carbonate:number;sediment:number;regolith:number},unitId='TDF-SD-016',fracture=0){
 const unit=GEOLOGY[unitId],bedrock=bedrockForSurface(unit,weights,x,z),sediment=unit.strengthMPa<5?unit:GEOLOGY[seed<0?'TDF-SD-017':weights.carbonate>.45?'TDF-SD-015':weights.basalt>.45?'TDF-SD-012':'TDF-SD-014'];
 const channel=9+Math.sin((z+40)/65)*9,valley=Math.exp(-(((x-channel)/30)**2))*(1-blend(10,24,height)),coast=seed<0?0:1-blend(3,11,height),deposition=Math.max(seed<0&&unit.strengthMPa<1?.86:0,Math.min(1,weights.sediment*.82+weights.regolith*.25+valley*.15+coast*.14)),weathering=Math.min(1,.2+(1-unit.resistance)*.5+fracture*.1),competence=unit.strengthMPa<1?.3:unit.strengthMPa<5?.7:1;
 const inputs={deposition,weathering,competence},states=surfaceWeights({x:-slope,y:1,z:0},inputs),rock=states.exposed+states.weathered*.65,color=bedrock.color.map((v,k)=>v*(states.exposed+states.weathered*.8)+sediment.color[k]*(states.sediment+states.weathered*.2));
 return {color,rock,beds:bedrock.treatment==='beds'?1:0,cover:states.cover,bedrockId:bedrock.id,bedrockColor:bedrock.color,sedimentId:sediment.id,sedimentColor:sediment.color,inputs,states};
}
export const geologicalAppearance=reconstructedAppearance;
export function geologicalField(x:number,z:number,height:number,slope:number,seed:number){
 const basalt=seed<0?1:blend(48,85,x),carbonate=seed<0?0:(1-basalt)*(1-blend(-82,-48,x)),sediment=(1-basalt-carbonate)*(1-blend(7,19,height))*(1-blend(.35,.65,slope)),regolith=Math.max(0,1-basalt-carbonate-sediment);
 const weights={basalt,carbonate,sediment,regolith},names=Object.keys(weights) as (keyof typeof weights)[],material=names.reduce((a,b)=>weights[b]>weights[a]?b:a);
 const fracture=Math.exp(-(((x-68)/17)**2+((z-2)/17)**2))+Math.exp(-(((x+88+z*.12)/11)**2))+(seed<0?Math.exp(-(((x-24-Math.sin(z/55)*14)/18)**2)):0);
 const identity=geologicalIdentity(x,z,height,slope,seed,weights,fracture),u=identity.unit,f=FACIES_PROPERTIES[identity.facies];
 const appearance=geologicalAppearance(x,z,height,slope,seed,weights,u.id,fracture);
 return {material,weights,...identity,appearance,color:appearance.color,density:u.density*f.density,friction:u.friction*f.friction,porosity:Math.min(.65,u.porosity+(1-f.density)*.3),permeability:u.permeability*(1+fracture*20),solubility:u.solubility,resistance:u.resistance*f.resistance,fracture,sediment};
}
