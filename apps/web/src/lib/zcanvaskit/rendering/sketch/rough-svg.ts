/**
 * Deterministic seeded pseudorandom number generator (Mulberry32). Exported so
 * every hand-drawn surface in the library — rough shapes, connectors and ink —
 * wobbles from one shared, reproducible source.
 */
export function createSeededRandom(seed: number) {
  let s = Math.abs(seed) || 1;
  return function () {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function stringToSeed(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Generate a deterministic sketchy hand-drawn line between two points.
 */
export function getSketchLinePath(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  seed: number | string = 1,
  roughness = 1.2
): string {
  const numSeed = typeof seed === 'string' ? stringToSeed(seed) : seed;
  const rand = createSeededRandom(numSeed);

  const len = Math.hypot(x2 - x1, y2 - y1);
  const offset = Math.min(len * 0.05, roughness * 2.5);

  const mx = (x1 + x2) / 2 + (rand() - 0.5) * offset;
  const my = (y1 + y2) / 2 + (rand() - 0.5) * offset;

  const ex = x2 + (rand() - 0.5) * (offset * 0.5);
  const ey = y2 + (rand() - 0.5) * (offset * 0.5);

  return `M ${x1} ${y1} Q ${mx} ${my} ${ex} ${ey}`;
}

/**
 * Generate a deterministic hand-drawn rectangle with subtle dual-pass roughness.
 */
export function getSketchRectPath(
  x: number,
  y: number,
  width: number,
  height: number,
  seed: number | string = 1,
  roughness = 1.5
): string {
  const numSeed = typeof seed === 'string' ? stringToSeed(seed) : seed;
  const rand = createSeededRandom(numSeed);

  const r = roughness;
  const x1 = x + (rand() - 0.5) * r;
  const y1 = y + (rand() - 0.5) * r;
  const x2 = x + width + (rand() - 0.5) * r;
  const y2 = y + (rand() - 0.5) * r;
  const x3 = x + width + (rand() - 0.5) * r;
  const y3 = y + height + (rand() - 0.5) * r;
  const x4 = x + (rand() - 0.5) * r;
  const y4 = y + height + (rand() - 0.5) * r;

  // Primary perimeter path with organic bowed edges
  return `M ${x1} ${y1} ` +
    `Q ${(x1 + x2) / 2} ${(y1 + y2) / 2 + (rand() - 0.5) * r} ${x2} ${y2} ` +
    `Q ${(x2 + x3) / 2 + (rand() - 0.5) * r} ${(y2 + y3) / 2} ${x3} ${y3} ` +
    `Q ${(x3 + x4) / 2} ${(y3 + y4) / 2 + (rand() - 0.5) * r} ${x4} ${y4} ` +
    `Q ${(x4 + x1) / 2 + (rand() - 0.5) * r} ${(y4 + y1) / 2} ${x1} ${y1} Z`;
}

/**
 * Generate a deterministic hand-drawn diamond path.
 */
export function getSketchDiamondPath(
  width: number,
  height: number,
  seed: number | string = 1,
  roughness = 1.5
): string {
  const numSeed = typeof seed === 'string' ? stringToSeed(seed) : seed;
  const rand = createSeededRandom(numSeed);
  const r = roughness;

  const topX = width / 2 + (rand() - 0.5) * r;
  const topY = 2 + (rand() - 0.5) * r;

  const rightX = width - 2 + (rand() - 0.5) * r;
  const rightY = height / 2 + (rand() - 0.5) * r;

  const bottomX = width / 2 + (rand() - 0.5) * r;
  const bottomY = height - 2 + (rand() - 0.5) * r;

  const leftX = 2 + (rand() - 0.5) * r;
  const leftY = height / 2 + (rand() - 0.5) * r;

  return `M ${topX} ${topY} ` +
    `Q ${(topX + rightX) / 2 + (rand() - 0.5) * r} ${(topY + rightY) / 2} ${rightX} ${rightY} ` +
    `Q ${(rightX + bottomX) / 2} ${(rightY + bottomY) / 2 + (rand() - 0.5) * r} ${bottomX} ${bottomY} ` +
    `Q ${(bottomX + leftX) / 2 + (rand() - 0.5) * r} ${(bottomY + leftY) / 2} ${leftX} ${leftY} ` +
    `Q ${(leftX + topX) / 2} ${(leftY + topY) / 2 + (rand() - 0.5) * r} ${topX} ${topY} Z`;
}

/**
 * Generate a deterministic hand-drawn ellipse path.
 */
export function getSketchCirclePath(
  width: number,
  height: number,
  seed: number | string = 1,
  roughness = 1.5
): string {
  const numSeed = typeof seed === 'string' ? stringToSeed(seed) : seed;
  const rand = createSeededRandom(numSeed);
  const r = roughness;

  const cx = width / 2;
  const cy = height / 2;
  const rx = Math.max(1, width / 2 - 2);
  const ry = Math.max(1, height / 2 - 2);

  // 4 cardinal control points with organic perturbation
  const pTop = { x: cx + (rand() - 0.5) * r, y: cy - ry + (rand() - 0.5) * r };
  const pRight = { x: cx + rx + (rand() - 0.5) * r, y: cy + (rand() - 0.5) * r };
  const pBottom = { x: cx + (rand() - 0.5) * r, y: cy + ry + (rand() - 0.5) * r };
  const pLeft = { x: cx - rx + (rand() - 0.5) * r, y: cy + (rand() - 0.5) * r };

  const kx = 0.5522847498 * rx;
  const ky = 0.5522847498 * ry;

  return (
    `M ${pTop.x} ${pTop.y} ` +
    `C ${pTop.x + kx} ${pTop.y} ${pRight.x} ${pRight.y - ky} ${pRight.x} ${pRight.y} ` +
    `C ${pRight.x} ${pRight.y + ky} ${pBottom.x + kx} ${pBottom.y} ${pBottom.x} ${pBottom.y} ` +
    `C ${pBottom.x - kx} ${pBottom.y} ${pLeft.x} ${pLeft.y + ky} ${pLeft.x} ${pLeft.y} ` +
    `C ${pLeft.x} ${pLeft.y - ky} ${pTop.x - kx} ${pTop.y} ${pTop.x} ${pTop.y} Z`
  );
}

/**
 * Generate a deterministic hand-drawn triangle path.
 */
export function getSketchTrianglePath(
  width: number,
  height: number,
  seed: number | string = 1,
  roughness = 1.5
): string {
  const numSeed = typeof seed === 'string' ? stringToSeed(seed) : seed;
  const rand = createSeededRandom(numSeed);
  const r = roughness;

  const p1 = { x: width / 2 + (rand() - 0.5) * r, y: 2 + (rand() - 0.5) * r };
  const p2 = { x: width - 2 + (rand() - 0.5) * r, y: height - 2 + (rand() - 0.5) * r };
  const p3 = { x: 2 + (rand() - 0.5) * r, y: height - 2 + (rand() - 0.5) * r };

  return (
    `M ${p1.x} ${p1.y} ` +
    `Q ${(p1.x + p2.x) / 2 + (rand() - 0.5) * r} ${(p1.y + p2.y) / 2 + (rand() - 0.5) * r} ${p2.x} ${p2.y} ` +
    `Q ${(p2.x + p3.x) / 2 + (rand() - 0.5) * r} ${(p2.y + p3.y) / 2 + (rand() - 0.5) * r} ${p3.x} ${p3.y} ` +
    `Q ${(p3.x + p1.x) / 2 + (rand() - 0.5) * r} ${(p3.y + p1.y) / 2 + (rand() - 0.5) * r} ${p1.x} ${p1.y} Z`
  );
}

/**
 * Perturbs an existing path slightly for organic hand-drawn connector sloppiness.
 */
export function getSketchEdgePath(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  seed: number | string = 1,
  roughness = 1.5
): string {
  if (roughness <= 0.1) {
    return `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y}`;
  }
  return getSketchLinePath(p1.x, p1.y, p2.x, p2.y, seed, roughness);
}

