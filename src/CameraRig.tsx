import {terrainQA} from "./terrain-qa";
import {skySelection} from "./astronomy-catalog";
import {shipAt,shipOffset,shipRotation,passengerSeat} from './extraction';
import { soundscape } from "./audio";
import { FieldEffects } from "./FieldEffects";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { connection } from "./client";
import { controls, updateUI } from "./controls";
import { clampPitch, FixedClock, movementAxes } from "./locomotion";
import { PointerSession, relativeLook } from "./pointer";
import { diagnostics, recordFrame } from "./presentation";
import { ground } from "./model";
import { EYE_HEIGHT } from "./survival";
import { waterAt } from "./water-contact";
import { feedback } from "./feedback";

export function CameraRig() {
  const { camera, gl, scene } = useThree(),
    keys = useRef(new Set<string>()),
    fixed = useRef(new FixedClock()),
    seq = useRef(0),
    lastAim = useRef(0);
  const memory = useRef({
    ray: new THREE.Raycaster(),
    center: new THREE.Vector2(),
    forward: new THREE.Vector3(),
    target: new THREE.Vector3(),
    expected: new THREE.Quaternion(),
    owned: false,
  });
  useEffect(() => {
    const before = scene.onBeforeRender;
    scene.onBeforeRender = function (...args) {
      before.apply(this, args);
      const m = memory.current;
      if (m.owned && connection.state && camera.quaternion.angleTo(m.expected) > 0.001) diagnostics.cameraOverwrites++;
    };
    return () => { scene.onBeforeRender = before; };
  }, [scene, camera]);
  useEffect(() => {
    const clear = () => {
      keys.current.clear();
      controls.x = controls.z = 0;
      controls.jump = controls.dive = controls.sprint = false;
      fixed.current.accumulator = 0;
    };
    const session = new PointerSession(
      {
        request: () => {
          if (!gl.domElement.requestPointerLock)
            throw new Error("Pointer Lock unavailable");
          return gl.domElement.requestPointerLock();
        },
        release: () => document.exitPointerLock?.(),
      },
      (state, message) => {
        controls.lockState = state;
        controls.locked = state === "locked";
        controls.lockMessage = message;
        controls.lockChangedAt = performance.now();
        updateUI();
      },
      clear,
    );
    gl.domElement.tabIndex = 0;
    gl.domElement.setAttribute("aria-label", "First-person game viewport");
    const capture = () => {
      controls.menu = false;
      controls.inventory = false;
      controls.tutorial = false;
      gl.domElement.focus();
      session.request();
      updateUI();
    };
    const release = () => session.release();
    controls.capture = capture;
    controls.release = release;
    const useItem = () => {
      if (
        !controls.enabled ||
        !connection.state?.players.find((p) => p.id === connection.id)?.alive
      )
        return;
      if (controls.slot === 1) {
        const sampling=connection.state?.players.find(p=>p.id===connection.id)?.rifleMode==="sampling";
        if (performance.now() < controls.flashUntil + (sampling?510:220)) return;
        controls.flashUntil = performance.now() + (sampling?35:90);
        connection.send("fire", { position: { yaw: controls.yaw, pitch: controls.pitch } });
        soundscape.tone(sampling?180:440, 0.11, sampling?.06:.11, 110);
        updateUI();
        window.setTimeout(updateUI, 100);
      }
      if (controls.slot === 2) connection.send(connection.state!.seed<0?"coolant":"oxygen");
      if (controls.slot === 3 && controls.aim.valid)
        connection.anchor({ ...controls.aim, sign: controls.polarity });
    };
    controls.useItem = useItem;
    const move = (e: MouseEvent) => {
      diagnostics.mouseEvents++;
      diagnostics.movementX = e.movementX;
      diagnostics.movementY = e.movementY;
      diagnostics.lookDiscard = document.pointerLockElement !== gl.domElement ? "canvas not locked" : controls.menu ? "menu" : controls.inventory ? "inventory" : controls.tutorial ? "tutorial" : "none";
      if (
        document.pointerLockElement !== gl.domElement ||
        controls.menu ||
        controls.inventory || controls.tutorial
      )
        return;
      Object.assign(
        controls,
        relativeLook(
          controls.yaw,
          controls.pitch,
          e.movementX,
          e.movementY,
          controls.sensitivity,
          controls.invertY,
        ),
      );
      diagnostics.lookEvents++;
    };
    const lockChanged = () => {
      const locked = document.pointerLockElement === gl.domElement,
        wasLocked = controls.locked;
      session.change(locked);
      if (
        wasLocked &&
        !locked &&
        !controls.inventory &&
        !controls.tutorial &&
        connection.state?.status === "running"
      ) {
        controls.menu = true;
        connection.send("pause");
        updateUI();
      }
    };
    const fail = () => session.fail();
    const blur = () => {
      clear();
      connection.send("pause");
      if (connection.state?.status === "running") {
        controls.menu = true;
        session.release();
        updateUI();
      }
    };
    const hidden = () => {
      if (document.hidden) blur();
    };
    const down = (e: KeyboardEvent) => {
      if (
        (e.target as HTMLElement).matches("input,select,textarea") ||
        !connection.state
      )
        return;
      if (e.code === "Tab" || e.code === "KeyE") {
        e.preventDefault();
        if (e.repeat) return;
        controls.inventory = !controls.inventory;
        clear();
        if (controls.inventory) {
          session.release();
          connection.send("pause");
        }
        updateUI();
        return;
      }
      if (e.code === "Escape") {
        e.preventDefault();
        clear();
        controls.inventory = false;
        controls.menu = true;
        session.release();
        connection.send("pause");
        updateUI();
        return;
      }
      if (
        !controls.enabled ||
        controls.menu ||
        controls.inventory ||
        controls.tutorial
      )
        return;
      keys.current.add(e.code);
      if (
        [
          "Space",
          "KeyX",
          "KeyV",
          "KeyQ",
          "KeyR",
          "Digit1",
          "Digit2",
          "Digit3",
        ].includes(e.code)
      )
        e.preventDefault();
      if (e.repeat) return;
      if (e.code === "KeyX") connection.send("interact");
      if(e.code === "KeyV"){connection.send("rifle-mode");updateUI();}
      if(e.code==='KeyG')connection.send('carry');
      if(e.code==="KeyH")connection.send("medical");
      if(e.code==="KeyO")connection.send("oxygen");
      if(e.code==="KeyB")connection.send("cell");
      if(e.code==="KeyT")connection.send("thermal");
      if (e.code === "KeyF") useItem();

      if(e.code==="KeyN"){skySelection.scanner=!skySelection.scanner;updateUI();}
      if (e.code === "KeyR") connection.send("recall");
      if (e.code === "KeyQ" && controls.slot === 3) {
        controls.polarity *= -1;
        connection.send("polarity");
      }
      if (["Digit1", "Digit2", "Digit3"].includes(e.code)) {
        controls.slot = Number(e.code.slice(-1)) as 1 | 2 | 3;
        connection.send("equip",{position:{slot:controls.slot}});
        updateUI();
      }
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.code);
    const press = (e: MouseEvent) => {
      if (
        e.button !== 0 ||
        connection.state?.status !== "running" ||
        controls.menu ||
        controls.inventory ||
        controls.tutorial
      )
        return;
      if (document.pointerLockElement !== gl.domElement) {
        capture();
        return;
      }
      useItem();
    };
    const wheel = (e: WheelEvent) => {
      if (!controls.locked) return;
      e.preventDefault();
      controls.slot = (((controls.slot - 1 + (e.deltaY > 0 ? 1 : 2)) % 3) +
        1) as 1 | 2 | 3;
      connection.send("equip",{position:{slot:controls.slot}});
      updateUI();
    };
    const context = (e: Event) => e.preventDefault();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    document.addEventListener("mousemove", move, true);
    window.addEventListener("blur", blur);
    document.addEventListener("visibilitychange", hidden);
    document.addEventListener("pointerlockchange", lockChanged);
    document.addEventListener("pointerlockerror", fail);
    gl.domElement.addEventListener("mousedown", press);
    gl.domElement.addEventListener("wheel", wheel, { passive: false });
    gl.domElement.addEventListener("contextmenu", context);
    return () => {
      controls.capture = controls.release = null;
      controls.useItem = null;
      session.release();
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      document.removeEventListener("mousemove", move, true);
      window.removeEventListener("blur", blur);
      document.removeEventListener("visibilitychange", hidden);
      document.removeEventListener("pointerlockchange", lockChanged);
      document.removeEventListener("pointerlockerror", fail);
      gl.domElement.removeEventListener("mousedown", press);
      gl.domElement.removeEventListener("wheel", wheel);
      gl.domElement.removeEventListener("contextmenu", context);
    };
  }, [gl]);
  useFrame(({clock}, elapsed) => {
    const dt = Math.min(0.1, elapsed),
      now = performance.now(),
      state = connection.state,
      p = state?.players.find((p) => p.id === connection.id),
      prediction = connection.prediction,
      k = keys.current;
    connection.frameTime=connection.worldTime(now);
    if(import.meta.env.DEV&&terrainQA.active&&terrainQA.view&&state?.status==='running'){const pose=terrainQA.view;terrainQA.appliedView=pose.id;const drift=terrainQA.slowCamera?Math.sin(clock.elapsedTime*.35)*.3:0;camera.position.set(pose.position[0]+drift,pose.position[1],pose.position[2]);camera.lookAt(pose.target[0],pose.target[1],pose.target[2]);const c=camera as THREE.PerspectiveCamera;if(c.fov!==pose.fov){c.fov=pose.fov;c.updateProjectionMatrix();}camera.updateMatrixWorld();memory.current.owned=false;recordFrame(elapsed);diagnostics.drawCalls=gl.info.render.calls;diagnostics.triangles=gl.info.render.triangles;controls.underwater=false;return;}
    if(controls.enabled&&!controls.menu&&!controls.inventory&&!controls.tutorial){controls.yaw+=dt*1.1*((k.has("ArrowLeft")?1:0)-(k.has("ArrowRight")?1:0));controls.pitch=clampPitch(controls.pitch+dt*.9*((k.has("ArrowDown")?1:0)-(k.has("ArrowUp")?1:0)));}
    recordFrame(elapsed);
    diagnostics.drawCalls = gl.info.render.calls;
    diagnostics.triangles = gl.info.render.triangles;
    const alpha = fixed.current.advance(elapsed, () => {
      if (
        !state ||
        !p ||
        !prediction ||
        state.status !== "running" ||
        (!p.alive&&!p.cabin) ||
        !connection.connected
      )
        return;
      const enabled =
        controls.enabled &&
        !controls.menu &&
        !controls.inventory &&
        !controls.tutorial;
      seq.current = Math.max(seq.current, p.ack + 1);
      const input = {
        ...movementAxes(
          enabled
            ? (k.has("KeyD") ? 1 : 0) - (k.has("KeyA") ? 1 : 0) + controls.x
            : 0,
          enabled
            ? (k.has("KeyW") ? 1 : 0) - (k.has("KeyS") ? 1 : 0) + controls.z
            : 0,
          controls.yaw,
        ),
        yaw: controls.yaw,
        jump: enabled && (k.has("Space") || controls.jump),
        dive: enabled && (k.has("KeyC") || controls.dive),
        sprint:
          enabled &&
          (k.has("ShiftLeft") || k.has("ShiftRight") || controls.sprint),
        seq: seq.current++,
      };
      prediction.advance(input, state);
      connection.input(input);
    });
    connection.presentation = prediction?.render(alpha, dt) ?? p ?? null;
    const visual = connection.presentation;
    diagnostics.grounded = visual?.grounded ?? false;
    let watched = visual;
    if (p && !p.alive && p.extractedAt===null) {
      const alive = state?.players.filter((q) => q.alive) ?? [];
      const id =
        alive.find((q) => q.id === controls.spectating)?.id ?? alive[0]?.id;
      controls.spectating = id ?? "";
      watched = id
        ? (connection.history.sample(id, now / 1000) ?? null)
        : visual;
    }
    if (!state) {
      camera.position.set(8, ground(8, -95) + 5, -95);
      camera.rotation.set(-0.06, Math.PI + 0.04, 0, "YXZ");
    } else if (watched) {
      camera.position.set(watched.x, watched.y + EYE_HEIGHT, watched.z);
      if(p?.extractedAt!==null&&p?.extractedAt!==undefined&&state.extraction.site){const e=state.extraction,ship=shipAt(connection.frameTime,e.site!,e.timeline);const c=prediction?.player.cabin??p.cabin,local=c?{x:c.x,y:c.y+EYE_HEIGHT,z:c.z}:passengerSeat(p.color);const seat=shipOffset(local,connection.frameTime,e.timeline);camera.position.set(ship.x+seat.x,ship.y+seat.y,ship.z+seat.z);}
      camera.rotation.set(-controls.pitch, Math.PI + controls.yaw, feedback.kick(now) * 0.006, "YXZ");
      if(p?.extractedAt!=null){const q=shipRotation(connection.frameTime,state.extraction.timeline);memory.current.expected.set(q.x,q.y,q.z,q.w);camera.quaternion.premultiply(memory.current.expected);}
      camera.updateMatrixWorld();
      memory.current.expected.copy(camera.quaternion);
      memory.current.owned = true;
      diagnostics.renderedYaw = controls.yaw;
      diagnostics.renderedPitch = controls.pitch;
    }
    if (!state || !p) return;
    const localWater=waterAt(state,camera.position.x,camera.position.z);
    controls.underwater=localWater.depth>0 && camera.position.y<localWater.level;
    soundscape.update(visual ?? undefined, state, controls.underwater, now);
    if (controls.slot !== 3) {
      controls.aim.valid = false;
      return;
    }
    if (now - lastAim.current < 70) return;
    lastAim.current = now;
    const m = memory.current;
    m.ray.setFromCamera(m.center, camera);
    const terrain = scene.getObjectByName("terrain"),
      objects = scene.getObjectByName("interactables"),
      hit = m.ray.intersectObjects(
        [terrain, objects].filter(Boolean) as THREE.Object3D[],
        true,
      )[0];
    camera.getWorldDirection(m.forward);
    const d = hit ? camera.position.distanceTo(hit.point) : 16;
    m.target.copy(camera.position).addScaledVector(m.forward, Math.min(20, d));
    controls.aim = {
      x: m.target.x,
      y:
        hit?.object.userData.physicalObjectId !== undefined
          ? hit.point.y + 2
          : m.target.y + 1,
      z: m.target.z,
      valid:
        controls.slot === 3 &&
        Math.abs(m.target.x) < 156 &&
        Math.abs(m.target.z) < 156 &&
        d > 1,
    };
  }, -2);
  return <FieldEffects />;
}
