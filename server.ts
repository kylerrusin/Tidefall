import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import { WebSocketServer, WebSocket } from "ws";
import { createServer as createViteServer } from "vite";
import { FixedClock } from "./src/locomotion";
import { Expedition, initPhysics } from "./src/simulation";
import { destinationSeed, planetIdForSeed } from "./src/planets";
export async function startServer(
  port = Number(process.env.PORT ?? 4173),
  production = process.env.NODE_ENV === "production" ||
    process.argv.includes("--production"),
) {
  await initPhysics();
  const root = fileURLToPath(new URL(".", import.meta.url));
  let vite: Awaited<ReturnType<typeof createViteServer>> | null = null;
  const server = createServer(async (req, res) => {
    if (req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          application: "tidefall",
          ok: true,
          rooms: rooms.size,
          mode: production ? "production" : "development",
          port: (server.address() as { port: number })?.port,
        }),
      );
      return;
    }
    if (vite) {
      vite.middlewares(req, res);
      return;
    }
    try {
      const pathname = decodeURIComponent((req.url ?? "/").split("?")[0]),
        base = resolve(root, "dist"),
        path = resolve(
          base,
          "." + (pathname === "/" ? "/index.html" : pathname),
        );
      if (path !== base && !path.startsWith(base + sep)) {
        res.writeHead(403).end();
        return;
      }
      const data = await readFile(path);
      res.writeHead(200, {
        "Content-Type":
          (
            {
              ".html": "text/html",
              ".js": "text/javascript",
              ".css": "text/css",
              ".svg": "image/svg+xml",
            } as Record<string, string>
          )[extname(path)] ?? "application/octet-stream",
      });
      res.end(data);
    } catch {
      res.writeHead(404).end("Not found");
    }
  });
  if (!production)
    vite = await createViteServer({
      root,
      server: { middlewareMode: true, ws: { server, path: "/vite-hmr" } },
      appType: "spa",
    });
  const wss = new WebSocketServer({ noServer: true, maxPayload: 4096 });
  server.on("upgrade", (req, socket, head) => {
    if (req.url?.split("?")[0] === "/ws")
      wss.handleUpgrade(req, socket, head, (ws) =>
        wss.emit("connection", ws, req),
      );
  });
  const rooms = new Map<string, Expedition>(),
    clients = new Map<
      WebSocket,
      {
        code: string;
        id: string;
        count: number;
        since: number;
        lastInput: number;
        alive: boolean;
      }
    >();
  const send = (ws: WebSocket, data: unknown) => {
    if (ws.readyState === WebSocket.OPEN && ws.bufferedAmount < 1e6)
      ws.send(JSON.stringify(data));
  };
  wss.on("connection", (ws) => {
    let identity: { code: string; id: string } | null = null;
    let preCount = 0;
    const joinTimeout = setTimeout(() => {
      if (!identity) ws.close(1008, "Join timeout");
    }, 10000);
    ws.on("pong", () => {
      const c = clients.get(ws);
      if (c) c.alive = true;
    });
    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (!msg || typeof msg.type !== "string") return;
        if (!identity) {
          if (++preCount > 5) {
            ws.close(1008, "Too many attempts");
            return;
          }
          if (msg.type !== "join") return;
          let code =
            typeof msg.code === "string"
              ? msg.code
                  .toUpperCase()
                  .replace(/[^A-Z0-9]/g, "")
                  .slice(0, 5)
              : "";
          let room = rooms.get(code);
          if (code && !room) {
            send(ws, {
              type: "error",
              message: "No expedition with that code.",
            });
            return;
          }
          if (!code) {
            if (rooms.size >= 30) {
              send(ws, {
                type: "error",
                message: "Server is full. Try again shortly.",
              });
              return;
            }
            do {
              code = randomBytes(4).toString("hex").slice(0, 5).toUpperCase();
            } while (rooms.has(code));
            room = new Expedition(code, Math.floor(Math.random() * 100000),msg.mode==='preview'?'preview':'survival');
            rooms.set(code, room);
          }
          const p = room!.join(
            typeof msg.token === "string" ? msg.token : undefined,
          );
          p.loaded = false;
          for (const [old, c] of clients)
            if (c.id === p.id && c.code === code) {
              clients.delete(old);
              old.close(1000, "Reconnected elsewhere");
            }
          identity = { code, id: p.id };
          clients.set(ws, {
            ...identity,
            count: 0,
            since: Date.now(),
            lastInput: Date.now(),
            alive: true,
          });
          clearTimeout(joinTimeout);
          send(ws, {
            type: "welcome",
            id: p.id,
            token: room!.tokens.get(p.id),
            code,
          });
          send(ws, { type: "state", state: room!.snapshot() });
          return;
        }
        const c = clients.get(ws);
        if (!c) return;
        if (Date.now() - c.since > 1000) {
          c.since = Date.now();
          c.count = 0;
        }
        if (++c.count > 80) return;
        const room = rooms.get(c.code)!;
        if (msg.type === "ping-clock") {
          send(ws, { type: "pong-clock", sent: msg.sent });
          return;
        }
        if (msg.type === "input") {
          room.input(c.id, msg.input);
          c.lastInput = Date.now();
        } else if (
          (msg.type === "rematch" || (msg.type === "destination" && room.status === "ready" && ["tidefall","pyrax"].includes(msg.planet))) &&
          room.host === c.id &&
          room.status !== "running"
        ) {
          const next = room.reset(
            msg.type === "destination" ? destinationSeed(room.seed,msg.planet) : msg.newSeed ? destinationSeed(Math.floor(Math.random()*100000),planetIdForSeed(room.seed)) : room.seed,
          );
          for (const p of room.players.values())
            if (p.connected) {
              const np = next.join();
              const oldId = np.id;
              next.players.delete(oldId);
              const secret = next.tokens.get(oldId)!;
              next.tokens.delete(oldId);
              next.tokens.set(p.id, room.tokens.get(p.id) ?? secret);
              np.id = p.id;
              np.loaded = false;
              next.players.set(p.id, np);
              for (const map of [
                next.bodies,
                next.colliders,
                next.controllers,
              ]) {
                const value = map.get(oldId)!;
                map.delete(oldId);
                (map as Map<string, typeof value>).set(p.id, value);
              }
              if (next.host === oldId) next.host = p.id;
            }
          room.dispose();
          rooms.set(c.code, next);
        } else room.action(c.id, msg.type, msg.position);
      } catch (e) {
        send(ws, {
          type: "error",
          message: e instanceof Error ? e.message : "Invalid action",
        });
      }
    });
    ws.on("close", () => {
      clearTimeout(joinTimeout);
      const c = clients.get(ws);
      if (c) {
        rooms.get(c.code)?.disconnect(c.id);
        clients.delete(ws);
      }
    });
    ws.on("error", () => {});
  });
  const clock = new FixedClock();
  let last = performance.now(),
    lastBroadcast = 0;
  const timer = setInterval(() => {
    const now = performance.now();
    clock.advance((now - last) / 1000, () => {
      for (const room of rooms.values()) {
        if ([...room.players.values()].some((p) => p.connected)) room.step();
        else if (Date.now() - room.lastActive > 120000) {
          room.dispose();
          rooms.delete(room.code);
        }
      }
    });
    last = now;
    const snapshots = new Map<string, string>();
    for (const [ws, c] of clients) {
      const room = rooms.get(c.code);
      if (!room) continue;
      if (Date.now() - c.lastInput > 600) {
        const p = room.players.get(c.id);
        if (p) {
          p.input = { ...p.input, x: 0, z: 0, jump: false, dive: false };
          room.commands.delete(c.id);
        }
      }
      if (now - lastBroadcast >= 100) {
        let state = snapshots.get(c.code);
        if (!state) {
          const begin=performance.now();state=JSON.stringify({type:"state",state:room.snapshot()});room.networkMs=performance.now()-begin;room.networkBytes=Buffer.byteLength(state);
          snapshots.set(c.code, state);
        }
        if(ws.readyState===WebSocket.OPEN&&ws.bufferedAmount<1e6)ws.send(state);
      }
    }
    if (now - lastBroadcast >= 100) lastBroadcast = now;
  }, 8);
  const heartbeat = setInterval(() => {
    for (const [ws, c] of clients) {
      if (!c.alive) {
        ws.terminate();
        continue;
      }
      c.alive = false;
      ws.ping();
    }
  }, 15000);
  const host = process.env.HOST ?? "::";
  try {
    await new Promise<void>((r, reject) => {
      server.once("error", reject);
      server.listen({ port, host, ipv6Only: false }, () => {
        server.off("error", reject);
        r();
      });
    });
  } catch (e) {
    clearInterval(timer);
    clearInterval(heartbeat);
    await vite?.close();
    wss.close();
    throw e;
  }
  console.log(
    `TIDEFALL http://127.0.0.1:${(server.address() as { port: number }).port} (localhost supported)\nGame + WebSocket: same port /ws · ${production ? "production" : "development"} · bind ${host}\nKeep this terminal open. From the repository root: npm run tidefall`,
  );
  return {
    server,
    rooms,
    close: async () => {
      clearInterval(timer);
      clearInterval(heartbeat);
      for (const ws of wss.clients) ws.terminate();
      // Close Vite's upgraded HMR sockets before waiting for the shared HTTP server.
      await vite?.close();
      await new Promise<void>((r) => wss.close(() => r()));
      await new Promise<void>((r) => server.close(() => r()));
      for (const room of rooms.values()) room.dispose();
    },
  };
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  startServer()
    .then((running) => {
      let closing = false;
      const stop = async () => {
        if (closing) return;
        closing = true;
        await running.close();
        process.exit(0);
      };
      process.on("SIGINT", stop);
      process.on("SIGTERM", stop);
    })
    .catch(async (e) => {
      if (e?.code === "EADDRINUSE") {
        try {
          const response = await fetch(
            "http://127.0.0.1:" + Number(process.env.PORT ?? 4173) + "/health",
            { signal: AbortSignal.timeout(1500) },
          );
          const health = (await response.json()) as { application?: string };
          if (health.application === "tidefall") {
            console.log(
              "Tidefall is already running: http://127.0.0.1:" +
                Number(process.env.PORT ?? 4173),
            );
            process.exit(0);
          }
        } catch {}
        console.error(
          "Port " +
            (process.env.PORT ?? 4173) +
            " is in use by another service. Set PORT explicitly; no process was stopped.",
        );
      } else console.error(e);
      process.exit(1);
    });
}
