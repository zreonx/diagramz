import type {
  ZCanvasDocument,
  ZCanvasNode,
  ZCanvasEdge,
  ZCanvasDrawingStroke,
  ZCanvasPoint,
} from '../schema';
import { createGroupId } from '../grouping';

/**
 * The clipboard payload.
 *
 * Ink travels with the shapes it was drawn around: a pen stroke is an element
 * like any other, so copying a region copies what was drawn there, in the same
 * undo step and with the same offset.
 */
export interface ZCanvasClipboardPayload {
  nodes: ZCanvasNode[];
  edges: ZCanvasEdge[];
  strokes: ZCanvasDrawingStroke[];
}

let internalClipboard: ZCanvasClipboardPayload | null = null;

export function getInternalClipboard(): ZCanvasClipboardPayload | null {
  return internalClipboard;
}

export function setInternalClipboard(payload: ZCanvasClipboardPayload): void {
  internalClipboard = JSON.parse(JSON.stringify(payload));
}

/** The strokes a selection names, in the order they were drawn. */
function strokesFor(doc: ZCanvasDocument, selectedStrokeIds: string[]): ZCanvasDrawingStroke[] {
  if (selectedStrokeIds.length === 0) return [];
  const wanted = new Set(selectedStrokeIds);
  return doc.strokes.filter((stroke) => wanted.has(stroke.id));
}

export function copySelection(
  doc: ZCanvasDocument,
  selectedNodeIds: string[],
  selectedStrokeIds: string[] = []
): ZCanvasClipboardPayload | null {
  const strokes = strokesFor(doc, selectedStrokeIds);
  if (selectedNodeIds.length === 0 && strokes.length === 0) return null;

  const selectedSet = new Set(selectedNodeIds);
  const nodes = doc.nodes.filter((n) => selectedSet.has(n.id));
  // Only a connector whose *both* ends travelled can be pasted; one anchored to
  // a node left behind would arrive pointing at nothing.
  const edges = doc.edges.filter(
    (e) => selectedSet.has(e.source) && selectedSet.has(e.target)
  );

  const payload: ZCanvasClipboardPayload = {
    nodes: JSON.parse(JSON.stringify(nodes)),
    edges: JSON.parse(JSON.stringify(edges)),
    strokes: JSON.parse(JSON.stringify(strokes)),
  };
  setInternalClipboard(payload);
  return payload;
}

function uniqueId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function pasteClipboard(
  doc: ZCanvasDocument,
  offset = { x: 30, y: 30 }
): {
  newNodes: ZCanvasNode[];
  newEdges: ZCanvasEdge[];
  newStrokes: ZCanvasDrawingStroke[];
  pastedNodeIds: string[];
  pastedStrokeIds: string[];
} | null {
  const payload = internalClipboard;
  if (!payload) return null;
  if (payload.nodes.length === 0 && payload.strokes.length === 0) return null;

  const idMap = new Map<string, string>();
  // Copies join a group of their own. A pasted duplicate that kept the original
  // group's name would be selected along with it and move with it, so every
  // group in the payload is renamed once and the copies share that new name.
  const groupMap = new Map<string, string>();
  /** The names this paste has minted, so two source groups cannot share one. */
  const mintedGroups = new Set<string>();
  const pastedNodes: ZCanvasNode[] = payload.nodes.map((node) => {
    const newId = uniqueId(node.type || 'node');
    idMap.set(node.id, newId);
    const pasted: ZCanvasNode = {
      ...node,
      id: newId,
      x: node.x + offset.x,
      y: node.y + offset.y,
    };

    const groups = node.groupIds;
    if (groups && groups.length > 0) {
      pasted.groupIds = groups.map((group) => {
        const renamed = groupMap.get(group) ?? createGroupId(mintedGroups);
        groupMap.set(group, renamed);
        mintedGroups.add(renamed);
        return renamed;
      });
    } else {
      delete pasted.groupIds;
    }

    return pasted;
  });

  const pastedEdges: ZCanvasEdge[] = payload.edges
    .filter((e) => idMap.has(e.source) && idMap.has(e.target))
    .map((e) => ({
      ...e,
      id: uniqueId('edge'),
      source: idMap.get(e.source)!,
      target: idMap.get(e.target)!,
    }));

  const pastedStrokes: ZCanvasDrawingStroke[] = payload.strokes.map((stroke) => ({
    ...stroke,
    id: uniqueId('stroke'),
    points: stroke.points.map((point): ZCanvasPoint => ({
      x: point.x + offset.x,
      y: point.y + offset.y,
    })),
  }));

  return {
    newNodes: [...doc.nodes, ...pastedNodes],
    newEdges: [...doc.edges, ...pastedEdges],
    newStrokes: [...doc.strokes, ...pastedStrokes],
    pastedNodeIds: Array.from(idMap.values()),
    pastedStrokeIds: pastedStrokes.map((stroke) => stroke.id),
  };
}

export function duplicateSelection(
  doc: ZCanvasDocument,
  selectedNodeIds: string[],
  offset = { x: 40, y: 40 },
  selectedStrokeIds: string[] = []
): {
  newNodes: ZCanvasNode[];
  newEdges: ZCanvasEdge[];
  newStrokes: ZCanvasDrawingStroke[];
  duplicatedNodeIds: string[];
  duplicatedStrokeIds: string[];
} | null {
  const copied = copySelection(doc, selectedNodeIds, selectedStrokeIds);
  if (!copied) return null;

  const pasted = pasteClipboard(doc, offset);
  if (!pasted) return null;

  return {
    newNodes: pasted.newNodes,
    newEdges: pasted.newEdges,
    newStrokes: pasted.newStrokes,
    duplicatedNodeIds: pasted.pastedNodeIds,
    duplicatedStrokeIds: pasted.pastedStrokeIds,
  };
}
