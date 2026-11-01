import type {V3} from '../model';
export type RifleMode='combat'|'sampling';
export type GeologicalSample={unitId:string;quantity:number;massKg:number;origins:string[];collectedAt:number};
export type Excavation={id:string;unitId:string;position:V3;normal:V3;remaining:number;progress:number;required:number;updatedAt:number};
export const SAMPLE_RULES={slots:20,stack:99,range:10,cadence:.55,patchSamples:3,maxPatches:512,visiblePatches:64} as const;
