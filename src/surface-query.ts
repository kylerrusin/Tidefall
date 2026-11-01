import {GEOLOGY} from './geological-catalog';
import {surfaceAt,ground} from './model';
import {formationSurface} from './formations';
export const solidHeight=(x:number,z:number,seed:number)=>Math.max(ground(x,z,seed),formationSurface(x,z,seed)?.height??-Infinity);
/** Unified exposed solid support query; water remains a separate numerical free surface. */
export function solidSurface(x:number,z:number,seed:number){const base=surfaceAt(x,z,seed),rock=formationSurface(x,z,seed);if(!rock||rock.height<=base.height)return base;const unit=GEOLOGY[rock.unitId];return {...base,height:rock.height,unitId:rock.unitId,unit,density:unit.density,friction:unit.friction,slope:rock.slope,normal:rock.normal};}
