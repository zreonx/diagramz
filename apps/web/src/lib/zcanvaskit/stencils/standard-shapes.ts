/**
 * The Standard Shapes the component library offers as tiles.
 *
 * Data rather than a component, because a tile is only a shortcut: it names an
 * engine tool and a size, and the canvas places whatever that tool makes. Two
 * things follow from that, and both are why this lives here rather than beside
 * the panel that draws it. A tile cannot describe something the engine cannot
 * place — a test asserts every `type` is a real tool name — and adding a tile
 * needs no case anywhere in the canvas, so a geometric primitive and an editable
 * component are the same kind of entry.
 */

import type { ZCanvasToolName } from './drag-payload';

export interface StandardDrawioShapeDef {
  /** Stable tile id, used as the React key and by the search box. */
  id: string;
  /**
   * The engine tool the tile drops.
   *
   * A geometric tool (`rectangle`, `cylinder`, …) lands a bare shape node; a
   * component tool (`table`, `container`, …) lands the editable component of
   * that kind. Either way the tile is a shortcut into the tool vocabulary, not
   * a separate kind of object.
   */
  type: ZCanvasToolName;
  title: string;
  category: string;
  description: string;
  /**
   * The size the drop asks for.
   *
   * Honoured by the geometric tools, which take a size from the payload; the
   * component tools build their own node and read their own defaults, so the
   * two numbers here are deliberately the same ones those defaults use.
   */
  width: number;
  height: number;
}

const CATEGORY_GENERAL = 'General Shapes';
const CATEGORY_FLOWCHART = 'Flowchart Shapes';
const CATEGORY_CONTAINERS = 'Containers & Tables';

export const STANDARD_DRAWIO_SHAPES: StandardDrawioShapeDef[] = [
  // ─── 1. GENERAL SHAPES (DRAW.IO ESSENTIALS) ───
  {
    id: 'shape-sticky-note',
    type: 'sticky-note',
    title: 'Sticky Note',
    category: CATEGORY_GENERAL,
    description: 'Post-it note with pastel themes and instant click-to-type editing',
    width: 160,
    height: 160,
  },
  {
    id: 'shape-server-box',
    type: 'rectangle',
    title: 'Rectangle',
    category: CATEGORY_GENERAL,
    description: 'Standard draw.io host / service node box',
    width: 160,
    height: 80,
  },
  {
    id: 'shape-rounded-rect',
    type: 'rounded-rectangle',
    title: 'Rounded Rectangle',
    category: CATEGORY_GENERAL,
    description: 'Process box with smooth rounded corners',
    width: 160,
    height: 80,
  },
  {
    id: 'shape-circle-node',
    type: 'circle',
    title: 'Ellipse / Circle',
    category: CATEGORY_GENERAL,
    description: 'Circular processing state / queue vertex',
    width: 120,
    height: 120,
  },
  {
    id: 'shape-diamond',
    type: 'diamond',
    title: 'Decision Diamond',
    category: CATEGORY_GENERAL,
    description: 'Branching decision condition or evaluation vertex',
    width: 100,
    height: 100,
  },
  {
    id: 'shape-triangle',
    type: 'triangle',
    title: 'Triangle',
    category: CATEGORY_GENERAL,
    description: 'Directional logic gate, hierarchy or warning vertex',
    width: 120,
    height: 100,
  },
  {
    id: 'shape-cylinder',
    type: 'cylinder',
    title: 'Database Drum',
    category: CATEGORY_GENERAL,
    description: '3D Cylinder database container with top rim divider',
    width: 110,
    height: 120,
  },
  {
    id: 'shape-cloud',
    type: 'cloud',
    title: 'Cloud Perimeter',
    category: CATEGORY_GENERAL,
    description: 'Multi-lobe cloud boundary for VPC, public internet, and clusters',
    width: 180,
    height: 110,
  },
  {
    id: 'shape-actor',
    type: 'actor',
    title: 'Actor / User',
    category: CATEGORY_GENERAL,
    description: 'Classic UML actor stick figure for client, user or role persona',
    width: 90,
    height: 130,
  },
  {
    id: 'shape-cube',
    type: 'cube',
    title: '3D Cube',
    category: CATEGORY_GENERAL,
    description: '3D Isometric box for server nodes, physical hardware or block storage',
    width: 120,
    height: 120,
  },
  {
    id: 'shape-callout',
    type: 'callout',
    title: 'Speech Callout',
    category: CATEGORY_GENERAL,
    description: 'Speech bubble annotation with pointer tail for notes and commentary',
    width: 160,
    height: 100,
  },
  {
    id: 'shape-star',
    type: 'star',
    title: '5-Point Star',
    category: CATEGORY_GENERAL,
    description: 'Star symbol for milestones, favorites, highlights or status rankings',
    width: 110,
    height: 110,
  },

  // ─── 2. FLOWCHART SHAPES (DRAW.IO STANDARD FLOWCHART) ───
  {
    id: 'shape-document',
    type: 'document',
    title: 'Process Document',
    category: CATEGORY_FLOWCHART,
    description: 'Standard flowchart document or printed report with wavy base',
    width: 140,
    height: 90,
  },
  {
    id: 'shape-parallelogram',
    type: 'parallelogram',
    title: 'Data (I/O)',
    category: CATEGORY_FLOWCHART,
    description: 'Flowchart data input/output transmission parallelogram',
    width: 150,
    height: 80,
  },
  {
    id: 'shape-hexagon',
    type: 'hexagon',
    title: 'Preparation Hexagon',
    category: CATEGORY_FLOWCHART,
    description: 'Flowchart preparation, loop initialization or condition vertex',
    width: 140,
    height: 80,
  },
  {
    id: 'shape-subroutine',
    type: 'subroutine',
    title: 'Predefined Subroutine',
    category: CATEGORY_FLOWCHART,
    description: 'Predefined procedure or subroutine with double vertical borders',
    width: 150,
    height: 80,
  },
  {
    id: 'shape-step',
    type: 'step',
    title: 'Step / Chevron',
    category: CATEGORY_FLOWCHART,
    description: 'Process pipeline chevron arrow step pointing right',
    width: 160,
    height: 80,
  },
  {
    id: 'shape-trapezoid',
    type: 'trapezoid',
    title: 'Manual Operation',
    category: CATEGORY_FLOWCHART,
    description: 'Flowchart manual operation trapezoid with sloped sides',
    width: 150,
    height: 80,
  },
  {
    id: 'shape-internal-storage',
    type: 'internal-storage',
    title: 'Internal Storage',
    category: CATEGORY_FLOWCHART,
    description: 'Flowchart internal storage with top and left header divider lines',
    width: 150,
    height: 80,
  },

  // ─── 3. CONTAINERS & TABLES ───
  {
    id: 'shape-table',
    type: 'table',
    title: 'Database Table',
    category: CATEGORY_CONTAINERS,
    description:
      'Editable table: rename the title and columns in place, Add Column from the right-click menu, resize at the corners',
    width: 220,
    height: 160,
  },
  {
    id: 'shape-container',
    type: 'container',
    title: 'VPC Container',
    category: CATEGORY_CONTAINERS,
    description:
      'Cloud boundary for a VPC, subnet or trust zone: a titled frame that paints beneath what is drawn on it and moves on its own',
    width: 500,
    height: 350,
  },
];
