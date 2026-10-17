/**
 * Viewport zoom constraints, shared by every path that changes zoom: the wheel,
 * the keyboard shortcuts, the context menu and zoom-to-fit. Keeping them here
 * means no path can widen the range past what another path clamps to.
 */

/** Furthest the canvas may be zoomed out to. */
export const MIN_ZOOM = 0.3;

/** Furthest the canvas may be zoomed in to. */
export const MAX_ZOOM = 2.5;

/** The zoom one discrete step (a button press, a wheel notch) applies. */
export const ZOOM_STEP = 0.15;

/** `zoom` brought inside the supported range. */
export function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}
