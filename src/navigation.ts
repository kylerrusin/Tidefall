import type { V3 } from "./model";
/** Bounded local A*: authoritative physics supplies the clearance test. Four-way
 * edges avoid cutting through corners. Replanned at <=1 Hz, never per render. */
export function findRoute(from: V3, to: V3, height: (x: number, z: number) => number,
  clear: (a: V3, b: V3) => boolean, budget = 320, clearance=.82): V3[] {
  const cell = 3, sx = Math.round(from.x / cell), sz = Math.round(from.z / cell);
  const tx = Math.round(to.x / cell), tz = Math.round(to.z / cell);
  const key = (x: number, z: number) => `${x},${z}`;
  const start = key(sx, sz), open = [{ x: sx, z: sz, g: 0, f: 0 }];
  const costs = new Map([[start, 0]]), parents = new Map<string, string>(), points = new Map<string, V3>();
  points.set(start, { ...from });
  let best = start, bestDistance = Infinity;
  for (let n = 0; open.length && n < budget; n++) {
    open.sort((a, b) => a.f - b.f || a.g - b.g || a.x - b.x || a.z - b.z);
    const node = open.shift()!, k = key(node.x, node.z), a = points.get(k)!;
    if (node.g > costs.get(k)!) continue;
    const distance = Math.hypot(node.x - tx, node.z - tz);
    if (distance < bestDistance) { bestDistance = distance; best = k; }
    if (distance < 1.1) { best = k; break; }
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = node.x + dx, z = node.z + dz, next = key(x, z);
      if (Math.abs(x - sx) > 13 || Math.abs(z - sz) > 13 || Math.abs(x * cell) > 150 || Math.abs(z * cell) > 150) continue;
      const b = { x: x * cell, y: height(x * cell, z * cell) + clearance, z: z * cell };
      const g = node.g + cell + Math.abs(b.y - a.y) * 1.4;
      if (g >= (costs.get(next) ?? Infinity) || Math.abs(b.y - a.y) > 1.5 || !clear(a, b)) continue;
      parents.set(next, k); points.set(next, b); costs.set(next, g);
      open.push({ x, z, g, f: g + Math.hypot(x - tx, z - tz) * cell });
    }
  }
  const route: V3[] = [];
  while (best !== start && route.length < 40) {
    route.push(points.get(best)!); best = parents.get(best) ?? start;
  }
  return route.reverse();
}
