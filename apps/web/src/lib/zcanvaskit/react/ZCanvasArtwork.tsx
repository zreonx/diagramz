'use client';

import React, { useMemo } from 'react';
import { BUILTIN_STENCIL_REGISTRY } from '../stencils/builtin';
import {
  isExcalidrawElementArray,
  renderElementArray,
  type ExcalidrawElementLike,
} from '../stencils/element-array';
import { stencilViewBox } from '../stencils/registry';
import type { StencilDefinition } from '../stencils/types';

/**
 * React adapters over the engine's markup renderers.
 *
 * A stencil draws itself to an SVG string, because that is the one form the
 * canvas, the library panel and the exporter can all consume. This module is
 * the canvas's half of that bargain: it puts the string into a live `<svg>`.
 *
 * `dangerouslySetInnerHTML` is doing real work here and the name is worth
 * taking seriously, so here is the argument for it being safe. The string comes
 * from `StencilDefinition.render`, whose input is a closed set — two numbers, a
 * boolean, and a colour the renderer is handed only after validation. It
 * receives no user text, so there is nothing in it that could have needed
 * escaping. Node labels are painted by the canvas as real React children
 * beside the artwork, not inside it.
 *
 * The one exception is {@link ZCanvasElementArrayGraphic}, which renders
 * persisted element arrays — user data. Its renderer escapes text as it builds
 * the markup, and validates colours against an allow-list. That is why the
 * escaping lives in the renderer rather than being assumed away here.
 */

/** Box the artwork is authored in, with the engine's default applied. */
function viewBoxAttr(definition: StencilDefinition): string {
  const box = stencilViewBox(definition);
  return `${box.x} ${box.y} ${box.width} ${box.height}`;
}

export interface ZCanvasStencilGraphicProps {
  /** Registry id of the stencil to draw. */
  id: string;
  /** Node width in canvas pixels. */
  width: number;
  /** Node height in canvas pixels. */
  height: number;
  isDark: boolean;
  className?: string;
  color?: string;
}

/**
 * Draws a registered stencil, or nothing at all if the id is unknown.
 *
 * An unknown id renders empty rather than a placeholder so a document that
 * references a stencil this build does not have degrades to the node's own
 * frame and label instead of to a broken image glyph.
 *
 * Scaling is left to `preserveAspectRatio`, which is the declarative spelling
 * of the same uniform-and-centred transform the exporter computes by hand.
 */
export function ZCanvasStencilGraphic({
  id,
  width,
  height,
  isDark,
  className,
  color,
}: ZCanvasStencilGraphicProps) {
  const definition = BUILTIN_STENCIL_REGISTRY.get(id);

  const markup = useMemo(
    () => (definition ? definition.render({ width, height, isDark, color }) : ''),
    [definition, width, height, isDark, color]
  );

  if (!definition || !markup) {
    const label = (id || 'Component').replace(/^(arch-|tech-)/, '');
    return (
      <div
        className="w-full h-full flex flex-col items-center justify-center p-2 rounded-xl border border-dashed border-primary/40 bg-primary/5 text-foreground select-none shadow-2xs"
        style={{ width, height }}
      >
        <svg
          viewBox="0 0 24 24"
          width={Math.min(width * 0.4, 32)}
          height={Math.min(height * 0.4, 32)}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-primary mb-1 shrink-0"
        >
          <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
          <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
          <line x1="6" y1="6" x2="6.01" y2="6" />
          <line x1="6" y1="18" x2="6.01" y2="18" />
        </svg>
        <span className="text-[10px] font-medium text-foreground/90 truncate max-w-full text-center px-1">
          {label}
        </span>
      </div>
    );
  }

  return (
    <svg
      viewBox={viewBoxAttr(definition)}
      preserveAspectRatio="xMidYMid meet"
      width={width}
      height={height}
      className={className}
      fill="none"
      style={{ overflow: 'visible' }}
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
}

export interface ZCanvasElementArrayGraphicProps {
  /** The persisted `data.elements` value; validated here, not by the caller. */
  elements: unknown;
  isDark: boolean;
  className?: string;
}

/**
 * Draws a raw Excalidraw element array, for diagrams saved before stencils
 * were part of the engine.
 *
 * Renders an empty box rather than nothing when the array is missing or
 * malformed, so a node keeps its footprint and the selection outline still has
 * something to sit around.
 */
export function ZCanvasElementArrayGraphic({
  elements,
  isDark,
  className,
}: ZCanvasElementArrayGraphicProps) {
  const rendered = useMemo(
    () =>
      isExcalidrawElementArray(elements)
        ? renderElementArray(elements as readonly ExcalidrawElementLike[], { isDark })
        : null,
    [elements, isDark]
  );

  if (!rendered || !rendered.markup) return <div className={className} />;

  const { viewBox } = rendered;
  return (
    <svg
      viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
      preserveAspectRatio="xMidYMid meet"
      className={className}
      fill="none"
      style={{ overflow: 'visible' }}
      dangerouslySetInnerHTML={{ __html: rendered.markup }}
    />
  );
}
