# Public Tidefall publication

Public game: https://tidefall-multiplayer.onrender.com/

Published on Render as the actual Node HTTP/WebSocket service, not a static replacement. Service srv-dbjd3lp42hec73cm2g2g; successful deploy dep-dbjd3m142hec73cm2gi0; source commit 289b2aa3d99a535a82521a840942482a914da7a1 at https://github.com/kylerrusin/Tidefall (main). Local game checkpoint 3f1fd902 and codex/tidefall-before-publication-20261031 are preserved. No graphics, terrain, gameplay, UI or scientific models changed for publishing. Local and deployment browser bundles have identical SHA-256 27F0A15D94B74307102D67B528FA6DBE6D678881B2E2FB85C9192B20EF50BD10.

Sites was inspected using its connector and skill. Its Cloudflare Worker runtime cannot host this continuously running Node server unchanged, so the requested conventional-host fallback was used. Render's service is public, uses managed HTTPS and same-origin WSS at /ws, and requires no visitor account or local computer. Free compute, one instance, HOST=0.0.0.0, NODE_VERSION=22, NODE_ENV=production, /health readiness, automatic redeploys off.

Anonymous public health and asset requests passed. Two independent WSS clients shared deeply identical snapshots in both normal survival (1800-second surface phase, 1980-second boarding close) and judging preview (240-second round). Public two-browser room 9D54C showed both Ivory and Amber, synchronized ready state, and both clients entered the match. Saved screenshots and text are in evidence/publication. The initial command-line attempt timed out waiting for shared state; the recorded retry passed both modes. No new 30-minute soak is claimed.

The Free plan can take 50 seconds or more to wake after inactivity and has limited CPU. In-memory rooms end if the service restarts. No paid upgrade or fake multiplayer was introduced. See evidence/publication/public-verification.json for public test results.
