import type { Stalker } from "./model";
export function creaturePose(s: Pick<Stalker,"state"|"stateSince"|"until"|"attackKind"|"health"|"diedAt">, time: number, speed: number) {
  const t=Math.max(0,time-s.stateSince), windup=s.state==="windup";
  const charge=windup?Math.max(0,Math.min(1,t/Math.max(0.01,s.until-s.stateSince))):s.state==="attack"?1:0;
  return {
    gait:Math.min(1,speed/3), breathing:Math.sin(time*2.8)*0.025,
    charge, ranged:windup&&s.attackKind==="ranged",
    lunge:s.state==="attack"&&s.attackKind==="melee"?Math.sin(Math.min(1,t/0.18)*Math.PI)*0.18:0,
    flinch:s.state==="stagger"?Math.sin(t*35)*Math.exp(-t*6)*0.12:0,
    death:s.state==="dead"?Math.min(1,Math.max(0,time-(s.diedAt??time))/0.65):0,
    alert:["alert","suspicious","chase","position"].includes(s.state),
  };
}
