# Active-build verification

The verified candidate source was committed as `d5a504b7` and fast-forwarded into the active checkout at `C:\Users\Kyler\Resolve\tidefall`.

The pre-change source remains at `ca81ca72` on recovery branch `codex/tidefall-pre-coherence`. The candidate checkout and evidence remain at `C:\Users\Kyler\Resolve\tmp\worktrees\tidefall-coherence\tidefall`. Unrelated Resolve changes were left untouched.

- Active URL: **http://localhost:4174/**.
- Production server restarted at 2026-10-31 16:53 America/Denver, with no active rooms interrupted.
- Detached hidden launcher PID: **32508**. Process metadata: `C:\Users\Kyler\Resolve\tmp\coherence-active-process.json`.
- Server stdout/stderr: `C:\Users\Kyler\Resolve\tmp\coherence-active.stdout.log` and `C:\Users\Kyler\Resolve\tmp\coherence-active.stderr.log`. Startup stderr is empty.
- Active build succeeded; JS/CSS asset hashes agree with the tested candidate. Existing large-bundle warning remains.
- `GET /health` reports Tidefall / production / port 4174 / ok.
- Actual browser verification created normal room D71C1, readied, started, skipped the introduction, and rendered the first-person scene with the top-left inspector intact. No browser errors. See [active screenshot](active-4174.png) and [DOM evidence](active-4174.txt).
- The earlier production-candidate smoke test used two browser clients in normal room B050C, both ready, a shared start, two visible survivors, keyboard input, and a shared competitive result. See the production-multiplayer images/text. Both clients had no console errors. No full multiplayer extraction manual run is claimed.
- In-app browser Pointer Lock is blocked. The rendered game explicitly reports this while preserving keyboard movement. Native continuous mouse-look was not reverified in this run.
- The final test room was left through the game menu; the delivered tab is at the homepage, ready to play. The final server remains detached and running. Owned QA servers on 4176–4179 and pinning helpers were stopped.

Read [the full 18-part report](REPORT.md), [comparisons](gallery.html), and [normal extraction milestone playback](extraction.html). Exact original screenshot water/flicker defects remain unconfirmed as explained in the report.
