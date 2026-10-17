'use client';

/**
 * The presentation a host lends the engine, and the defaults it runs on alone.
 *
 * A node's `icon` is a name — `server`, `queue`, `postgres` — and something has
 * to turn that name into a drawing. The engine cannot own that vocabulary: it
 * is a UI decision that grows with the product, and the app's map is already
 * sixty-odd icons with names (`postgres`, `s3`, `microservice`) the engine has
 * no business knowing.
 *
 * So the map is supplied, not assumed, and the engine keeps a small default for
 * the names its own components are created with. `ZCanvas` therefore renders
 * correctly with no host at all — which is the property that lets the engine be
 * lifted out of this app — while the app still gets its full vocabulary.
 *
 * This is deliberately the *only* thing injected this way. The stencil artwork
 * is not here: it belongs to the engine, which owns it in `stencils/` and draws
 * it through `ZCanvasArtwork`. Only what the engine cannot sensibly own is a
 * prop.
 */

import type React from 'react';
import {
  Activity,
  Cloud,
  Cpu,
  Database,
  Globe,
  HardDrive,
  Layers,
  MessageSquare,
  Server,
  Shield,
} from 'lucide-react';

/** Turns a node's `icon` name into the component that draws it. */
export type ZCanvasIconMap = Record<string, React.ElementType>;

/**
 * The names the engine's own components are created with.
 *
 * A host's map is merged over this one, so a host that knows a name the engine
 * does not wins, and a name both know is drawn the host's way.
 */
export const ZCANVAS_DEFAULT_ICONS: ZCanvasIconMap = {
  globe: Globe,
  server: Server,
  database: Database,
  cloud: Cloud,
  cpu: Cpu,
  shield: Shield,
  layers: Layers,
  harddrive: HardDrive,
  queue: MessageSquare,
  activity: Activity,
};

export interface ZCanvasRenderers {
  /** Merged over `ZCANVAS_DEFAULT_ICONS`; the host's entries win. */
  icons?: ZCanvasIconMap;
}

/**
 * The map a canvas should draw with, given whatever the host supplied.
 *
 * Returns the engine's own table by identity when there is nothing to merge, so
 * a canvas with no `renderers` prop does not allocate a new object on every
 * render and invalidate its children.
 */
export function resolveIconMap(renderers?: ZCanvasRenderers): ZCanvasIconMap {
  const icons = renderers?.icons;
  if (!icons) return ZCANVAS_DEFAULT_ICONS;
  return { ...ZCANVAS_DEFAULT_ICONS, ...icons };
}
