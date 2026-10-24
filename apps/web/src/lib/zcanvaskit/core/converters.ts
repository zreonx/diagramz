import type { ZCanvasDocument, ZCanvasNode, ZCanvasEdge } from '../core/schema';

export function normalizeToZCanvasDocument(raw: unknown): ZCanvasDocument {
  const defaultDoc: ZCanvasDocument = {
    version: 1,
    nodes: [],
    edges: [],
    strokes: [],
    viewport: { zoom: 1, panX: 40, panY: 40 },
  };

  if (!raw || typeof raw !== 'object') {
    return defaultDoc;
  }

  const obj = raw as Record<string, any>;

  // Check if it already has nodes + edges format
  if (Array.isArray(obj.nodes) && Array.isArray(obj.edges)) {
    const seenNodeIds = new Set<string>();
    const uniqueNodes: ZCanvasNode[] = [];
    for (const node of obj.nodes) {
      if (node && node.id && !seenNodeIds.has(node.id)) {
        seenNodeIds.add(node.id);
        uniqueNodes.push(node);
      }
    }

    const seenEdgeIds = new Set<string>();
    const uniqueEdges: ZCanvasEdge[] = [];
    for (const edge of obj.edges) {
      if (edge && edge.id && !seenEdgeIds.has(edge.id)) {
        seenEdgeIds.add(edge.id);
        uniqueEdges.push(edge);
      }
    }

    return {
      version: 1,
      nodes: uniqueNodes,
      edges: uniqueEdges,
      strokes: Array.isArray(obj.strokes) ? obj.strokes : [],
      viewport: obj.viewport || { zoom: 1, panX: 40, panY: 40 },
    };
  }

  // Convert from legacy Eraser/Diagramz format (entities + connections)
  if (Array.isArray(obj.entities)) {
    const nodes: ZCanvasNode[] = obj.entities.map((entity: any) => {
      let type: ZCanvasNode['type'] = 'card';
      if (entity.tag === 'DatabaseTable') type = 'table';
      else if (entity.tag === 'GroupBoundary') type = 'container';
      else if (
        entity.type === 'rectangle' ||
        entity.type === 'circle' ||
        entity.type === 'diamond' ||
        entity.type === 'triangle' ||
        entity.type === 'text'
      ) {
        type = entity.type;
      }

      return {
        id: entity.id,
        type,
        x: entity.x || 0,
        y: entity.y || 0,
        width: entity.width || (type === 'container' ? 400 : 200),
        height: entity.height || (type === 'container' ? 300 : 80),
        title: entity.label || entity.title || 'Node',
        subtitle: entity.subtitle,
        badge: entity.badge,
        icon: entity.icon,
        description: entity.description,
        fields: entity.columns || entity.fields || [],
        color: entity.style?.stroke || entity.color || '#3b82f6',
        fill: entity.style?.fill || entity.fill || 'transparent',
        parentId: entity.parentId,
        data: entity.data || (entity.stencilId || entity.techLogo ? {
          stencilId: entity.stencilId,
          techLogoId: entity.techLogo,
          archId: entity.stencilId,
        } : undefined),
      };
    });

    const edges: ZCanvasEdge[] = (Array.isArray(obj.connections) ? obj.connections : []).map(
      (conn: any, i: number) => ({
        id: conn.id || `edge-${i}`,
        source: conn.from || conn.source,
        target: conn.to || conn.target,
        sourceHandle: conn.sourceHandle || 'right',
        targetHandle: conn.targetHandle || 'left',
        ...(conn.sourceOffset !== undefined ? { sourceOffset: conn.sourceOffset } : {}),
        ...(conn.targetOffset !== undefined ? { targetOffset: conn.targetOffset } : {}),
        ...(conn.startArrowhead ? { startArrowhead: conn.startArrowhead } : {}),
        ...(conn.endArrowhead ? { endArrowhead: conn.endArrowhead } : {}),
        label: conn.label,
        color: conn.color || '#3b82f6',
        style: conn.style === 'step' || conn.style === 'straight' ? conn.style : 'bezier',
      })
    );

    return {
      version: 1,
      nodes,
      edges,
      strokes: [],
      viewport: { zoom: 1, panX: 40, panY: 40 },
    };
  }

  return defaultDoc;
}

export function exportZCanvasToStorage(doc: ZCanvasDocument) {
  return {
    version: 1,
    nodes: doc.nodes,
    edges: doc.edges,
    strokes: doc.strokes,
    viewport: doc.viewport,
  };
}
