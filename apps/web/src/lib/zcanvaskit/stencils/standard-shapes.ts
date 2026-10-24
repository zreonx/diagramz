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

const CATEGORY = 'Standard Shapes';

export const STANDARD_DRAWIO_SHAPES: StandardDrawioShapeDef[] = [
  {
    id: 'shape-sticky-note',
    type: 'sticky-note',
    title: 'Sticky Note',
    category: CATEGORY,
    description: 'Post-it note with pastel themes and instant click-to-type editing',
    width: 160,
    height: 160,
  },
  {
    id: 'shape-cylinder',
    type: 'cylinder',
    title: 'Database Drum',
    category: CATEGORY,
    description: '3D Cylinder database container with top rim divider',
    width: 110,
    height: 120,
  },
  {
    // The one tile here that drops an editable component: a table whose title
    // and column names are edited in place and whose rows are added from the
    // right-click menu.
    id: 'shape-table',
    type: 'table',
    title: 'Database Table',
    category: CATEGORY,
    description:
      'Editable table: rename the title and columns in place, Add Column from the right-click menu, resize at the corners',
    width: 220,
    height: 160,
  },
  {
    // The other tile that drops a component rather than a bare shape: a
    // boundary, which is a plate big enough to draw a diagram on. What is drawn
    // inside it is not part of it — grouping is what makes a box and its
    // contents travel together.
    id: 'shape-container',
    type: 'container',
    title: 'VPC Container',
    category: CATEGORY,
    description:
      'Cloud boundary for a VPC, subnet or trust zone: a titled frame that paints beneath what is drawn on it and moves on its own',
    width: 500,
    height: 350,
  },
  {
    id: 'shape-cloud',
    type: 'cloud',
    title: 'Cloud Perimeter',
    category: CATEGORY,
    description: 'Multi-lobe cloud boundary for VPC, public internet, and clusters',
    width: 180,
    height: 110,
  },
  {
    id: 'shape-server-box',
    type: 'rectangle',
    title: 'Server Box',
    category: CATEGORY,
    description: 'Classic draw.io host / service node box',
    width: 160,
    height: 80,
  },
  {
    id: 'shape-circle-node',
    type: 'circle',
    title: 'Process Node',
    category: CATEGORY,
    description: 'Circular processing state / queue vertex',
    width: 120,
    height: 120,
  },
  {
    id: 'shape-document',
    type: 'document',
    title: 'Process Document',
    category: CATEGORY,
    description: 'Standard flowchart document or printed report with wavy base',
    width: 140,
    height: 90,
  },
  {
    id: 'shape-parallelogram',
    type: 'parallelogram',
    title: 'Data (I/O)',
    category: CATEGORY,
    description: 'Flowchart data input/output transmission parallelogram',
    width: 150,
    height: 80,
  },
  {
    id: 'shape-hexagon',
    type: 'hexagon',
    title: 'Preparation Hexagon',
    category: CATEGORY,
    description: 'Flowchart preparation, loop initialization or condition vertex',
    width: 140,
    height: 80,
  },
  {
    id: 'shape-subroutine',
    type: 'subroutine',
    title: 'Predefined Subroutine',
    category: CATEGORY,
    description: 'Predefined procedure or subroutine with double vertical borders',
    width: 150,
    height: 80,
  },
];
