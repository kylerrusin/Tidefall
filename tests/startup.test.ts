import test from "node:test";
import assert from "node:assert/strict";
import { WebSocket } from "ws";
import { startServer } from "../server";
test("development HTTP, Vite and game WebSocket share one port and release it on close", async () => {
  const first = await startServer(0, false),
    port = (first.server.address() as { port: number }).port;
  let socket: WebSocket | undefined;
  try {
    const health = (await (
      await fetch(`http://127.0.0.1:${port}/health`)
    ).json()) as { application: string };
    assert.equal(health.application, "tidefall");
    const html = await (await fetch(`http://127.0.0.1:${port}/`)).text();
    assert.match(html, /TIDEFALL/);
    assert.match(html, /startup-status/);
    const module = await fetch(`http://127.0.0.1:${port}/src/main.tsx`);
    assert.equal(module.status, 200);
    socket = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    const welcome = new Promise<{ type: string }>((resolve, reject) => {
      const timer=setTimeout(()=>reject(new Error("Welcome timed out")),8000);
      socket!.once("error", reject);
      socket!.on("message", (raw) => {
        const msg = JSON.parse(raw.toString());
        if (msg.type === "welcome"){clearTimeout(timer);resolve(msg);}
        if(msg.type==="error"){clearTimeout(timer);reject(new Error(msg.message));}
      });
    });
    await new Promise<void>((r, reject) => {
      socket!.once("open", () => {
        socket!.send(JSON.stringify({ type: "join" }));
        r();
      });
      socket!.once("error", reject);
    });
    assert.equal((await welcome).type, "welcome");
    await assert.rejects(startServer(port, true), { code: "EADDRINUSE" });
    assert.equal((await fetch(`http://127.0.0.1:${port}/health`)).status, 200);
  } finally {
    socket?.terminate();
    await first.close();
  }
  const second = await startServer(port, false);
  try {
    assert.equal((await fetch(`http://localhost:${port}/health`)).status, 200);
  } finally {
    await second.close();
  }
});
