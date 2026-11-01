import type {Snapshot} from '../model';

export const SNAPSHOT_CODEC='grid-rle-v1';
type Grid=number[]|{runs:number[];length:number};
export type WireSnapshot=Omit<Snapshot,'water'|'currents'|'currentsX'|'fields'>&{
  codec:typeof SNAPSHOT_CODEC;water:Grid;currents:Grid;currentsX:Grid;fields?:Snapshot['fields'];
};

/** Lossless runs are used only when smaller than the original numeric grid. */
export function packGrid(values:number[]):Grid{
  const runs:number[]=[];
  for(let i=0;i<values.length;){const value=values[i];let end=i+1;while(end<values.length&&values[end]===value)end++;runs.push(end-i,value);i=end;}
  return runs.length+8<values.length?{runs,length:values.length}:values;
}
export function unpackGrid(grid:Grid):number[]{
  if(Array.isArray(grid))return grid;
  if(!Number.isSafeInteger(grid.length)||grid.length<0||grid.length>10000||grid.runs.length%2)throw Error('Invalid snapshot grid');
  const result:number[]=[];
  for(let i=0;i<grid.runs.length;i+=2){const count=grid.runs[i],value=grid.runs[i+1];if(!Number.isSafeInteger(count)||count<=0||!Number.isFinite(value)||result.length+count>grid.length)throw Error('Invalid snapshot run');for(let n=0;n<count;n++)result.push(value);}
  if(result.length!==grid.length)throw Error('Incomplete snapshot grid');return result;
}
export function packSnapshot(snapshot:Snapshot,includeFields=true):WireSnapshot{
  const {water,currents,currentsX,fields,...state}=snapshot;
  return {...state,codec:SNAPSHOT_CODEC,water:packGrid(water),currents:packGrid(currents),currentsX:packGrid(currentsX),...(includeFields?{fields}:{})};
}
/** Rebuild the existing authoritative Snapshot contract before any simulation/UI reads it. */
export function unpackSnapshot(state:Snapshot|WireSnapshot,previous:Snapshot|null):Snapshot{
  if(!('codec'in state)||state.codec!==SNAPSHOT_CODEC)return state as Snapshot;
  const {codec,fields,water,currents,currentsX,...rest}=state;
  const shared=fields??(previous?.code===state.code&&previous.seed===state.seed&&previous.fieldsVersion===state.fieldsVersion?previous.fields:undefined);
  if(!shared)throw Error('Missing environment snapshot baseline');
  return {...rest,fields:shared,water:unpackGrid(water),currents:unpackGrid(currents),currentsX:unpackGrid(currentsX)};
}
