# Round 12 rendered evidence

Baseline commit: 640c4fce2456d34b5711a640ea82899f776907a9. Exact poses, seed, time, FOV and lighting are in [cameras.json](cameras.json). Images are actual browser renders, 1280 × 720. See [the engineering report](../../ROUND12.md) for conclusions and limits.

## Fixed comparisons

| View | Round 11 | Round 12 |
| --- | --- | --- |
| A · Exposed flow | ![Before A](before-A.png) | ![After A](after-A.png) |
| B · Original detailed outcrop | ![Before B](before-B.png) | ![After B](after-B.png) |
| C · Carbonate contact | ![Before C](before-C.png) | ![After C](after-C.png) |
| D · Moderate shore | ![Before D](before-D.png) | ![After D](after-D.png) |
| E · Steep fault face | ![Before E](before-E.png) | ![After E](after-E.png) |
| F · Distant streaked mountain | ![Before F](before-F.png) | ![After F](after-F.png) |
| G · Second ridge | ![Before G](before-G.png) | ![After G](after-G.png) |
| H · Coast, underwater at this tide | ![Before H](before-H.png) | ![After H](after-H.png) |
| I · Valley sediment, underwater at this tide | ![Before I](before-I.png) | ![After I](after-I.png) |
| B5 · Outcrop / nominal 5 m | ![Before B5](before-B5.png) | ![After B5](after-B5.png) |
| B25 · Outcrop / nominal 25 m | ![Before B25](before-B25.png) | ![After B25](after-B25.png) |
| B100 · Outcrop / nominal 100 m | ![Before B100](before-B100.png) | ![After B100](after-B100.png) |

W is an additional weathered-upland view, with macro weights printed on the capture. It has no baseline comparison.

![Weathered upland](after-W.png)

## Diagnostic gate before coverage changes

[diagnostic-F-1.png](diagnostic-F-1.png) · [diagnostic-F-17.png](diagnostic-F-17.png) · [diagnostic-F-18.png](diagnostic-F-18.png) · [diagnostic-F-19.png](diagnostic-F-19.png) · [diagnostic-F-2.png](diagnostic-F-2.png) · [diagnostic-F-3.png](diagnostic-F-3.png) · [diagnostic-F-4.png](diagnostic-F-4.png) · [diagnostic-F-5.png](diagnostic-F-5.png) · [diagnostic-F-6.png](diagnostic-F-6.png) · [diagnostic-F-7.png](diagnostic-F-7.png) · [diagnostic-F-8.png](diagnostic-F-8.png)

Normal reconstruction repaired in isolation:

![Projection repair before coverage changes](projection-repair-F.png)

## Existing rock sampler on three controlled surfaces

[reuse-A.png](reuse-A.png) · [reuse-A25.png](reuse-A25.png) · [reuse-C.png](reuse-C.png) · [reuse-C25.png](reuse-C25.png) · [reuse-E.png](reuse-E.png) · [reuse-E25.png](reuse-E25.png)

## Actual material fields

K masks explicitly hide water using the visible checkbox. 9 = bedrock; 10 = cover; 11 = slope; 12 = deposition; 13/14/15 = exposed/weathered/sediment; 16 = LOD.

[mask-K-10.png](mask-K-10.png) · [mask-K-11.png](mask-K-11.png) · [mask-K-12.png](mask-K-12.png) · [mask-K-13.png](mask-K-13.png) · [mask-K-14.png](mask-K-14.png) · [mask-K-15.png](mask-K-15.png) · [mask-K-16.png](mask-K-16.png) · [mask-K-9.png](mask-K-9.png)

![Bedrock field](mask-K-9.png)

![Weathered field](mask-K-14.png)

![Sediment field](mask-K-15.png)

## Projection and water diagnostics

[diagnostic-D-20.png](diagnostic-D-20.png) · [diagnostic-D-21.png](diagnostic-D-21.png) · [diagnostic-D-5.png](diagnostic-D-5.png) · [diagnostic-D-6.png](diagnostic-D-6.png) · [projection-E-5.png](projection-E-5.png) · [projection-E-6.png](projection-E-6.png)

## Controlled lighting

Solar elevations 12° (1) and 55° (2), azimuth .7 rad. All other fixture values stay fixed.

[sun-B-1.png](sun-B-1.png) · [sun-B-2.png](sun-B-2.png) · [sun-E-1.png](sun-E-1.png) · [sun-E-2.png](sun-E-2.png) · [sun-G-1.png](sun-G-1.png) · [sun-G-2.png](sun-G-2.png)

![High-sun ridge](sun-G-2.png)

## Rejected iteration

This per-vertex fine catalog distribution produced ribbons across long apron triangles. It was rejected in favor of coherent parent provinces/flows.

![Rejected unit distribution](rejected-unit-interpolation-G.png)

## Two live rendering clients

Different client IDs, same room/seed/time/pose and material probe. The room also contains a fixture participant.

![Client A](client-a-E.png)

![Client B](client-b-E.png)

[client-a-state.txt](client-a-state.txt) · [client-b-state.txt](client-b-state.txt)
