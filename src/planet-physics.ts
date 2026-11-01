export type EvidenceCategory='OBSERVED'|'DERIVED'|'MODELED'|'SPECULATIVE';
export type ScientificValue<T=number>={value:T;unit:string;range?:[number,number];uncertainty?:[number,number]|null;source:string;category:EvidenceCategory;assumptions:string[];dependencies:string[]};
export const physicalValue=<T>(value:T,unit:string,category:EvidenceCategory,dependencies:string[],assumptions:string[]=[],source='Tidefall scenario v8'):ScientificValue<T>=>({value,unit,category,dependencies,assumptions,source,uncertainty:null});
export const G=6.6743e-11,R_GAS=8.314462618,SIGMA=5.670374419e-8;
export function mixtureMolarMass(gases:Record<string,number>){const mass:Record<string,number>={N2:.0280134,O2:.031998,CO2:.0440095,CO:.02801,H2O:.01801528,H2:.00201588,He:.0040026,CH4:.01604,SO2:.064066,H2S:.03408};let sum=0,molar=0;for(const [name,fraction] of Object.entries(gases)){if(!(name in mass)||fraction<0||!Number.isFinite(fraction))throw new Error('Invalid gas mixture');sum+=fraction;molar+=fraction*mass[name];}if(Math.abs(sum-1)>1e-6)throw new Error('Mole fractions must sum to one');return molar;}
function positive(...v:number[]){if(v.some(x=>!Number.isFinite(x)||x<=0))throw new Error('Physical inputs must be finite and positive');}
export function surfaceGravity(mass:number,radius:number){positive(mass,radius);return G*mass/radius**2;}
export function escapeVelocity(mass:number,radius:number){positive(mass,radius);return Math.sqrt(2*G*mass/radius);}
export function equilibriumTemperature(luminosityW:number,orbitM:number,albedo:number){positive(luminosityW,orbitM);if(albedo<0||albedo>=1)throw new Error('Invalid albedo');return ((1-albedo)*luminosityW/(16*Math.PI*SIGMA*orbitM**2))**.25;}
export function gasDensity(pressurePa:number,temperatureK:number,molarMass:number){positive(pressurePa,temperatureK,molarMass);return pressurePa*molarMass/(R_GAS*temperatureK);}
export function scaleHeight(temperatureK:number,molarMass:number,gravity:number){positive(temperatureK,molarMass,gravity);return R_GAS*temperatureK/(molarMass*gravity);}
/** Tetens vapor pressure; limited to the scenario's temperate-water regime. */
export const saturationPressure=(c:number)=>610.78*Math.exp(17.27*Math.max(-50,Math.min(60,c))/(Math.max(-50,Math.min(60,c))+237.3));
export function brineProperties(c:number,salinity:number,pressure:number){const s=Math.max(0,Math.min(.12,salinity)),freeze=-54*s;return {density:1000+750*s-.2*(c-4),viscosity:.001*Math.exp(-.025*(c-20))*(1+2*s),freezingC:freeze,liquid:c>freeze&&c<100&&pressure>Math.max(611,saturationPressure(c)),salinity:s};}
export function stellarSpectrum(k:number){positive(k);const planck=(nm:number)=>1/(nm**5*Math.expm1(1.4387769e7/(nm*k)));const values=[650,550,450].map(nm=>planck(nm)/ (1/(nm**5*Math.expm1(1.4387769e7/(nm*6500)))));const max=Math.max(...values);return values.map(v=>v/max) as [number,number,number];}
