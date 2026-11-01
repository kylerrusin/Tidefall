# Free-plan network lag repair

The public game remains https://tidefall-multiplayer.onrender.com/. The Free plan and existing graphics, world geometry, scientific calculations, mission timing and 60 Hz authoritative physics are retained.

Before: one public test advanced 9.0 simulation seconds in 14.805 wall seconds. Snapshot intervals averaged 411 ms (p95 1109 ms), rather than the intended 100 ms. The limited free CPU was falling behind.

Changes: unchanged door poses are no longer repeatedly submitted to physics; resting dry objects can sleep, with water and field forces still waking them; water-grid export avoids generic typed-array callback allocation; identical climate inputs reuse the same immutable calculation. A negotiated lossless grid transport and versioned environment baseline cut repeated bytes. Older clients still receive the original full Snapshot format. The existing Snapshot contract is reconstructed before prediction, water rendering, inspection or UI use it.

Local fixed-seed protected-survival benchmark: mean step 3.664 → 3.111 ms (~15% lower). All 20 sampled state hashes across 40 simulation seconds match the baseline exactly. Typical seed-42 network payload: 88,960 bytes full → 20,852 with cached fields (~77% smaller); a field refresh is 52,736 bytes. Seed -43: 76,411 → 18,260 bytes. These are local samples, not a guarantee that a 0.1 CPU instance can sustain every multiplayer load.

Validation: 199 Tidefall tests, typecheck and production build pass. Mixed-version sockets, destination changes, invalid grid runs, exact decoded-state equivalence, stationary-door collision, and object sleep/wake behavior have focused coverage. Resolve: 385 tests passed with one conditional fixture skip; root typecheck passed. Evidence is in evidence/network-lag. Post-deployment measurements are recorded separately after the live service is verified.
