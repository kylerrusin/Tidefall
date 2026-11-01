/** Internal simulation catalog. Ranges describe plausible assemblages, never measured exoplanet samples. */
export type GeoFamily='igneous'|'sediment'|'mineral'|'alteration';
export type GeoUnit={id:string;name:string;family:GeoFamily;origin:string;minerals:string;texture:string;history:string;density:number;friction:number;porosity:number;strengthMPa:number;permeability:number;solubility:number;conductivity:number;resistance:number;repose:number;color:readonly number[];treatment:'joints'|'columns'|'beds'|'clasts'|'crust'|'grains'};
type Entry=[string,string,GeoFamily,string,string,string,number,number,number,string,GeoUnit['treatment']];
// Density kg m⁻³, porosity fraction, unconfined compressive strength MPa. Modeled representatives.
const entries:Entry[]=[
 ['LT-031','Olivine-bearing vesicular basalt','igneous','Extrusive igneous','Plagioclase 30–55%, pyroxene 20–40%, olivine 5–20%, glass and oxides','Fine-grained and vesicular',2650,.18,90,'#485259','joints'],
 ['LT-032','Basaltic breccia','igneous','Fragmented lava flow','Basalt clasts, glass and iron oxides','Angular clasts in a fine matrix',2500,.22,55,'#5e5b53','clasts'],
 ['LT-033','Columnar basalt','igneous','Cooling lava flow','Plagioclase 35–55%, pyroxene 25–45%, accessory olivine','Cooling joints with polygonal columns',2900,.05,170,'#343e49','columns'],
 ['LT-034','Massive tholeiitic basalt','igneous','Extrusive igneous','Plagioclase 40–60%, pyroxene 25–45%, oxides and glass','Dense interlocking fine crystals',2950,.03,190,'#3d4145','joints'],
 ['LT-035','Glassy basaltic flow margin','igneous','Rapidly quenched lava','Basaltic glass 50–85%, microlites and iron oxides','Glassy fractured rind',2700,.08,110,'#293b40','joints'],
 ['LT-036','Pumiceous volcanic tuff','igneous','Explosive volcanism','Volcanic glass 40–70%, feldspar and lithic fragments','Porous welded ash',1350,.48,12,'#9c9785','clasts'],
 ['LT-037','Lapilli tuff','igneous','Pyroclastic deposition','Glass and basaltic lapilli with feldspar','Layered coarse volcanic fragments',2050,.28,30,'#817162','beds'],
 ['LT-038','Doleritic intrusion','igneous','Shallow intrusive igneous','Plagioclase 45–65%, pyroxene 30–45%, iron oxides','Medium-grained interlocking crystals',3000,.02,200,'#555b57','joints'],
 ['LT-039','Olivine-rich cumulate','igneous','Mafic crystal accumulation','Olivine 45–75%, pyroxene and plagioclase','Coarse granular cumulate',3250,.03,180,'#626d4b','joints'],
 ['LT-040','Andesitic flow','igneous','Evolved volcanic melt','Plagioclase 40–65%, pyroxene 10–30%, glass','Porphyritic lava',2700,.07,130,'#85807a','joints'],
 ['LT-041','Gabbroic basement','igneous','Intrusive igneous','Plagioclase 40–60%, pyroxene 30–50%, olivine','Coarse crystalline basement',3050,.02,210,'#646965','joints'],
 ['LT-042','Impact melt breccia','igneous','Impact excavation and heating','Mixed silicate clasts in impact melt','Angular fragments and melt lenses',2750,.13,70,'#6c5c52','clasts'],
 ['LT-043','Bedded carbonate mudstone','sediment','Carbonate deposition','Calcite and aragonite 60–90%, clay and volcanic silt','Thin beds of carbonate mud',2500,.12,55,'#b4ac91','beds'],
 ['LT-044','Carbonate grainstone','sediment','Shallow marine accumulation','Carbonate grains 70–95%, silicate sand','Porous cemented grains',2450,.2,45,'#c6b991','beds'],
 ['LT-045','Siliceous chert lenses','sediment','Silica precipitation and burial','Microcrystalline silica 80–98%, iron oxides','Dense conchoidally fractured lenses',2600,.02,160,'#918c84','joints'],
 ['LT-046','Volcaniclastic sandstone','sediment','Coastal sediment cementation','Volcanic lithics 40–70%, feldspar and silica cement','Cross-bedded sand-sized grains',2300,.23,35,'#a08c6c','beds'],
 ['SD-011','Gravelly alluvial fan','sediment','Short-distance mass transport','Angular basalt and carbonate gravel with sand','Poorly sorted fan deposit',1900,.3,.1,'#8b8372','clasts'],
 ['SD-012','Basaltic beach sand','sediment','Wave sorting','Basalt grains 45–75%, feldspar and magnetite','Sorted dark sand',1800,.35,.03,'#777b70','grains'],
 ['SD-013','Tidal silt','sediment','Slack-water settling','Clay minerals, feldspar silt and organic traces','Fine laminated mud',1650,.45,.02,'#8d8873','grains'],
 ['SD-014','Coastal volcaniclastic sediment','sediment','Mixed wave and volcanic deposition','Basalt lithics 35–65%, glass, feldspar and carbonate','Poorly sorted coarse sand',1850,.33,.05,'#a69b7d','grains'],
 ['SD-015','Carbonate scree','sediment','Cliff weathering and gravity transport','Carbonate clasts 65–90%, silicate grit','Angular open-work talus',1900,.35,.08,'#aca58f','clasts'],
 ['SD-016','Weathered basaltic regolith','sediment','In-place chemical weathering','Basalt fragments, clay, iron oxyhydroxides','Soil aggregates and residual clasts',2050,.3,2,'#7f8171','grains'],
 ['SD-017','Dry impact regolith','sediment','Impact comminution','Silicate fragments, glass and iron oxides','Angular dust and granules',1950,.38,.5,'#827366','grains'],
 ['SD-018','Volcanic ash mantle','sediment','Ash fallout','Glass shards 50–80%, feldspar and oxides','Fine porous volcanic dust',1200,.55,.02,'#9d8d7e','grains'],
 ['MN-021','Carbonate mineral crust','mineral','Aqueous precipitation','Calcite and aragonite 75–98%, minor silica','Laminated mineral crust',2400,.15,35,'#c9c4a6','crust'],
 ['MN-022','Iron oxide precipitate','mineral','Oxidation of iron-bearing fluid','Ferrihydrite, goethite and hematite','Porous ochre crust',2600,.32,8,'#b67442','crust'],
 ['MN-027','Silica-rich hydrothermal precipitate','mineral','Hydrothermal cooling','Opaline silica 60–95%, sulfides and iron oxides','Botryoidal silica and veins',2200,.2,45,'#d1c8ac','crust'],
 ['MN-028','Sulfide-bearing vent crust','mineral','Hydrothermal precipitation','Pyrite and other iron sulfides with silica','Metallic fine-grained precipitate',3600,.15,50,'#b3a35f','crust'],
 ['AL-006','Iron-rich alteration rind','alteration','Oxidative weathering','Iron oxyhydroxides, clay and residual basalt','Pitted oxidation rind',2350,.23,18,'#a27353','crust'],
 ['AL-007','Hydrothermally altered basalt','alteration','Fluid-driven basalt alteration','Chlorite, clay, silica and residual plagioclase','Veined weakened basalt',2550,.2,40,'#819580','joints'],
 ['AL-008','Thermally fractured basalt','alteration','Repeated thermal stress','Basaltic silicates and iron oxides','Open joint network and spalled chips',2750,.12,65,'#755c4e','joints'],
 ['AL-009','Silica-veined fault breccia','alteration','Fault slip and fluid circulation','Angular basalt fragments with silica cement','Aligned fractures and mineral veins',2650,.1,75,'#909e99','clasts'],
];
export const GEOLOGY:Readonly<Record<string,GeoUnit>>=Object.fromEntries(entries.map(([suffix,name,family,origin,minerals,texture,density,porosity,strengthMPa,hex,treatment])=>{const id='TDF-'+suffix,loose=strengthMPa<1;return [id,{id,name,family,origin,minerals,texture,density,porosity,strengthMPa,friction:loose?.64:.82,permeability:loose?1e-10:porosity>.2?1e-13:1e-16,solubility:minerals.includes('Carbonate')||minerals.includes('Calcite')?.7:.03,conductivity:loose?.8:1.9,resistance:Math.min(.98,.15+strengthMPa/220),repose:loose?32:52,color:[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255),treatment,history:origin+' within the hypothetical local geological reconstruction.'}];}));
export const FACIES=['fresh','jointed','weathered','oxidized','wet','sediment veneer','mineral veined'] as const;
export const SURFACE_TREATMENTS={joints:0,columns:1,beds:2,clasts:3,crust:4,grains:5} as const;
export type Facies=typeof FACIES[number];
export const FACIES_PROPERTIES:Record<Facies,{density:number;friction:number;resistance:number;tint:readonly number[];cover:number}>={
 fresh:{density:1,friction:1,resistance:1,tint:[0,0,0],cover:0},jointed:{density:.97,friction:.95,resistance:.8,tint:[-.025,-.025,-.025],cover:0},weathered:{density:.92,friction:.95,resistance:.65,tint:[.05,.035,.015],cover:0},oxidized:{density:.98,friction:1,resistance:.85,tint:[.065,.005,-.04],cover:0},wet:{density:1.02,friction:.78,resistance:1,tint:[-.06,-.045,-.025],cover:0},'sediment veneer':{density:.85,friction:.8,resistance:.5,tint:[.035,.025,0],cover:.3},'mineral veined':{density:1.03,friction:.96,resistance:.8,tint:[.045,.06,.04],cover:0}
};
export function geologicalIdentity(x:number,z:number,height:number,slope:number,seed:number,weights:{basalt:number;carbonate:number;sediment:number;regolith:number},fracture:number){
 const strike=.12,along=x+z*strike,bed=Math.floor((height+x*.055+Math.sin(z*.03)*.5)/2.6),cycle=(n:number,m:number)=>(n%m+m)%m;
 let suffix:string;
 const vent=Math.hypot(x-68,z-2),patch=Math.sin(x*.09+z*.035)+Math.cos(z*.12-x*.025);
 if(vent<7)suffix=seed<0?'AL-008':cycle(Math.floor(x+z),3)===0?'MN-028':'MN-027';
 else if(vent<18)suffix=seed<0?'LT-035':patch>.2?'AL-007':'MN-022';
 else if(fracture> .7&&along< -70)suffix='AL-009';
 else if(seed<0){const units=['LT-031','LT-032','LT-033','LT-034','LT-035','LT-037','LT-038','LT-039','LT-040','LT-041','LT-042'];suffix=slope<.12&&patch>1?'SD-018':slope<.2&&patch<-.4?'SD-017':Math.abs(x-24-Math.sin(z/55)*14)<9?'AL-008':units[cycle(bed+Math.floor(z/34),units.length)];}
 else if(weights.carbonate>.45)suffix=slope>.7?'LT-045':['LT-043','LT-044','LT-045','SD-015'][cycle(bed,4)];
 else if(weights.basalt>.45)suffix=['LT-031','LT-032','LT-033','LT-034','LT-036','LT-037','LT-038','LT-041'][cycle(bed+Math.floor(z/50),8)];
 else if(weights.sediment>.35)suffix=height<1?'SD-013':height<5?'SD-012':patch>.7?'SD-011':patch<-.7?'LT-046':'SD-014';
 else suffix=height>24&&patch>.8?'SD-011':patch<-.8?'AL-006':Math.abs(x+50)<8&&height<15?'MN-021':'SD-016';
 const unit=GEOLOGY['TDF-'+suffix],wet=height<7&&seed>=0,facies:Facies=wet?'wet':unit.family==='alteration'?'mineral veined':slope<.15?'sediment veneer':fracture>.4?'jointed':patch>.8?'oxidized':patch<-.4?'weathered':'fresh';
 return {unitId:unit.id,unit,facies,strike,bed,alteration:unit.family==='alteration'?.8:facies==='weathered'?.45:.1};
}
