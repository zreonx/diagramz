export interface ZCanvasShortcut {
  id: string;
  label: string;
  description: string;
  category: 'Tools' | 'Editing' | 'Movement & Selection' | 'Navigation' | 'General';
  keys: string[];
}

export const ZCANVAS_SHORTCUTS: ZCanvasShortcut[] = [
  // Tools
  {
    id: 'tool-select',
    label: 'Select Tool',
    description: 'Switch to box selection and pointer manipulation mode',
    category: 'Tools',
    keys: ['V', '1'],
  },
  {
    id: 'tool-hand',
    label: 'Hand / Pan Tool',
    description: 'Switch to canvas panning navigation mode',
    category: 'Tools',
    keys: ['H', '2'],
  },
  {
    id: 'tool-frame',
    label: 'Frame / Artboard Tool',
    description: 'Switch to frame tool (drag to draw or pick preset)',
    category: 'Tools',
    keys: ['F'],
  },
  {
    id: 'tool-rectangle',
    label: 'Rectangle Shape',
    description: 'Activate rectangle tool (click canvas to place)',
    category: 'Tools',
    keys: ['R'],
  },
  {
    id: 'tool-diamond',
    label: 'Decision Diamond',
    description: 'Activate decision diamond tool (click canvas to place)',
    category: 'Tools',
    keys: ['D'],
  },
  {
    id: 'tool-text',
    label: 'Floating Text',
    description: 'Activate text tool (click canvas to place)',
    category: 'Tools',
    keys: ['T'],
  },
  {
    id: 'tool-line',
    label: 'Line Tool',
    description: 'Activate line tool (drag to draw line)',
    category: 'Tools',
    keys: ['L'],
  },
  {
    id: 'tool-arrow',
    label: 'Arrow Tool',
    description: 'Activate arrow tool (drag to draw directional arrow)',
    category: 'Tools',
    keys: ['A'],
  },
  {
    id: 'tool-pen',
    label: 'Freehand Pen',
    description: 'Activate freehand ink drawing tool',
    category: 'Tools',
    keys: ['P'],
  },
  {
    id: 'tool-eraser',
    label: 'Eraser Tool',
    description: 'Activate eraser tool (drag across elements to erase)',
    category: 'Tools',
    keys: ['E'],
  },

  // Editing & Clipboard
  {
    id: 'edit-duplicate',
    label: 'Duplicate',
    description: 'Clone selected nodes with automated offset',
    category: 'Editing',
    keys: ['Ctrl', 'D'],
  },
  {
    id: 'edit-copy',
    label: 'Copy',
    description: 'Copy selected nodes and edges to canvas clipboard',
    category: 'Editing',
    keys: ['Ctrl', 'C'],
  },
  {
    id: 'edit-paste',
    label: 'Paste',
    description: 'Paste elements from canvas clipboard',
    category: 'Editing',
    keys: ['Ctrl', 'V'],
  },
  {
    id: 'edit-cut',
    label: 'Cut',
    description: 'Cut selected nodes and move to canvas clipboard',
    category: 'Editing',
    keys: ['Ctrl', 'X'],
  },
  {
    id: 'edit-delete',
    label: 'Delete',
    description: 'Delete selected nodes or active edge connection',
    category: 'Editing',
    keys: ['Del', 'Backspace'],
  },
  {
    id: 'edit-undo',
    label: 'Undo',
    description: 'Undo the previous canvas action',
    category: 'Editing',
    keys: ['Ctrl', 'Z'],
  },
  {
    id: 'edit-redo',
    label: 'Redo',
    description: 'Redo the previously undone action',
    category: 'Editing',
    keys: ['Ctrl', 'Shift', 'Z'],
  },
  {
    id: 'edit-lock',
    label: 'Lock / Unlock',
    description:
      'Pin the selection against being edited, moved or resized until it is unlocked — a locked element can still be selected and unlocked',
    category: 'Editing',
    keys: ['Ctrl', 'Shift', 'L'],
  },

  // Movement & Selection
  {
    id: 'select-all',
    label: 'Select All',
    description: 'Select every shape, connector and ink mark on the canvas',
    category: 'Movement & Selection',
    keys: ['Ctrl', 'A'],
  },
  {
    id: 'select-clear',
    label: 'Deselect / Cancel',
    description: 'Clear active selection or cancel in-flight action',
    category: 'Movement & Selection',
    keys: ['Esc'],
  },
  {
    id: 'move-nudge',
    label: 'Nudge Selection',
    description: 'Move selected nodes by 10px in arrow direction',
    category: 'Movement & Selection',
    keys: ['↑', '↓', '←', '→'],
  },
  {
    id: 'move-nudge-large',
    label: 'Large Nudge',
    description: 'Move selected nodes by 50px in arrow direction',
    category: 'Movement & Selection',
    keys: ['Shift', 'Arrow Keys'],
  },
  {
    id: 'move-group',
    label: 'Group Selection',
    description:
      'Make the selection answer as one element — no box is drawn, and nothing is added to the canvas',
    category: 'Movement & Selection',
    keys: ['Ctrl', 'G'],
  },
  {
    id: 'move-ungroup',
    label: 'Ungroup',
    description: 'Release the selection from its group, one level at a time',
    category: 'Movement & Selection',
    keys: ['Ctrl', 'Shift', 'G'],
  },
  {
    id: 'select-within-group',
    label: 'Pick One From a Group',
    description: 'Hold Alt while clicking to select a single member of a group on its own',
    category: 'Movement & Selection',
    keys: ['Alt', '+ Click'],
  },

  // Navigation
  {
    id: 'nav-pan-space',
    label: 'Quick Pan Canvas',
    description: 'Hold spacebar and click-drag to pan the infinite viewport',
    category: 'Navigation',
    keys: ['Space', '+ Drag'],
  },
  {
    id: 'nav-zoom-in',
    label: 'Zoom In',
    description: 'Increase canvas magnification level',
    category: 'Navigation',
    keys: ['Ctrl', '+'],
  },
  {
    id: 'nav-zoom-out',
    label: 'Zoom Out',
    description: 'Decrease canvas magnification level',
    category: 'Navigation',
    keys: ['Ctrl', '-'],
  },
  {
    id: 'nav-zoom-reset',
    label: 'Reset Zoom (100%)',
    description: 'Reset viewport zoom to standard 1:1 scale',
    category: 'Navigation',
    keys: ['Ctrl', '0'],
  },
  {
    id: 'nav-zoom-fit',
    label: 'Zoom to Fit',
    description: 'Center and frame all elements within current viewport',
    category: 'Navigation',
    keys: ['Shift', '1'],
  },

  // General
  {
    id: 'general-settings',
    label: 'Canvas Settings',
    description: 'Open grid, snapping, style, and typography settings',
    category: 'General',
    keys: [','],
  },
  {
    id: 'general-help',
    label: 'Keyboard Shortcuts Help',
    description: 'Toggle this keyboard shortcuts cheatsheet modal',
    category: 'General',
    keys: ['?'],
  },
];
