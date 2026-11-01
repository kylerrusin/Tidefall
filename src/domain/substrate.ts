import type {MeshData} from '../geometry';
export const ROCK_FAMILIES=['rounded','stratified','fractured','tower','shelf','volcanic'] as const;
export type RockFamily=typeof ROCK_FAMILIES[number];
export type SubstrateSite={id:number;x:number;z:number;family:RockFamily;variant:number;strike:number;sx:number;sy:number;sz:number;exposure:number;weathering:number;unitId:string;chunkX:number;chunkZ:number;fragment:boolean};
export type SubstrateField={seed:number;sites:SubstrateSite[];bins:Map<string,SubstrateSite[]>};
export type SubstrateMesh=MeshData&{units:string[];contacts:Float32Array;faceRanges:{end:number;id:string}[]};
