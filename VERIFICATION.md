# Verification — Round 3

Current implementation: first-person competitive survival. See [ROUND3.md](ROUND3.md) for evidence and limits; [ROUND2.md](ROUND2.md) is historical.

* Tidefall: 41 automated tests passed, no failures/skips; typecheck and production build passed.
* Resolve: 385 tests passed, 1 optional PDF/OCR test skipped, no failures; typecheck passed with incremental output disabled.
* Full numerical survival arc: protected astronaut won after 413.10 seconds; exposed astronaut died of hypothermia.
* Three genuine browser clients: join/ready/start, shared state/flooding, supplies, fields, oxygen use, thermal kit/shelter, deaths, matching results, rematch, live refresh/rejoin, and spectator cycling.
* Delayed client: 80 ms inbound delay, zero corrections in recorded clean High and Low movement routes, including repeated jumps. Observed approximately 45 and 51 FPS respectively with two simultaneous embedded views.
* Final single-view live practice: 73 FPS, 13.8 ms mean, 15.9 ms p95, 17.6 ms maximum; zero recorded corrections during sprint/walk/jump. No gameplay fixtures were used for this check.
* No errors recorded in final browser console checks. Known warning: Fiber THREE.Clock deprecation; build warns about the large lazy Rapier/WASM chunk.

Pointer Lock was rejected by the embedded preview and its visible error handling was verified. Native Edge app access timed out: actual native capture, cursor hiding, edge travel and reacquisition remain unverified. Lifecycle and relative-delta unit tests are not a substitute for this check.

Browser travel, water time and vulnerable suit values were explicitly staged in an isolated local QA room. Interactions and elimination still used actual clients and normal authority. No complete unassisted human match, independent WAN, four-player load, physical mobile test, Docker execution or public deployment is claimed. Screenshots are actual captures in the ignored local screenshots/round3 directory.
