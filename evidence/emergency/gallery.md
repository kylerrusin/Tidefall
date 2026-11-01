# Emergency terrain repair — rendered evidence

[Engineering report](../../EMERGENCY_REPAIR.md) · [Exact cameras, geometry and slope audit](audit.json)

Seed 42, preview time 70, fixed eye/target/FOV, scenario lighting. Supplemental high-sun views are labeled separately.

| View | Baseline 7b9454dc | Emergency repair |
| --- | --- | --- |
| B: Original detailed outcrop | ![Before B](before-B.png) | ![After B](after-B.png) |
| A: New flow exposure | ![Before A](before-A.png) | ![After A](after-A.png) |
| C: New carbonate exposure | ![Before C](before-C.png) | ![After C](after-C.png) |
| E: Steep face | ![Before E](before-E.png) | ![After E](after-E.png) |
| F: Distant mountain | ![Before F](before-F.png) | ![After F](after-F.png) |
| G: Second ridge | ![Before G](before-G.png) | ![After G](after-G.png) |

## Isolated slope gate

[Stage B / F](stage-b-F.png) · [Stage B / G](stage-b-G.png)

## Supplemental integration views

[Flow exposure from farther away](after-A25.png) · [Carbonate region from farther away](after-C25.png). An existing creature crosses the latter view. These are supplementary after-only views.

## High-sun checks

![High sun B](high-B.png)

![High sun A](high-A.png)

![High sun C](high-C.png)

![High sun F](high-F.png)

![High sun G](high-G.png)

## Rejected orientations

The first two placements presented the thin edges of the source mesh. They were rotated before acceptance; the carbonate sample was subsequently moved and reduced.

[Rejected A](rejected-edge-on-A.png) · [Rejected C](rejected-edge-on-C.png)

## Render-only geometry cost

Same camera and materials, 300-frame samples with the two added render groups hidden/visible.

![Hidden](performance-hidden.png)

![Visible](performance-visible.png)

[Hidden sample state](performance-hidden.txt) · [Visible sample state](performance-visible.txt)

[Rejected oversized carbonate placement](rejected-tall-contact-C.png) · [Production handoff](production-title.png)
