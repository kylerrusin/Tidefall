import {solidHeight} from './surface-query';
import { Snapshot, ground } from "./model";
import {surfaceGrid,gridSample} from "./hydraulic-surface";
import { waveContact } from "./waves";
/** The one shared grid sampling convention used by server water and local prediction. */
export function waterAt(
  state: Pick<Snapshot, "water" | "currents" | "currentsX" | "seed"> & {time?:number;extraction?:Snapshot['extraction']},
  x: number,
  z: number,
) {
  const i = Math.max(0, Math.min(64, Math.round((x + 160) / 5))),
    j = Math.max(0, Math.min(64, Math.round((z + 160) / 5))),
    k = j * 65 + i,
    level = gridSample(surfaceGrid(state.water),x,z);
  return waveContact({
    depth:
      Number.isFinite(level)
        ? Math.max(0, level - solidHeight(x,z,state.seed))
        : 0,
    level: level > -90 ? level : -100,
    u: state.currentsX[k] ?? 0,
    v: state.currents[k] ?? 0,
  },x,z,state.time??0,state.seed,state.extraction?.timeline.duration);
}
