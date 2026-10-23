---
name: zcanvaskit-engine
description: >-
  Use this skill when modifying the core diagramming canvas engine (zcanvaskit),
  including adding new architecture stencils, geometric shapes, connector routing,
  auto-layout algorithms, SVG/PNG/PDF exports, or running the canvas unit test suite.
---

# `zcanvaskit` Canvas Engine Runbook

`zcanvaskit` (`apps/web/src/lib/zcanvaskit`) is the framework-independent diagramming engine powering Diagramz.

## Key Modules

1. **Document Schema**: `apps/web/src/lib/zcanvaskit/core/schema.ts`
   - Defines `ZCanvasDocument`, `ZCanvasNode`, `ZCanvasEdge`, `ZCanvasDrawingStroke`, and `ZCanvasViewport`.
   - Always normalize incoming/stored JSON through `normalizeToZCanvasDocument()`.
2. **Stencils & Drag Payloads**: `apps/web/src/lib/zcanvaskit/stencils/`
   - `architecture.ts`: Clean vector architecture stencils (`arch-*`).
   - `tech-icons.ts`: Cloud & technology brand stencils (`tech-*`).
   - `standard-shapes.ts`: Geometric & Draw.io standard shapes.
   - `drag-payload.ts` & `placement.ts`: Unified `ZCanvasDragItem` (`application/x-diagramz-item`) and `placeDragItem()` placement logic.
3. **Auto-Layout Engine**: `apps/web/src/lib/zcanvaskit/core/layout-beautifier.ts`
   - `beautifyArchitectureLayout(nodes, edges, options)` computes hierarchical ranks, container bounds, and non-overlapping edge handles.
4. **Exporters**: `apps/web/src/lib/zcanvaskit/export/`
   - `svg.ts` (`exportDocumentToSvg`), `png.ts` (`exportDocumentToPng`), `pdf.ts` (`exportDocumentToPdf`).
   - All strings interpolated into SVG XML must pass through `escapeXml` / `escapeAttr` in `stencils/xml.ts`.

## Verification Procedure

Whenever modifying any file under `apps/web/src/lib/zcanvaskit`:

1. Run the Node native TypeScript test suite (565+ tests):
   ```powershell
   pnpm --filter @diagramz/web test
   ```
2. Add unit tests (`*.test.mjs`) alongside the modified module covering edge cases (empty selections, locked elements, NaN coordinates, XML escaping).
3. Verify the Next.js production build:
   ```powershell
   pnpm --filter @diagramz/web build
   ```
