import { ARCHITECTURE_STENCILS } from './architecture';
import { TECH_ICON_STENCILS } from './tech-icons';
import { createStencilRegistry, type StencilRegistry } from './registry';
import type { StencilDefinition } from './types';

/**
 * Every stencil the engine ships with.
 *
 * Two families, and the split is meaningful rather than organisational: the
 * architecture stencils are drawn in a 100×100 authored square from a two-tone
 * palette keyed off the theme, while the tech logos keep their own native grid
 * and a single brand colour. Both satisfy the same contract, which is why they
 * can sit in one registry.
 */
export const BUILTIN_STENCILS: readonly StencilDefinition[] = [
  ...ARCHITECTURE_STENCILS,
  ...TECH_ICON_STENCILS,
];

/**
 * The registry every consumer resolves against unless a host supplies its own.
 *
 * Built once at module load, so a duplicated id is a startup failure rather
 * than one stencil quietly rendering as another. The engine's own suites assert
 * the built-in ids against the library catalogue, which is what keeps this list
 * from drifting away from what the panel offers.
 */
export const BUILTIN_STENCIL_REGISTRY: StencilRegistry = createStencilRegistry(
  BUILTIN_STENCILS
);
