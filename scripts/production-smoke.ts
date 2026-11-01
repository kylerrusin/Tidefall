import assert from "node:assert/strict";
import { startServer } from "../server";

const game=await startServer(0,true);
try {
  const port=(game.server.address() as {port:number}).port,base=`http://localhost:${port}`;
  const health=await (await fetch(base+"/health")).json() as {application:string;ok:boolean;mode:string};
  assert.equal(health.application,"tidefall");assert.equal(health.ok,true);assert.equal(health.mode,"production");
  const page=await fetch(base),html=await page.text();assert.equal(page.status,200);assert.ok(!html.includes("/@vite/client"));
  const assets=[...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)].map(m=>m[1]);assert.ok(assets.length>=2);
  for(const path of assets){const response=await fetch(new URL(path,base));assert.equal(response.status,200,path);assert.ok((await response.text()).length>100,path);}
  console.log(JSON.stringify({productionHealth:"pass",html:"pass",assets:assets.length,webSockets:"covered by network.test.ts"}));
} finally { await game.close(); }
