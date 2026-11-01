# Publish the existing Tidefall multiplayer server

This is the unchanged game from checkpoint 3f1fd902. Publish a Node web service, not a static site. Sites hosts Cloudflare Workers and cannot run the current Node HTTP/WebSocket listener and continuously running authoritative simulation unchanged.

## Render

Use repository https://github.com/kylerrusin/Resolve and deployment branch codex/tidefall-publication-20261031. This branch contains only Tidefall at its root, with no Resolve app or unrelated repository history. Root directory: leave blank. Runtime: Node. Build: npm ci --include=dev --no-audit --no-fund && npm run build. Start: npm start. Health: /health. Environment: NODE_VERSION=22, NODE_ENV=production, HOST=0.0.0.0. Render supplies PORT. One instance is required because room state is in memory. Disable automatic deployment during judging.

Use the Render-assigned HTTPS onrender.com URL. The existing browser client selects wss:// automatically for HTTPS and connects to the same origin at /ws. No CORS proxy, account sign-in, external API keys, or separate frontend is required. The root page selects normal 30-minute survival with three-minute boarding. The existing four-minute judging preview button creates the short mode.

The Free plan can spin down after idle time and has limited CPU/memory; active rooms are not durable across a restart. No paid upgrade is authorized by this configuration. For reliable competition uptime, the owner can approve an always-on paid instance. Do not enable multiple instances without shared room routing/state.

## Verification

The existing production build, health/assets smoke check, 194 tests, and typecheck pass locally. After deployment, run npx tsx scripts/publication-smoke.ts https://ACTUAL-RENDER-HOST and open the real public URL in two fresh browser tabs. Verify room creation/join, shared players/tick, mode timelines, HTTPS and WSS. Do not call localhost a public URL or claim publication before the external endpoint responds.
