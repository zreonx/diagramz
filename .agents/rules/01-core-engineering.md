# Core Engineering & Canvas Engine Rules

1. **Production Completeness**:
   - Never leave placeholder comments (`// TODO`, `// stub`), mock implementations, or un-wired UI buttons.
   - Every new feature must be wired end-to-end (Zod contract $\rightarrow$ NestJS controller/service $\rightarrow$ Zustand store / UI component).

2. **`zcanvaskit` Framework Independence**:
   - All pure geometry, layout algorithms (`beautifyArchitectureLayout`), boundary containment (`encloses`), grouping, clipboard math, and SVG/PNG/PDF export logic inside `apps/web/src/lib/zcanvaskit/core`, `geometry`, `stencils`, and `export` must remain pure TypeScript without Next.js or application-store coupling.
   - Any change to `zcanvaskit` must keep the unit test suite (`pnpm --filter @diagramz/web test`) green.

3. **Workspace Ergonomics**:
   - Maintain `'canvas'` as the default `viewMode` so diagrams open into an unobstructed infinite canvas.
   - Keep the appearance/style inspector (`ZCanvasStylePanel`) anchored on the right (`right-4`) so left-to-right diagramming flows are never blocked.
