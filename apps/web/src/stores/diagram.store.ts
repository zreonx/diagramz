import { create } from 'zustand';
import { DiagramDetail, PresenceUser } from '@diagramz/shared';
import { apiClient } from '../lib/api';
import { exportDocumentToSvg, normalizeToZCanvasDocument } from '../lib/zcanvaskit';

export type PanelMode = 'none' | 'mermaid' | 'ai' | 'library';
export type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error';
export type WorkspaceViewMode = 'both' | 'doc' | 'canvas';
export type EdgeRoutingMode = 'bezier' | 'step';

interface DiagramState {
  currentDiagram: DiagramDetail | null;
  mermaidCode: string;
  canvasData: unknown;
  documentContent: string;
  viewMode: WorkspaceViewMode;
  edgeRouting: EdgeRoutingMode;
  panelMode: PanelMode;
  saveStatus: SaveStatus;
  collaborators: PresenceUser[];

  setDiagram: (diagram: DiagramDetail | null) => void;
  setMermaidCode: (code: string) => void;
  setCanvasData: (data: unknown) => void;
  setDocumentContent: (content: string) => void;
  setViewMode: (mode: WorkspaceViewMode) => void;
  setEdgeRouting: (routing: EdgeRoutingMode) => void;
  setPanelMode: (mode: PanelMode) => void;
  setSaveStatus: (status: SaveStatus) => void;
  setCollaborators: (users: PresenceUser[]) => void;
  updateDiagramShareSettings: (settings: { isPublic: boolean; shareToken?: string; shareRole?: 'viewer' | 'editor' }) => void;
  saveDiagram: () => Promise<void>;
}

export const useDiagramStore = create<DiagramState>((set, get) => ({
  currentDiagram: null,
  mermaidCode: '',
  canvasData: null,
  documentContent: '',
  viewMode: 'canvas',
  edgeRouting: 'bezier',
  panelMode: 'none',
  saveStatus: 'saved',
  collaborators: [],

  setDiagram: (diagram) => {
    let mode: WorkspaceViewMode = 'canvas';
    if (typeof window !== 'undefined') {
      const savedPref = localStorage.getItem('diagramz_preferred_view_mode') as WorkspaceViewMode | null;
      if (savedPref && ['canvas', 'both', 'doc'].includes(savedPref)) {
        mode = savedPref;
      } else if (diagram?.viewMode === 'doc') {
        mode = 'doc';
      }
    } else if (diagram?.viewMode === 'doc') {
      mode = 'doc';
    }

    set({
      currentDiagram: diagram,
      mermaidCode: diagram?.mermaidCode || '',
      canvasData: diagram?.canvasData || null,
      documentContent: diagram?.documentContent || '',
      viewMode: mode,
      saveStatus: 'saved',
    });
  },

  setMermaidCode: (code) => {
    set({ mermaidCode: code, saveStatus: 'unsaved' });
  },

  setCanvasData: (data) => {
    set({ canvasData: data, saveStatus: 'unsaved' });
  },

  setDocumentContent: (content) => {
    set({ documentContent: content, saveStatus: 'unsaved' });
  },

  setViewMode: (viewMode) => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('diagramz_preferred_view_mode', viewMode);
      } catch (_) {}
    }
    set({ viewMode, saveStatus: 'unsaved' });
  },

  setEdgeRouting: (edgeRouting) => {
    set({ edgeRouting });
  },

  setPanelMode: (panelMode) => {
    set({ panelMode });
  },

  setSaveStatus: (saveStatus) => {
    set({ saveStatus });
  },

  setCollaborators: (collaborators) => {
    set({ collaborators });
  },

  updateDiagramShareSettings: (settings: { isPublic: boolean; shareToken?: string; shareRole?: 'viewer' | 'editor' }) => {
    const current = get().currentDiagram;
    if (current) {
      set({
        currentDiagram: {
          ...current,
          isPublic: settings.isPublic,
          shareToken: settings.shareToken !== undefined ? settings.shareToken : current.shareToken,
          shareRole: settings.shareRole !== undefined ? settings.shareRole : current.shareRole,
        },
      });
    }
  },

  saveDiagram: async () => {
    const { currentDiagram, mermaidCode, canvasData, documentContent, viewMode } = get();
    if (!currentDiagram) return;

    set({ saveStatus: 'saving' });
    try {
      let thumbnailKey: string | null | undefined = undefined;
      try {
        const doc = normalizeToZCanvasDocument(canvasData);
        if (doc.nodes.length > 0 || (doc.strokes && doc.strokes.length > 0)) {
          const isDark =
            typeof document !== 'undefined' &&
            document.documentElement.classList.contains('dark');
          const svg = exportDocumentToSvg(doc, {
            isDark,
            transparentBackground: true,
            fitToContent: true,
            padding: 24,
          });
          const dataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
          if (dataUrl.length < 90000) {
            thumbnailKey = dataUrl;
          }
        }
      } catch {
        // Ignore thumbnail generation error and proceed with save
      }

      await apiClient.patch(`/diagrams/${currentDiagram.id}`, {
        mermaidCode,
        canvasData,
        documentContent,
        viewMode,
        ...(thumbnailKey !== undefined ? { thumbnailKey } : {}),
      });
      set({ saveStatus: 'saved' });
    } catch {
      set({ saveStatus: 'error' });
    }
  },
}));

if (typeof window !== 'undefined') {
  (window as any).useDiagramStore = useDiagramStore;
}
