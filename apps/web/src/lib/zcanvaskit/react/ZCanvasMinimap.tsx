'use client';

import React from 'react';
import { ZCanvasNode, ZCanvasViewport } from '../core/schema';

export interface ZCanvasMinimapProps {
  nodes: ZCanvasNode[];
  viewport: ZCanvasViewport;
  containerWidth?: number;
  containerHeight?: number;
}

export function ZCanvasMinimap({
  nodes,
  viewport,
  containerWidth = 1200,
  containerHeight = 800,
}: ZCanvasMinimapProps) {
  if (nodes.length === 0) return null;

  let minX = 0;
  let minY = 0;
  let maxX = 1200;
  let maxY = 800;

  nodes.forEach((n) => {
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + n.width);
    maxY = Math.max(maxY, n.y + n.height);
  });

  const width = Math.max(800, maxX - minX + 200);
  const height = Math.max(600, maxY - minY + 200);

  const mapW = 160;
  const mapH = 100;
  const scaleX = mapW / width;
  const scaleY = mapH / height;
  const scale = Math.min(scaleX, scaleY);

  const viewW = (containerWidth / viewport.zoom) * scale;
  const viewH = (containerHeight / viewport.zoom) * scale;
  const viewX = (-viewport.panX / viewport.zoom - minX) * scale;
  const viewY = (-viewport.panY / viewport.zoom - minY) * scale;

  return (
    <div className="absolute bottom-4 right-4 z-20 w-44 h-28 bg-background/90 backdrop-blur-md border border-border/80 shadow-xl rounded-xl p-1.5 overflow-hidden pointer-events-none select-none">
      <div className="relative w-full h-full bg-muted/30 rounded-lg overflow-hidden border border-border/30">
        <svg className="w-full h-full" viewBox={`0 0 ${width} ${height}`}>
          {nodes.map((node) => (
            <rect
              key={node.id}
              x={node.x - minX}
              y={node.y - minY}
              width={node.width}
              height={node.height}
              rx={6}
              fill={node.color || '#3b82f6'}
              opacity={0.6}
            />
          ))}
        </svg>

        {/* Viewport frame */}
        <div
          className="absolute border border-primary bg-primary/10 rounded pointer-events-none transition-all duration-75"
          style={{
            left: `${Math.max(0, viewX)}px`,
            top: `${Math.max(0, viewY)}px`,
            width: `${Math.min(mapW, viewW)}px`,
            height: `${Math.min(mapH, viewH)}px`,
          }}
        />
      </div>
    </div>
  );
}
