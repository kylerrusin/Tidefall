import { useEffect, useState } from "react";
import { visibilityReport } from "./instance-bounds";
import { weatherAt } from "./climate";
import { diagnostics } from "./presentation";
import { controls } from "./controls";
import { connection } from "./client";
export function Diagnostics() {
  const [visible, setVisible] = useState(false),
    [, refresh] = useState(0);
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const timer = setInterval(() => refresh((n) => n + 1), 500);
    const key = (e: KeyboardEvent) => {
      if (import.meta.env.DEV && e.code === "F4") {
        e.preventDefault(); controls.physicsDebug = !controls.physicsDebug; refresh(n => n + 1);
      }
      if(e.code === "F6"){e.preventDefault();controls.visibilityDebug=(controls.visibilityDebug+1)%3;setVisible(true);}
      if (e.code === "F3") {
        e.preventDefault();
        setVisible((v) => !v);
      }
    };
    window.addEventListener("keydown", key);
    return () => {
      clearInterval(timer);
      window.removeEventListener("keydown", key);
    };
  }, []);
  if (!import.meta.env.DEV || !visible) return null;
  const d = diagnostics, w=weatherAt(connection.state?.time??0,connection.state?.seed??42,connection.state?.extraction.timeline.duration);
  return (
    <aside className="diagnostics" data-testid="diagnostics">
      <b>DEVELOPMENT · F3 HIDE</b>
      <span>F4 physics wireframes · {controls.physicsDebug ? "ON" : "OFF"}</span>
      <span>
        {d.fps.toFixed(0)} FPS · frame {d.frameMs.toFixed(1)} ms · p95{" "}
        {d.p95.toFixed(1)} ms · max {d.maxMs.toFixed(1)} ms
      </span>
      <span>
        Physics {d.physicsMs.toFixed(2)} ms / 60 Hz · RTT {d.rtt.toFixed(0)} ms
      </span>
      <span>
        Grounded {String(d.grounded)} · pitch{" "}
        {((controls.pitch * 180) / Math.PI).toFixed(0)}° · corrections{" "}
        {d.corrections} / last {d.correctionMeters.toFixed(2)} m
      </span>
      <span>
        Colliders {d.colliders} · dynamic {d.objects} · calls {d.drawCalls} ·
        triangles {Math.round(d.triangles / 1000)}k
      </span>
      <span>
        Pending inputs {connection.prediction?.pending.length ?? 0} ·{" "}
        {connection.status}
      </span>
      <span>
        Mouse {controls.lockState} · yaw{" "}
        {Math.round((controls.yaw * 180) / Math.PI)}° · moon {d.moonScreen}
      </span>
      <span>Mouse events {d.mouseEvents} / applied {d.lookEvents} · delta {d.movementX}, {d.movementY} · discard {d.lookDiscard}</span>
      <span>Owner {d.cameraOwner} · rendered {Math.round(d.renderedYaw * 180 / Math.PI)}°, {Math.round(d.renderedPitch * 180 / Math.PI)}° · overwrites {d.cameraOverwrites}</span>
      <span>GPU sky {d.cloudGpuMs===null?'unavailable':d.cloudGpuMs.toFixed(2)+' ms'} · water {d.waterGpuMs===null?'unavailable':d.waterGpuMs.toFixed(2)+' ms'}</span><span>Textures {d.textureCount} · estimated mapped storage {d.textureEstimateMB.toFixed(2)} MB</span><span>F6 visibility: {controls.visibilityDebug} · {visibilityReport.text}</span>
      {connection.state && <span>Weather {w.phase} · wind {w.wind.toFixed(1)} m/s · sea {w.sea.toFixed(2)} m · day {w.solar.daylight.toFixed(2)}</span>}
      <span>Network encode {(connection.state?.networkMs??0).toFixed(2)} ms · snapshot {((connection.state?.networkBytes??0)/1024).toFixed(1)} KiB</span><span>AI {(connection.state?.aiMs??0).toFixed(2)} ms · projectiles {connection.state?.projectiles.length??0} · snapshot 10 Hz</span>
      {connection.state?.stalkers.map(s=><span key={s.id}>{s.kind} {s.id}: {s.state} / {Math.ceil(s.health)} HP · target {s.targetId?.slice(0,5)??"none"} · path {s.path.length} · attack {s.attackId} {s.attackKind} · cooldown {Math.max(0,s.nextRanged-(connection.state?.time??0)).toFixed(1)}s</span>)}
    </aside>
  );
}
