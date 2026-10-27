'use client';

import React from 'react';
import { ZCanvasNode } from '../core/schema';
import {
  getStrokeDashArray,
  resolveNodeFill,
  resolveNodeStroke,
} from '../core/style-models';
import {
  getRoundedPolygonPath,
  diamondVertices,
  triangleVertices,
} from '../rendering/shapes/polygon';
import {
  getSketchDiamondPath,
  getSketchCirclePath,
  getSketchTrianglePath,
} from '../rendering/sketch/rough-svg';
import {
  getActorPaths,
  getCalloutPath,
  getCloudPath,
  getCubePaths,
  getCylinderPaths,
  getDocumentPath,
  getHexagonPath,
  getInternalStoragePaths,
  getParallelogramPath,
  getRoundedRectPath,
  getStarPath,
  getStepPath,
  getSubroutinePaths,
  getTrapezoidPath,
} from '../geometry/shape-paths';
import { SHAPE_INSET } from '../rendering/shapes/polygon';

/** Shapes drawn purely as SVG geometry (the rectangle is an HTML card-like box). */
export type ZCanvasSvgShapeType =
  | 'circle'
  | 'diamond'
  | 'triangle'
  | 'cylinder'
  | 'cloud'
  | 'document'
  | 'parallelogram'
  | 'hexagon'
  | 'subroutine'
  | 'rounded-rectangle'
  | 'actor'
  | 'cube'
  | 'step'
  | 'callout'
  | 'trapezoid'
  | 'internal-storage'
  | 'star';

/**
 * Border + fill geometry for the SVG-backed geometric shapes.
 *
 * Honours the node's border colour, width and dash style so the shape style
 * panel behaves identically across every shape tool.
 */
export function ZCanvasShapeGeometry({
  node,
  isDark,
  sketch,
}: {
  node: ZCanvasNode;
  isDark: boolean;
  sketch: boolean;
}) {
  const type = node.type as ZCanvasSvgShapeType;
  const strokeWidth = node.strokeWidth || 2;
  const stroke = node.color || resolveNodeStroke(type, isDark);
  const fill = resolveNodeFill(type, isDark, node.fill, node.fillOpacity);
  const dash = getStrokeDashArray(node.strokeStyle, strokeWidth);
  const inset = SHAPE_INSET;
  const roughness = node.roughness ?? (sketch ? 1.5 : 0);

  const shared = {
    fill,
    stroke,
    strokeWidth,
    strokeLinejoin: 'round' as const,
    strokeLinecap: 'round' as const,
    strokeDasharray: dash,
  };

  if (sketch || roughness > 0) {
    if (type === 'diamond') {
      return (
        <path
          d={getSketchDiamondPath(node.width, node.height, node.seed || node.id, roughness || 1.8)}
          {...shared}
        />
      );
    }
    if (type === 'circle') {
      return (
        <path
          d={getSketchCirclePath(node.width, node.height, node.seed || node.id, roughness || 1.6)}
          {...shared}
        />
      );
    }
    if (type === 'triangle') {
      return (
        <path
          d={getSketchTrianglePath(node.width, node.height, node.seed || node.id, roughness || 1.8)}
          {...shared}
        />
      );
    }
  }

  switch (type) {
    case 'circle':
      return (
        <ellipse
          cx={node.width / 2}
          cy={node.height / 2}
          rx={Math.max(1, node.width / 2 - inset)}
          ry={Math.max(1, node.height / 2 - inset)}
          {...shared}
        />
      );

    case 'triangle':
      return (
        <path
          d={getRoundedPolygonPath(triangleVertices(node.width, node.height, inset))}
          {...shared}
        />
      );

    case 'cylinder': {
      const { bodyPath, rx, ry, cx, topY } = getCylinderPaths(node.width, node.height, inset);
      return (
        <g>
          {/* Main drum body */}
          <path d={bodyPath} {...shared} />
          {/* Top rim inner divider */}
          <ellipse
            cx={cx}
            cy={topY}
            rx={rx}
            ry={ry}
            fill="none"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeDasharray={dash}
          />
        </g>
      );
    }

    case 'cloud':
      return (
        <path
          d={getCloudPath(node.width, node.height, inset)}
          {...shared}
        />
      );

    case 'document':
      return (
        <path
          d={getDocumentPath(node.width, node.height, inset)}
          {...shared}
        />
      );

    case 'parallelogram':
      return (
        <path
          d={getParallelogramPath(node.width, node.height, inset)}
          {...shared}
        />
      );

    case 'hexagon':
      return (
        <path
          d={getHexagonPath(node.width, node.height, inset)}
          {...shared}
        />
      );

    case 'subroutine': {
      const { outerPath, leftLinePath, rightLinePath } = getSubroutinePaths(
        node.width,
        node.height,
        inset
      );
      return (
        <g>
          <path d={outerPath} {...shared} />
          <path
            d={leftLinePath}
            fill="none"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeDasharray={dash}
          />
          <path
            d={rightLinePath}
            fill="none"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeDasharray={dash}
          />
        </g>
      );
    }

    case 'rounded-rectangle':
      return (
        <path
          d={getRoundedRectPath(node.width, node.height, 12, inset)}
          {...shared}
        />
      );

    case 'actor': {
      const { head, bodyPath } = getActorPaths(node.width, node.height, inset);
      return (
        <g>
          <circle
            cx={head.cx}
            cy={head.cy}
            r={head.r}
            {...shared}
          />
          <path
            d={bodyPath}
            fill="none"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeDasharray={dash}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </g>
      );
    }

    case 'cube': {
      const { outerPath, innerPaths } = getCubePaths(node.width, node.height, inset);
      return (
        <g>
          <path d={outerPath} {...shared} />
          <path
            d={innerPaths}
            fill="none"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeDasharray={dash}
            strokeLinejoin="round"
          />
        </g>
      );
    }

    case 'step':
      return (
        <path
          d={getStepPath(node.width, node.height, inset)}
          {...shared}
        />
      );

    case 'callout':
      return (
        <path
          d={getCalloutPath(node.width, node.height, inset)}
          {...shared}
        />
      );

    case 'trapezoid':
      return (
        <path
          d={getTrapezoidPath(node.width, node.height, inset)}
          {...shared}
        />
      );

    case 'internal-storage': {
      const { outerPath, headerLine, sideLine } = getInternalStoragePaths(
        node.width,
        node.height,
        inset
      );
      return (
        <g>
          <path d={outerPath} {...shared} />
          <path
            d={headerLine}
            fill="none"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeDasharray={dash}
          />
          <path
            d={sideLine}
            fill="none"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeDasharray={dash}
          />
        </g>
      );
    }

    case 'star':
      return (
        <path
          d={getStarPath(node.width, node.height, inset)}
          {...shared}
        />
      );

    case 'diamond':
    default:
      return (
        <path
          d={getRoundedPolygonPath(diamondVertices(node.width, node.height, inset))}
          {...shared}
        />
      );
  }
}

export default ZCanvasShapeGeometry;
