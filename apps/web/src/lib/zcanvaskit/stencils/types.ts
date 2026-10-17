/**
 * Stencil rendering primitives.
 *
 * A stencil is a piece of vector artwork the canvas can place, that the
 * library panel can preview, and that the exporter can write out — three
 * consumers with three very different runtimes. The contract that serves all
 * three is the smallest one: a pure function from a *closed* set of numbers,
 * a boolean and an optional validated colour, to a string of SVG markup.
 *
 * Closed is the important word. A renderer never receives user text, so it has
 * no way to interpolate anything that needs escaping; node labels are painted
 * by whoever places the stencil, not by the stencil itself. That is what keeps
 * markup-as-a-string safe here, and it is why the type is deliberately small —
 * widening {@link StencilRenderContext} is widening a trust boundary.
 */

/** The coordinate space artwork is authored in, before it is scaled to a node. */
export interface StencilViewBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Everything a stencil renderer is allowed to see.
 *
 * No DOM, no React, no clock, no randomness: `render` must be a pure function
 * of this object, because the canvas and the exporter call it independently and
 * have to agree on the result.
 */
export interface StencilRenderContext {
  /** Width of the node the artwork is being drawn into, in canvas pixels. */
  readonly width: number;
  /** Height of the node the artwork is being drawn into, in canvas pixels. */
  readonly height: number;
  /** Whether the surrounding UI is in its dark theme. */
  readonly isDark: boolean;
  /**
   * Optional accent override, already validated by `normalizeStencilColor`.
   * Absent for the built-in architecture stencils, which carry their own
   * two-tone palette keyed off `isDark`.
   */
  readonly color?: string;
}

/** A registered piece of placeable vector artwork. */
export interface StencilDefinition {
  /** Unique across every registered stencil; usually `<family>-<name>`. */
  readonly id: string;
  readonly title: string;
  readonly subtitle: string;
  readonly description: string;
  /**
   * Grouping label for a library browser. Free-form on purpose — the engine
   * does not own the taxonomy, and a host may register stencils under headings
   * the engine has never heard of.
   */
  readonly category: string;
  /** Size a freshly placed stencil takes, in canvas pixels. */
  readonly defaultWidth: number;
  readonly defaultHeight: number;
  /** Chip colour for a library browser, as a CSS colour. */
  readonly accentColor: string;
  /** Authored coordinate space. Defaults to a 0 0 100 100 square. */
  readonly viewBox?: StencilViewBox;
  /**
   * Returns an SVG fragment — one `<g>`, or a run of sibling elements.
   *
   * Pure: the same context always produces the same string. Callers decide
   * whether to wrap it in an `<svg>` (the canvas) or inline it into a larger
   * document (the exporter), and both scale it from {@link viewBox}.
   */
  render(ctx: StencilRenderContext): string;
}

/** The authored space a stencil is assumed to use when it does not say. */
export const DEFAULT_STENCIL_VIEW_BOX: StencilViewBox = {
  x: 0,
  y: 0,
  width: 100,
  height: 100,
};
