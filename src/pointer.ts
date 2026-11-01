import { clampPitch } from "./locomotion";
export type LockState = "unlocked" | "requesting" | "locked" | "blocked";
/** Pointer-lock lifecycle, independent of rendering. Request is only called by a UI gesture. */
export class PointerSession {
  state: LockState = "unlocked";
  message = "";
  private epoch = 0;
  constructor(
    private port: { request: () => void | Promise<void>; release: () => void },
    private changed: (state: LockState, message: string) => void,
    private resetInput: () => void,
  ) {}
  request() {
    if (this.state === "locked" || this.state === "requesting") return;
    this.set("requesting");
    const epoch = ++this.epoch;
    try {
      const result = this.port.request();
      if (result) void result.catch(() => { if (epoch === this.epoch) this.fail(); });
    } catch {
      this.fail();
    }
  }
  change(locked: boolean) {
    this.resetInput();
    this.set(locked ? "locked" : "unlocked");
  }
  release() {
    this.epoch++;
    this.resetInput();
    this.port.release();
    this.set("unlocked");
  }
  fail() {
    if (this.state === "locked") return;
    this.resetInput();
    this.set(
      "blocked",
      "Mouse capture is blocked here. Open this address in a full browser, then click Resume. Keyboard movement remains available.",
    );
  }
  private set(state: LockState, message = "") {
    this.state = state;
    this.message = message;
    this.changed(state, message);
  }
}
/** Relative deltas only. No clientX/clientY, edge following or accumulated cursor position. */
export function relativeLook(
  yaw: number,
  pitch: number,
  dx: number,
  dy: number,
  sensitivity: number,
  invert: boolean,
) {
  if (![dx, dy].every(Number.isFinite)) return { yaw, pitch };
  const nextYaw = yaw - dx * sensitivity;
  return {
    yaw: Math.atan2(Math.sin(nextYaw), Math.cos(nextYaw)),
    pitch: clampPitch(
      pitch +
        dy * sensitivity * (invert ? -1 : 1),
    ),
  };
}
