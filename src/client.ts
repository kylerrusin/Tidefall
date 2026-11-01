import type {MatchMode} from './mission';
import type { Prediction } from "./prediction";
import { SnapshotBuffer, diagnostics } from "./presentation";
import { Input, Snapshot, V3 } from "./model";
export class Connection {
  requestedMode:MatchMode='survival';
  ws: WebSocket | null = null;
  state: Snapshot | null = null;
  id = "";
  code = "";
  error = "";
  connected = false;
  pending = false;
  retries = 0;
  timer: ReturnType<typeof setTimeout> | null = null;
  listeners = new Set<() => void>();
  lastState = 0;
  clockOffset=NaN;
  frameTime=0;
  worldTime(now=performance.now()){const s=this.state;if(!s)return 0;if(s.status!=='running')return s.time;return Math.min(s.time+.2,now/1000+this.clockOffset-.1);}
  history = new SnapshotBuffer();
  prediction: Prediction | null = null;
  presentation: import("./model").Player | null = null;
  physicsLoading = false;
  private lastNotify = 0;
  private pulse: ReturnType<typeof setInterval> | null = null;
  status = "READY TO CONNECT";
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };
  notify() {
    for (const fn of this.listeners) fn();
  }
  join(code = "") {
    if (this.timer) clearTimeout(this.timer);
    this.code = code.toUpperCase();
    this.error = "";
    this.pending = true;
    this.status = "CONNECTING";
    this.notify();
    this.open();
  }
  open() {
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
    }
    const ws = new WebSocket(
      `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws`,
    );
    this.ws = ws;
    ws.onopen = () => {
      this.status = "JOINING";
      let saved: { code?: string; token?: string } = {};
      try {
        saved = JSON.parse(sessionStorage.getItem("tidefall-player") ?? "{}");
      } catch {}
      ws.send(
        JSON.stringify({
          type: "join",
          mode:this.requestedMode,
          code: this.code,
          token: saved.code === this.code ? saved.token : undefined,
        }),
      );
    };
    const receive = (e: MessageEvent) => {
      if (this.ws !== ws) return;
      const msg = JSON.parse(e.data);
      if (msg.type === "welcome") {
        if (this.prediction) this.prediction.pending = [];
        this.id = msg.id;
        this.code = msg.code;
        this.connected = true;
        this.status = "CONNECTED";
        if (this.pulse) clearInterval(this.pulse);
        this.pulse = setInterval(
          () => this.send("ping-clock", { sent: performance.now() }),
          1500,
        );
        this.pending = false;
        this.retries = 0;
        this.error = "";
        sessionStorage.setItem(
          "tidefall-player",
          JSON.stringify({ code: this.code, token: msg.token }),
        );
      }
      if (msg.type === "state") {
        const previous = this.state;
        this.state = msg.state;
        const observed=this.state!.time-performance.now()/1000;
        this.clockOffset=!Number.isFinite(this.clockOffset)||previous?.status!==this.state?.status||Math.abs(observed-this.clockOffset)>1?observed:this.clockOffset+(observed-this.clockOffset)*.08;
        if (
          previous?.status !== this.state?.status ||
          previous?.seed !== this.state?.seed
        ) {
          this.history.frames = [];
          if (this.prediction) this.prediction.pending = [];
        }
        this.history.push(msg.state, performance.now() / 1000);
        const p = this.state?.players.find((p) => p.id === this.id);
        if (
          p &&
          this.prediction &&
          this.prediction.seed === this.state!.seed &&
          this.prediction.player.id === p.id
        )
          this.prediction.receive(p, this.state!);
        else if (p && !this.physicsLoading) {
          this.physicsLoading = true;
          void import("./prediction")
            .then(async (module) => {
              await module.initPredictionPhysics();
              this.prediction?.dispose();
              const latest = this.state?.players.find((v) => v.id === this.id);
              if (latest)
                this.prediction = new module.Prediction(
                  this.state!.seed,
                  latest,
                );
              this.physicsLoading = false;
              if(this.state && this.prediction?.seed===this.state.seed)this.send("loaded",{position:{seed:this.state.seed}});
              this.notify();
            })
            .catch(() => {
              this.physicsLoading = false;
              this.error = "Collision module failed to load. Reload to retry.";
              this.notify();
            });
        }
        if(p && this.prediction?.seed===this.state!.seed && !p.loaded)this.send("loaded",{position:{seed:this.state!.seed}});
        diagnostics.physicsMs = this.state?.physicsMs ?? 0;
        diagnostics.colliders = this.state?.colliderCount ?? 0;
        diagnostics.objects = this.state?.objects.length ?? 0;
        this.lastState = performance.now();
      }
      if (msg.type === "error") {
        this.error = msg.message;
        this.pending = false;
        if (!this.connected) {
          ws.onclose = null;
          ws.close();
          this.state = null;
          this.id = "";
          this.status = "JOIN FAILED";
          this.prediction?.dispose();
          this.prediction = null;
        }
      }
      if (msg.type === "pong-clock")
        diagnostics.rtt = performance.now() - msg.sent;
      if (msg.type !== "state" || performance.now() - this.lastNotify > 200) {
        this.notify();
        this.lastNotify = performance.now();
      }
    };
    const lag = import.meta.env.DEV
      ? Math.max(
          0,
          Math.min(
            250,
            Number(new URLSearchParams(location.search).get("latency") ?? 0),
          ),
        )
      : 0;
    ws.onmessage = (e) => {
      if (lag) setTimeout(() => receive(e), lag);
      else receive(e);
    };
    ws.onclose = () => {
      this.connected = false;
      this.status = "RECONNECTING";
      if (this.pulse) clearInterval(this.pulse);
      this.pending = false;
      if (this.id && this.retries < 12) {
        this.error = "Signal lost · reconnecting";
        this.timer = setTimeout(
          () => this.open(),
          Math.min(5000, 700 * ++this.retries),
        );
      } else this.error = "Connection closed. Reload to rejoin.";
      this.notify();
    };
    ws.onerror = () => {
      this.error = "Cannot reach the expedition server.";
      this.notify();
    };
  }
  send(type: string, extra: Record<string, unknown> = {}) {
    if (this.ws?.readyState === WebSocket.OPEN && this.connected)
      this.ws.send(JSON.stringify({ type, ...extra }));
  }
  input(input: Input) {
    this.send("input", { input });
  }
  anchor(position: V3 & { sign?: number }) {
    this.send("anchor", { position });
  }
  leave() {
    sessionStorage.removeItem("tidefall-player");
    if (this.timer) clearTimeout(this.timer);
    if (this.pulse) clearInterval(this.pulse);
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
    }
    this.ws = null;
    this.state = null;
    this.connected = false;
    this.pending = false;
    this.id = "";
    this.code = "";
    this.error = "";
    this.status = "READY TO CONNECT";
    this.prediction?.dispose();
    this.prediction = null;
    this.presentation = null;
    this.history.frames = [];
    this.notify();
  }
}
export const connection = new Connection();
