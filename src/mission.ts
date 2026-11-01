export type MatchMode='survival'|'preview';
export const MATCH_DURATION=1800;
export function mission(mode:MatchMode='survival'){return mode==='preview'?{mode,duration:240,announce:160,approach:180,land:190,close:220,launch:225,stable:230,orbit:235,end:240,warning:75}:{mode,duration:1800,announce:1500,approach:1680,land:1800,close:1980,launch:1988,stable:1998,orbit:2025,end:2040,warning:795};}
export type MissionTimeline=ReturnType<typeof mission>;
export const weatherClock=(time:number,duration=MATCH_DURATION)=>time*540/duration;
export function encounterPhase(time:number,duration=MATCH_DURATION){const f=time/duration;return f<1/6?0:f<.4?1:f<2/3?2:3;}
