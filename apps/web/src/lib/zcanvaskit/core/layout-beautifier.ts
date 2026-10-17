import type { ZCanvasNode, ZCanvasEdge } from './schema';
import { getHandlePoint } from '../geometry/index';

export interface LayoutBeautifierOptions {
  /** Minimum horizontal gap between nodes in the same row. Default 160px. */
  minHorizontalGap?: number;
  /** Minimum vertical gap between distinct rows/tiers. Default 170px. */
  minVerticalGap?: number;
  /** Padding inside containers around child nodes. Default 55px. */
  containerPadding?: number;
  /** Container top header clearance for the container label. Default 65px. */
  containerHeaderHeight?: number;
  /** Gap between adjacent sibling containers. Default 80px. */
  containerGap?: number;
  /** Starting horizontal origin for the layout. Default 40px. */
  baseOffsetX?: number;
  /** Starting vertical origin for the layout. Default 40px. */
  baseOffsetY?: number;
}

/**
 * Normalizes and beautifies architecture diagram layouts so all nodes,
 * labels, edge label pills, containers, and tiers have professional
 * positioning, column alignment, connectivity-based placement, and generous spacing.
 */
export function beautifyArchitectureLayout(
  rawNodes: ZCanvasNode[],
  rawEdges: ZCanvasEdge[],
  options: LayoutBeautifierOptions = {}
): { nodes: ZCanvasNode[]; edges: ZCanvasEdge[] } {
  const {
    minHorizontalGap = 160,
    minVerticalGap = 170,
    containerPadding = 55,
    containerHeaderHeight = 65,
    containerGap = 80,
    baseOffsetX = 40,
    baseOffsetY = 40,
  } = options;

  if (!rawNodes || rawNodes.length === 0) {
    return { nodes: rawNodes, edges: rawEdges };
  }

  // 1. Separate containers and content nodes
  const allContainers = rawNodes.filter((n) => n.type === 'container' || n.type === 'frame');
  const contentNodes = rawNodes.filter((n) => n.type !== 'container' && n.type !== 'frame');

  if (contentNodes.length === 0) {
    return { nodes: rawNodes, edges: rawEdges };
  }

  // Build edge lookup & connectivity maps
  const edgeLabelLengthMap = new Map<string, number>();
  const incomingMap = new Map<string, string[]>();
  const outgoingMap = new Map<string, string[]>();
  const neighborsMap = new Map<string, string[]>();

  for (const edge of rawEdges || []) {
    const key = `${edge.source}->${edge.target}`;
    if (edge.label) {
      edgeLabelLengthMap.set(key, edge.label.length);
    }

    if (!outgoingMap.has(edge.source)) outgoingMap.set(edge.source, []);
    outgoingMap.get(edge.source)!.push(edge.target);

    if (!incomingMap.has(edge.target)) incomingMap.set(edge.target, []);
    incomingMap.get(edge.target)!.push(edge.source);

    if (!neighborsMap.has(edge.source)) neighborsMap.set(edge.source, []);
    neighborsMap.get(edge.source)!.push(edge.target);
    if (!neighborsMap.has(edge.target)) neighborsMap.set(edge.target, []);
    neighborsMap.get(edge.target)!.push(edge.source);
  }

  // 2. Filter out phantom empty containers and infer parentage when omitted
  // If content nodes have no parentId:
  // - If exactly 1 container/frame exists, all content nodes belong to it.
  // - If multiple exist, match nodes by geometric proximity.
  const explicitContainers = allContainers.filter((c) => c.type === 'container');
  const frameContainers = allContainers.filter((c) => c.type === 'frame');

  for (const node of contentNodes) {
    if (!node.parentId) {
      if (explicitContainers.length === 1) {
        node.parentId = explicitContainers[0].id;
      } else if (allContainers.length === 1) {
        node.parentId = allContainers[0].id;
      } else if (explicitContainers.length > 1) {
        const nodeCenterX = (node.x ?? 0) + (node.width ?? 90) / 2;
        const nodeCenterY = (node.y ?? 0) + (node.height ?? 90) / 2;

        let best: ZCanvasNode | null = null;
        let bestDist = Infinity;
        for (const c of explicitContainers) {
          const cLeft = c.x ?? 0;
          const cTop = c.y ?? 0;
          const cRight = cLeft + (c.width ?? 400);
          const cBottom = cTop + (c.height ?? 300);

          if (
            nodeCenterX >= cLeft - 50 &&
            nodeCenterX <= cRight + 50 &&
            nodeCenterY >= cTop - 50 &&
            nodeCenterY <= cBottom + 50
          ) {
            best = c;
            break;
          }
          const dist = Math.hypot(nodeCenterX - (cLeft + (c.width ?? 400) / 2), nodeCenterY - (cTop + (c.height ?? 300) / 2));
          if (dist < bestDist) {
            bestDist = dist;
            best = c;
          }
        }
        if (best) node.parentId = best.id;
      } else if (frameContainers.length === 1) {
        node.parentId = frameContainers[0].id;
      }
    }
  }

  const containerChildCount = new Map<string, number>();
  for (const node of contentNodes) {
    if (node.parentId) {
      containerChildCount.set(node.parentId, (containerChildCount.get(node.parentId) || 0) + 1);
    }
  }
  for (const c of allContainers) {
    if (c.parentId) {
      containerChildCount.set(c.parentId, (containerChildCount.get(c.parentId) || 0) + 1);
    }
  }

  const validContainers = allContainers.filter(
    (c) => (containerChildCount.get(c.id) || 0) > 0 || allContainers.length === 1 || c.type === 'frame'
  );

  // Group content nodes by container parentId
  const nodesByParent = new Map<string | undefined, ZCanvasNode[]>();
  for (const node of contentNodes) {
    const pId = node.parentId && validContainers.some((c) => c.id === node.parentId) ? node.parentId : undefined;
    if (!nodesByParent.has(pId)) {
      nodesByParent.set(pId, []);
    }
    nodesByParent.get(pId)!.push({ ...node, parentId: pId });
  }

  // 3. Layout content nodes inside each group
  const updatedContentNodes: ZCanvasNode[] = [];
  const assignedCenters = new Map<string, number>(); // node.id -> center X

  // Sort groups: uncontained first or in order of container X
  const sortedParentKeys = Array.from(nodesByParent.keys()).sort((a, b) => {
    const cA = validContainers.find((c) => c.id === a);
    const cB = validContainers.find((c) => c.id === b);
    const xA = cA ? (cA.x ?? 40) : (nodesByParent.get(a)?.[0]?.x ?? 40);
    const xB = cB ? (cB.x ?? 40) : (nodesByParent.get(b)?.[0]?.x ?? 40);
    return xA - xB;
  });

  // Track the rightmost edge of placed containers to prevent container overlap
  let currentContainerX = baseOffsetX;

  for (const parentId of sortedParentKeys) {
    const group = nodesByParent.get(parentId)!;
    if (group.length === 0) continue;

    // Cluster nodes in this group into rows based on original Y (tolerance 70px)
    const sortedByY = [...group].sort((a, b) => (a.y ?? 0) - (b.y ?? 0));
    const rows: ZCanvasNode[][] = [];

    for (const node of sortedByY) {
      const nodeY = node.y ?? 0;
      let placedInRow = false;

      for (const row of rows) {
        const avgY = row.reduce((sum, n) => sum + (n.y ?? 0), 0) / row.length;
        if (Math.abs(nodeY - avgY) < 70) {
          row.push(node);
          placedInRow = true;
          break;
        }
      }

      if (!placedInRow) {
        rows.push([node]);
      }
    }

    // Sort rows top-to-bottom
    rows.sort((rA, rB) => {
      const avgYA = rA.reduce((sum, n) => sum + (n.y ?? 0), 0) / rA.length;
      const avgYB = rB.reduce((sum, n) => sum + (n.y ?? 0), 0) / rB.length;
      return avgYA - avgYB;
    });

    // Anchor X and Y for this group
    const baseOriginX = parentId ? currentContainerX + containerPadding : (group[0]?.x ?? currentContainerX);
    const baseOriginY = parentId
      ? baseOffsetY + containerHeaderHeight
      : (group.length > 0 ? Math.min(...group.map((n) => n.y ?? 80)) : 80);

    let currentY = baseOriginY;

    // First pass: lay out rows with connectivity-based column positioning
    const groupPlacedNodes: ZCanvasNode[] = [];

    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      let maxRowHeight = 90;

      // Calculate ideal center X for each node in this row:
      // If node has connected neighbors in already placed rows/nodes, use average center of neighbors
      const nodeTargets: { node: ZCanvasNode; idealCenterX: number }[] = [];

      for (const node of row) {
        const width = node.width ?? (node.type === 'table' ? 260 : node.type === 'text' ? 200 : node.type === 'rectangle' || node.type === 'circle' || node.type === 'diamond' ? 140 : 90);
        const height = node.height ?? (node.type === 'table' ? (node.fields?.length ? 44 + node.fields.length * 28 + 20 : 180) : node.type === 'text' ? 36 : node.type === 'rectangle' || node.type === 'circle' || node.type === 'diamond' ? 80 : 90);
        maxRowHeight = Math.max(maxRowHeight, height);

        // Check connected neighbors with assigned positions
        const neighbors = neighborsMap.get(node.id) || [];
        const incoming = incomingMap.get(node.id) || [];
        const outgoing = outgoingMap.get(node.id) || [];

        const placedNeighborCenters: number[] = [];
        for (const nId of neighbors) {
          if (assignedCenters.has(nId)) {
            const neighborNode = groupPlacedNodes.find((n) => n.id === nId) || group.find((n) => n.id === nId);
            // Leaf downstream components (e.g. databases placed to the left or under their caller) align under their caller
            const isDownstreamLeaf =
              incoming.includes(nId) &&
              outgoing.length === 0 &&
              (node.x ?? 0) <= (neighborNode ? (neighborNode.x ?? 0) + 60 : 0);
            const isSimilarColumn = neighborNode && Math.abs((node.x ?? 0) - (neighborNode.x ?? 0)) < 140;

            if (isDownstreamLeaf || isSimilarColumn) {
              placedNeighborCenters.push(assignedCenters.get(nId)!);
            }
          }
        }

        let idealCenterX: number;
        if (placedNeighborCenters.length > 0) {
          // Barycenter of placed neighbors
          idealCenterX =
            placedNeighborCenters.reduce((sum, c) => sum + c, 0) / placedNeighborCenters.length;
        } else {
          // Relative original X offset from base
          const minGroupX = Math.min(...group.map((n) => n.x ?? 0));
          idealCenterX = baseOriginX + ((node.x ?? 0) - minGroupX) + width / 2;
        }

        nodeTargets.push({ node, idealCenterX });
      }

      // Sort row by ideal center X (preserving relative left-to-right order)
      nodeTargets.sort((a, b) => a.idealCenterX - b.idealCenterX);

      // Forward sweep: place nodes ensuring no overlap and minHorizontalGap
      let currentMinX = baseOriginX;
      for (let i = 0; i < nodeTargets.length; i++) {
        const { node, idealCenterX } = nodeTargets[i];
        const width = node.width ?? (node.type === 'table' ? 260 : node.type === 'text' ? 200 : node.type === 'rectangle' || node.type === 'circle' || node.type === 'diamond' ? 140 : 90);
        const height = node.height ?? (node.type === 'table' ? (node.fields?.length ? 44 + node.fields.length * 28 + 20 : 180) : node.type === 'text' ? 36 : node.type === 'rectangle' || node.type === 'circle' || node.type === 'diamond' ? 80 : 90);

        let hGap = minHorizontalGap;
        if (i > 0) {
          const prevNode = nodeTargets[i - 1].node;
          const edgeKey1 = `${prevNode.id}->${node.id}`;
          const edgeKey2 = `${node.id}->${prevNode.id}`;
          const labelLen = Math.max(
            edgeLabelLengthMap.get(edgeKey1) || 0,
            edgeLabelLengthMap.get(edgeKey2) || 0
          );
          if (labelLen > 14) {
            hGap = Math.max(hGap, labelLen * 7 + 80);
          }
        }

        const desiredLeft = Math.round(idealCenterX - width / 2);
        const actualX = i === 0 ? Math.max(baseOriginX, desiredLeft) : Math.max(currentMinX + hGap, desiredLeft);

        const placedNode: ZCanvasNode = {
          ...node,
          x: actualX,
          y: currentY,
          width,
          height,
        };

        const centerX = actualX + width / 2;
        assignedCenters.set(node.id, centerX);
        groupPlacedNodes.push(placedNode);

        currentMinX = actualX + width;
      }

      currentY += maxRowHeight + minVerticalGap;
    }

    // Second pass: Centering single-parent hubs over multi-child rows
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      if (row.length === 1) {
        const singleNode = groupPlacedNodes.find((n) => n.id === row[0].id);
        if (singleNode) {
          const outgoing = outgoingMap.get(singleNode.id) || [];
          const childCenters = outgoing
            .map((cId) => assignedCenters.get(cId))
            .filter((c): c is number => c !== undefined);

          if (childCenters.length >= 2) {
            const avgChildCenter = childCenters.reduce((s, c) => s + c, 0) / childCenters.length;
            const newX = Math.max(baseOriginX, Math.round(avgChildCenter - singleNode.width / 2));
            singleNode.x = newX;
            assignedCenters.set(singleNode.id, newX + singleNode.width / 2);
          }
        }
      }
    }

    updatedContentNodes.push(...groupPlacedNodes);

    // Compute bounding width of this group to advance currentContainerX for subsequent containers
    const groupMinX = Math.min(...groupPlacedNodes.map((n) => n.x));
    const groupMaxX = Math.max(...groupPlacedNodes.map((n) => n.x + n.width));
    const containerSpan = Math.max(240, (groupMaxX - groupMinX) + containerPadding * 2);
    currentContainerX = (groupMinX - containerPadding) + containerSpan + containerGap;
  }

  // 4. Update container boundaries to enclose their children with generous margins
  // First, process regular containers (e.g. subnets/VPCs)
  const regularContainers = validContainers.filter((c) => c.type !== 'frame');
  const frames = validContainers.filter((c) => c.type === 'frame');

  const updatedRegularContainers = regularContainers.map((container) => {
    const children = updatedContentNodes.filter((n) => n.parentId === container.id);
    if (children.length === 0) {
      return container;
    }

    const minX = Math.min(...children.map((c) => c.x));
    const maxX = Math.max(...children.map((c) => c.x + c.width));
    const minY = Math.min(...children.map((c) => c.y));
    const maxY = Math.max(...children.map((c) => c.y + c.height));

    const newX = Math.max(20, minX - containerPadding);
    const newY = Math.max(20, minY - containerHeaderHeight);
    const newWidth = Math.max(240, maxX - minX + containerPadding * 2);
    const newHeight = Math.max(180, (maxY - minY) + containerHeaderHeight + containerPadding);

    return {
      ...container,
      x: newX,
      y: newY,
      width: newWidth,
      height: newHeight,
    };
  });

  // Then process frames: frames match their content (either direct children or all enclosed/sibling nodes)
  const updatedFrames = frames.map((frame) => {
    let itemsToEnclose = updatedContentNodes.filter((n) => n.parentId === frame.id);

    // If frame has no direct children by parentId, or if it represents the whole architecture frame:
    if (itemsToEnclose.length === 0 || frames.length === 1) {
      // Enclose all nodes (or all nodes and containers)
      itemsToEnclose = [...updatedRegularContainers, ...updatedContentNodes];
    }

    if (itemsToEnclose.length === 0) {
      return frame;
    }

    const framePad = 36;
    const frameHeaderHeight = 44;

    const minX = Math.min(...itemsToEnclose.map((c) => c.x));
    const maxX = Math.max(...itemsToEnclose.map((c) => c.x + c.width));
    const minY = Math.min(...itemsToEnclose.map((c) => c.y));
    const maxY = Math.max(...itemsToEnclose.map((c) => c.y + c.height));

    const newX = Math.max(20, minX - framePad);
    const newY = Math.max(20, minY - frameHeaderHeight);
    const newWidth = Math.max(240, maxX - minX + framePad * 2);
    const newHeight = Math.max(160, (maxY - minY) + frameHeaderHeight + framePad);

    return {
      ...frame,
      x: newX,
      y: newY,
      width: newWidth,
      height: newHeight,
    };
  });

  const updatedContainers: ZCanvasNode[] = [...updatedRegularContainers, ...updatedFrames];

  // 5. Beautify and align edges with magnetic handle routing, bidirectional separation,
  // fan-out geometric port assignment, obstacle avoidance, and non-overlapping label placement.
  const nodeMap = new Map<string, ZCanvasNode>();
  for (const n of [...updatedContainers, ...updatedContentNodes]) {
    nodeMap.set(n.id, n);
  }

  // Pass 5.1: Initial optimal handle assignment based on geometry
  const edges: ZCanvasEdge[] = (rawEdges || []).map((edge) => {
    const src = nodeMap.get(edge.source);
    const tgt = nodeMap.get(edge.target);

    if (!src || !tgt) return { ...edge };

    const dx = (tgt.x + tgt.width / 2) - (src.x + src.width / 2);
    const dy = (tgt.y + tgt.height / 2) - (src.y + src.height / 2);

    let sourceHandle = edge.sourceHandle;
    let targetHandle = edge.targetHandle;

    if (Math.abs(dx) >= Math.abs(dy) * 0.7) {
      // Predominantly horizontal
      if (dx > 0) {
        sourceHandle = 'right';
        targetHandle = 'left';
      } else {
        sourceHandle = 'left';
        targetHandle = 'right';
      }
    } else {
      // Predominantly vertical
      if (dy > 0) {
        sourceHandle = 'bottom';
        targetHandle = 'top';
      } else {
        sourceHandle = 'top';
        targetHandle = 'bottom';
      }
    }

    return {
      ...edge,
      sourceHandle,
      targetHandle,
      style: edge.style || 'bezier',
    };
  });

  // Pass 5.2: Bidirectional and parallel edge separation.
  // When edges connect between the same pair of nodes (e.g. A -> B and B -> A),
  // route them on separate parallel tracks and stagger their labels on opposite sides
  // so neither the paths nor the label badges collide.
  const pairGroups = new Map<string, ZCanvasEdge[]>();
  for (const edge of edges) {
    const pairKey = [edge.source, edge.target].sort().join(':::');
    let group = pairGroups.get(pairKey);
    if (!group) {
      group = [];
      pairGroups.set(pairKey, group);
    }
    group.push(edge);
  }

  const processedPairEdges = new Set<string>();

  for (const pairEdges of pairGroups.values()) {
    if (pairEdges.length <= 1) continue;

    const first = pairEdges[0];
    const src = nodeMap.get(first.source);
    const tgt = nodeMap.get(first.target);
    if (!src || !tgt) continue;

    const dx = (tgt.x + tgt.width / 2) - (src.x + src.width / 2);
    const dy = (tgt.y + tgt.height / 2) - (src.y + src.height / 2);
    const isHorizontal = Math.abs(dx) >= Math.abs(dy) * 0.7;

    const count = pairEdges.length;
    const trackSpacing = 20;

    pairEdges.forEach((edge, idx) => {
      processedPairEdges.add(edge.id);
      const trackOffset = count === 2
        ? (idx === 0 ? -16 : 16)
        : Math.round((idx - (count - 1) / 2) * trackSpacing);

      edge.sourceOffset = trackOffset;
      edge.targetOffset = trackOffset;
      edge.stepOffset = trackOffset * 1.1;

      if (edge.label) {
        if (isHorizontal) {
          const labelY = trackOffset <= 0 ? -22 : 22;
          const labelX = (idx === 0 ? -20 : 20);
          edge.labelOffset = { x: labelX, y: labelY };
        } else {
          const labelX = trackOffset <= 0 ? -32 : 32;
          const labelY = (idx === 0 ? -18 : 18);
          edge.labelOffset = { x: labelX, y: labelY };
        }
      }
    });
  }

  // Pass 5.3: Geometric fan-out & fan-in port assignment for multi-connection handles.
  // Edges not in multi-edge pairs are geometrically ordered by their target/source positions
  // to guarantee lines leaving or entering the same side NEVER cross each other.
  const portGroups = new Map<string, Array<{ edge: ZCanvasEdge; isSource: boolean; otherId: string }>>();

  for (const edge of edges) {
    if (processedPairEdges.has(edge.id)) continue;

    if (edge.source && edge.sourceHandle && nodeMap.has(edge.source)) {
      const key = `${edge.source}:${edge.sourceHandle}`;
      if (!portGroups.has(key)) portGroups.set(key, []);
      portGroups.get(key)!.push({ edge, isSource: true, otherId: edge.target });
    }

    if (edge.target && edge.targetHandle && nodeMap.has(edge.target)) {
      const key = `${edge.target}:${edge.targetHandle}`;
      if (!portGroups.has(key)) portGroups.set(key, []);
      portGroups.get(key)!.push({ edge, isSource: false, otherId: edge.source });
    }
  }

  for (const [key, group] of portGroups.entries()) {
    if (group.length <= 1) continue;

    const [nodeId, handle] = key.split(':');
    const node = nodeMap.get(nodeId);
    if (!node) continue;

    const isHorizontalHandle = handle === 'left' || handle === 'right';

    // Sort edges geometrically by destination/source center coordinate
    group.sort((a, b) => {
      const otherA = nodeMap.get(a.otherId);
      const otherB = nodeMap.get(b.otherId);
      if (otherA && otherB) {
        if (isHorizontalHandle) {
          const yA = otherA.y + otherA.height / 2;
          const yB = otherB.y + otherB.height / 2;
          if (Math.abs(yA - yB) > 2) return yA - yB;
        } else {
          const xA = otherA.x + otherA.width / 2;
          const xB = otherB.x + otherB.width / 2;
          if (Math.abs(xA - xB) > 2) return xA - xB;
        }
      }
      return a.edge.id.localeCompare(b.edge.id);
    });

    const maxSpan = (isHorizontalHandle ? node.height : node.width) * 0.7;
    const SPACING = 20;
    const step = Math.min(SPACING, maxSpan / (group.length + 1));
    const startOffset = -((group.length - 1) * step) / 2;

    group.forEach((item, index) => {
      const offset = Math.round(startOffset + index * step);
      if (item.isSource) {
        item.edge.sourceOffset = offset;
      } else {
        item.edge.targetOffset = offset;
      }
    });
  }

  // Pass 5.4: Vertical line label clearance.
  // For vertical lines, labels positioned at midPoint bisect the line stroke.
  // Offset labels to the side (+34px) so the line doesn't slice through the text.
  for (const edge of edges) {
    if (!edge.label || edge.labelOffset) continue;
    const src = nodeMap.get(edge.source);
    const tgt = nodeMap.get(edge.target);
    if (!src || !tgt) continue;

    const dx = Math.abs((tgt.x + tgt.width / 2) - (src.x + src.width / 2));
    const dy = Math.abs((tgt.y + tgt.height / 2) - (src.y + src.height / 2));

    if (dy > dx * 1.2 || dx < 36) {
      edge.labelOffset = { x: 34, y: 0 };
    }
  }

  // Pass 5.5: Obstacle avoidance for edges skipping tiers.
  // If an edge spans across an intermediate node along the same row or column,
  // arc the edge over/around the obstacle with stepOffset so it never slices through it.
  for (const edge of edges) {
    if (processedPairEdges.has(edge.id) || edge.stepOffset) continue;
    const src = nodeMap.get(edge.source);
    const tgt = nodeMap.get(edge.target);
    if (!src || !tgt) continue;

    const minX = Math.min(src.x, tgt.x);
    const maxX = Math.max(src.x + src.width, tgt.x + tgt.width);
    const minY = Math.min(src.y, tgt.y);
    const maxY = Math.max(src.y + src.height, tgt.y + tgt.height);

    const isHorizontal = Math.abs((tgt.x + tgt.width / 2) - (src.x + src.width / 2)) >=
                         Math.abs((tgt.y + tgt.height / 2) - (src.y + src.height / 2)) * 0.7;

    for (const obs of updatedContentNodes) {
      if (obs.id === src.id || obs.id === tgt.id) continue;
      const obsCenterX = obs.x + obs.width / 2;
      const obsCenterY = obs.y + obs.height / 2;

      if (isHorizontal) {
        if (
          obsCenterX > minX &&
          obsCenterX < maxX &&
          Math.abs(obsCenterY - (src.y + src.height / 2)) < 50 &&
          Math.abs(obsCenterY - (tgt.y + tgt.height / 2)) < 50
        ) {
          edge.stepOffset = -55;
          if (edge.label && !edge.labelOffset) {
            edge.labelOffset = { x: 0, y: -22 };
          }
          break;
        }
      } else {
        if (
          obsCenterY > minY &&
          obsCenterY < maxY &&
          Math.abs(obsCenterX - (src.x + src.width / 2)) < 50 &&
          Math.abs(obsCenterX - (tgt.x + tgt.width / 2)) < 50
        ) {
          edge.stepOffset = 55;
          if (edge.label && !edge.labelOffset) {
            edge.labelOffset = { x: 32, y: 0 };
          }
          break;
        }
      }
    }
  }

  // Pass 5.6: Label-to-label collision detection and staggering.
  // Compute approximate label positions on canvas and resolve overlaps.
  const labeledEdges = edges.filter((e) => Boolean(e.label));
  if (labeledEdges.length > 1) {
    const getLabelBox = (e: ZCanvasEdge) => {
      const src = nodeMap.get(e.source);
      const tgt = nodeMap.get(e.target);
      if (!src || !tgt) return null;

      const p1 = getHandlePoint(src, e.sourceHandle || 'right', 0, e.sourceOffset || 0);
      const p2 = getHandlePoint(tgt, e.targetHandle || 'left', 0, e.targetOffset || 0);

      const midX = (p1.x + p2.x) / 2 + (e.sourceHandle === 'top' || e.sourceHandle === 'bottom' ? (e.stepOffset || 0) * 0.5 : 0);
      const midY = (p1.y + p2.y) / 2 + (e.sourceHandle === 'left' || e.sourceHandle === 'right' ? (e.stepOffset || 0) * 0.5 : 0);

      const lx = midX + (e.labelOffset?.x ?? 0);
      const ly = midY + (e.labelOffset?.y ?? 0);
      const lines = (e.label || '').split('\n');
      const maxL = Math.max(...lines.map((l) => l.length), 0);
      const width = Math.max(60, maxL * 8.5 + 24);
      const height = Math.max(28, lines.length * 16 + 10);

      return {
        edge: e,
        x: lx - width / 2,
        y: ly - height / 2,
        width,
        height,
        centerX: lx,
        centerY: ly,
      };
    };

    for (let iter = 0; iter < 3; iter++) {
      let collided = false;
      const boxes = labeledEdges.map(getLabelBox).filter(Boolean) as NonNullable<ReturnType<typeof getLabelBox>>[];

      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          const b1 = boxes[i];
          const b2 = boxes[j];

          const overlapX = Math.max(0, Math.min(b1.x + b1.width, b2.x + b2.width) - Math.max(b1.x, b2.x));
          const overlapY = Math.max(0, Math.min(b1.y + b1.height, b2.y + b2.height) - Math.max(b1.y, b2.y));

          if (overlapX > 0 && overlapY > 0) {
            collided = true;
            const currentOffset1 = b1.edge.labelOffset || { x: 0, y: 0 };
            const currentOffset2 = b2.edge.labelOffset || { x: 0, y: 0 };

            const dx = b2.centerX - b1.centerX;
            const dy = b2.centerY - b1.centerY;

            if (Math.abs(dx) >= Math.abs(dy)) {
              b1.edge.labelOffset = {
                x: currentOffset1.x - 36,
                y: currentOffset1.y - 14,
              };
              b2.edge.labelOffset = {
                x: currentOffset2.x + 36,
                y: currentOffset2.y + 14,
              };
            } else {
              b1.edge.labelOffset = {
                x: currentOffset1.x - 16,
                y: currentOffset1.y - 24,
              };
              b2.edge.labelOffset = {
                x: currentOffset2.x + 16,
                y: currentOffset2.y + 24,
              };
            }
          }
        }
      }

      if (!collided) break;
    }
  }

  return {
    nodes: [...updatedContainers, ...updatedContentNodes],
    edges,
  };
}

