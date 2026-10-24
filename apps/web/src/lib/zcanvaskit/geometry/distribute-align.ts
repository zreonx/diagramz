import type { ZCanvasNode } from '../core/schema';
import type { AlignmentDirection } from '../core/commands';

export type DistributionAxis = 'horizontal' | 'vertical';

/**
 * Aligns the selected nodes along the specified edge or center axis.
 * Keeps non-selected nodes completely untouched.
 */
export function alignNodes(
  nodes: ZCanvasNode[],
  selectedIds: string[],
  direction: AlignmentDirection
): ZCanvasNode[] {
  if (selectedIds.length < 2) return nodes;

  const targetSet = new Set(selectedIds);
  const targets = nodes.filter((n) => targetSet.has(n.id));
  if (targets.length < 2) return nodes;

  const minX = Math.min(...targets.map((n) => n.x));
  const maxX = Math.max(...targets.map((n) => n.x + n.width));
  const minY = Math.min(...targets.map((n) => n.y));
  const maxY = Math.max(...targets.map((n) => n.y + n.height));
  const centerX = Math.round((minX + maxX) / 2);
  const centerY = Math.round((minY + maxY) / 2);

  return nodes.map((node) => {
    if (!targetSet.has(node.id)) return node;

    switch (direction) {
      case 'left':
        return { ...node, x: minX };
      case 'center':
        return { ...node, x: Math.round(centerX - node.width / 2) };
      case 'right':
        return { ...node, x: maxX - node.width };
      case 'top':
        return { ...node, y: minY };
      case 'middle':
        return { ...node, y: Math.round(centerY - node.height / 2) };
      case 'bottom':
        return { ...node, y: maxY - node.height };
      default:
        return node;
    }
  });
}

/**
 * Distributes selected nodes with equal spacing between their outer boundaries.
 * Preserves the positions of the two extreme anchor nodes and evenly redistributes
 * the interior nodes along the selected axis.
 */
export function distributeNodes(
  nodes: ZCanvasNode[],
  selectedIds: string[],
  axis: DistributionAxis
): ZCanvasNode[] {
  if (selectedIds.length < 3) return nodes;

  const targetSet = new Set(selectedIds);
  const targets = nodes.filter((n) => targetSet.has(n.id));
  if (targets.length < 3) return nodes;

  if (axis === 'horizontal') {
    // Sort nodes left-to-right
    const sorted = [...targets].sort((a, b) => a.x - b.x);
    const first = sorted[0];
    const last = sorted[sorted.length - 1];

    const span = (last.x + last.width) - first.x;
    const totalItemWidths = sorted.reduce((sum, n) => sum + n.width, 0);
    const totalGaps = sorted.length - 1;
    const gap = (span - totalItemWidths) / totalGaps;

    let currentX = first.x;
    const posMap = new Map<string, number>();

    for (let i = 0; i < sorted.length; i++) {
      const node = sorted[i];
      posMap.set(node.id, Math.round(currentX));
      currentX += node.width + gap;
    }

    return nodes.map((node) => {
      const newX = posMap.get(node.id);
      return newX !== undefined ? { ...node, x: newX } : node;
    });
  } else {
    // Sort nodes top-to-bottom
    const sorted = [...targets].sort((a, b) => a.y - b.y);
    const first = sorted[0];
    const last = sorted[sorted.length - 1];

    const span = (last.y + last.height) - first.y;
    const totalItemHeights = sorted.reduce((sum, n) => sum + n.height, 0);
    const totalGaps = sorted.length - 1;
    const gap = (span - totalItemHeights) / totalGaps;

    let currentY = first.y;
    const posMap = new Map<string, number>();

    for (let i = 0; i < sorted.length; i++) {
      const node = sorted[i];
      posMap.set(node.id, Math.round(currentY));
      currentY += node.height + gap;
    }

    return nodes.map((node) => {
      const newY = posMap.get(node.id);
      return newY !== undefined ? { ...node, y: newY } : node;
    });
  }
}

/**
 * Figma-style "Tidy Up" smart layout:
 * Arranges selected nodes into an optimal balanced grid with uniform horizontal
 * and vertical spacing (defaulting to 40px gap).
 */
export function tidyUpNodes(
  nodes: ZCanvasNode[],
  selectedIds: string[],
  gap = 40
): ZCanvasNode[] {
  if (selectedIds.length < 2) return nodes;

  const targetSet = new Set(selectedIds);
  const targets = nodes.filter((n) => targetSet.has(n.id));
  if (targets.length < 2) return nodes;

  // Reading order: primarily row by row (y), then column by column (x)
  const sorted = [...targets].sort((a, b) => {
    const rowTolerance = 30;
    if (Math.abs(a.y - b.y) > rowTolerance) {
      return a.y - b.y;
    }
    return a.x - b.x;
  });

  const count = sorted.length;
  // Compute best grid dimensions
  const cols = count <= 3 ? count : Math.ceil(Math.sqrt(count));

  // Determine starting top-left anchor point
  const originX = Math.min(...targets.map((n) => n.x));
  const originY = Math.min(...targets.map((n) => n.y));

  // Calculate maximum cell widths and heights per column / row
  const colWidths = new Array(cols).fill(0);
  const rowHeights: number[] = [];

  sorted.forEach((node, idx) => {
    const c = idx % cols;
    const r = Math.floor(idx / cols);
    colWidths[c] = Math.max(colWidths[c], node.width);
    rowHeights[r] = Math.max(rowHeights[r] ?? 0, node.height);
  });

  const posMap = new Map<string, { x: number; y: number }>();

  sorted.forEach((node, idx) => {
    const c = idx % cols;
    const r = Math.floor(idx / cols);

    let x = originX;
    for (let i = 0; i < c; i++) {
      x += colWidths[i] + gap;
    }

    let y = originY;
    for (let j = 0; j < r; j++) {
      y += rowHeights[j] + gap;
    }

    posMap.set(node.id, { x: Math.round(x), y: Math.round(y) });
  });

  return nodes.map((node) => {
    const pos = posMap.get(node.id);
    return pos ? { ...node, x: pos.x, y: pos.y } : node;
  });
}
