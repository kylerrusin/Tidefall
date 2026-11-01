import { useEffect, useRef } from "react";
import { connection } from "./client";
import { controls } from "./controls";
import { feedback } from "./feedback";
import { damageBearing } from "./combat";
import { soundscape } from "./audio";
export function CombatOverlay() {
  const veil=useRef<HTMLDivElement>(null), arrow=useRef<HTMLDivElement>(null), marker=useRef<HTMLDivElement>(null), critical=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    const receive=()=>{
      const s=connection.state; if(!s)return;
      for(const event of feedback.consume(s,connection.id,performance.now())) soundscape.tone(event.kind==="hit"?880:120,event.kind==="hit"?0.08:0.16,0.12,event.kind==="hit"?1100:55);
    };
    const off=connection.subscribe(receive); let frame=0;
    const animate=()=>{
      const now=performance.now(),p=connection.presentation, s=connection.state;
      const playing=!!p?.alive && s?.status==="running";
      const age=(now-feedback.damageAt)/1000;
      if(veil.current) { veil.current.style.opacity=playing&&age<0.65?String(Math.max(0,1-age/0.65)*Math.min(0.8,0.25+(feedback.incoming?.amount??0)/35)):"0"; veil.current.classList.toggle("environment",feedback.incoming?.kind==="environment"); }
      if(arrow.current) {
        arrow.current.style.opacity=playing && feedback.incoming?.source && age<1.2?String(1-age/1.2):"0";
        if(p&&feedback.incoming?.source) arrow.current.style.transform=`rotate(${damageBearing(feedback.incoming.source,p,controls.yaw)}rad)`;
      }
      if(marker.current){marker.current.style.opacity=playing && now-feedback.hitAt<180?"1":"0";marker.current.style.color=feedback.weak?"#ffbb6d":"#b9ffdf";}
      if(critical.current)critical.current.style.display=playing&&p.health<25?"block":"none";
      frame=requestAnimationFrame(animate);
    }; receive(); frame=requestAnimationFrame(animate);
    return()=>{off();cancelAnimationFrame(frame);};
  },[]);
  return <div className="combat-overlay" aria-hidden="true"><div ref={veil} className="damage-flash"/><div ref={arrow} className="damage-direction"><i/></div><div ref={marker} className="hit-marker">×</div><div ref={critical} className="critical-health">CRITICAL SUIT DAMAGE</div></div>;
}
