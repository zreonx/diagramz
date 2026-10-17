/**
 * Diagramz Design System Tokens & Semantic Color Palette
 *
 * Warm-neutral light mode & graphite dark mode with indigo-violet primary accent.
 * Fully compatible with modern canvas design specifications.
 */

export interface DiagramColorFamily {
  name: string;
  lightBg: string;
  lightBorder: string;
  lightText: string;
  darkBg: string;
  darkBorder: string;
  darkText: string;
}

export const DIAGRAM_NODE_PALETTES: Record<string, DiagramColorFamily> = {
  neutral: {
    name: 'Neutral',
    lightBg: '#F3F4F6',
    lightBorder: '#D1D5DB',
    lightText: '#374151',
    darkBg: '#292A30',
    darkBorder: '#555660',
    darkText: '#E5E7EB',
  },
  blue: {
    name: 'Blue',
    lightBg: '#EFF6FF',
    lightBorder: '#93C5FD',
    lightText: '#1D4ED8',
    darkBg: '#1E2D46',
    darkBorder: '#416DAA',
    darkText: '#BFDBFE',
  },
  violet: {
    name: 'Violet',
    lightBg: '#F5F3FF',
    lightBorder: '#C4B5FD',
    lightText: '#6D28D9',
    darkBg: '#302644',
    darkBorder: '#7657AA',
    darkText: '#DDD6FE',
  },
  teal: {
    name: 'Teal',
    lightBg: '#F0FDFA',
    lightBorder: '#99F6E4',
    lightText: '#0F766E',
    darkBg: '#173634',
    darkBorder: '#347D75',
    darkText: '#99F6E4',
  },
  green: {
    name: 'Green',
    lightBg: '#F0FDF4',
    lightBorder: '#86EFAC',
    lightText: '#166534',
    darkBg: '#193528',
    darkBorder: '#397A52',
    darkText: '#BBF7D0',
  },
  amber: {
    name: 'Amber',
    lightBg: '#FFFBEB',
    lightBorder: '#FCD34D',
    lightText: '#92400E',
    darkBg: '#3B2D19',
    darkBorder: '#916C31',
    darkText: '#FDE68A',
  },
  rose: {
    name: 'Rose',
    lightBg: '#FFF1F2',
    lightBorder: '#FDA4AF',
    lightText: '#9F1239',
    darkBg: '#3D222B',
    darkBorder: '#985064',
    darkText: '#FECDD3',
  },
};

/**
 * Supporting Swatch colors for toolbars and node creation
 */
export const TOOLBAR_SWATCHES = [
  { id: 'violet', hex: '#635BFF', name: 'Brand Indigo/Violet' },
  { id: 'blue', hex: '#3B82F6', name: 'Blue (Services)' },
  { id: 'teal', hex: '#0D9488', name: 'Teal (Databases)' },
  { id: 'green', hex: '#16A34A', name: 'Green (Success)' },
  { id: 'amber', hex: '#D97706', name: 'Amber (Warning)' },
  { id: 'rose', hex: '#E11D48', name: 'Rose (Critical)' },
];

/**
 * Semantic connector token lookup helper
 */
export function getEdgeColor(
  status: 'default' | 'hover' | 'selected' | 'muted' | 'success' | 'warning' | 'error',
  isDark: boolean
): string {
  switch (status) {
    case 'selected':
      return isDark ? '#A5A0FF' : '#635BFF';
    case 'hover':
      return isDark ? '#C2C4CF' : '#5F626B';
    case 'muted':
      return isDark ? '#555660' : '#C6C7CC';
    case 'success':
      return isDark ? '#4ADE80' : '#16A34A';
    case 'warning':
      return isDark ? '#FBBF24' : '#D97706';
    case 'error':
      return isDark ? '#FB7185' : '#E11D48';
    case 'default':
    default:
      return isDark ? '#9294A0' : '#8B8D94';
  }
}
