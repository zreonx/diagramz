import { create } from 'zustand';
import { DiagramDetail, PresenceUser } from '@diagramz/shared';
import { apiClient } from '../lib/api';

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
  viewMode: 'both',
  edgeRouting: 'bezier',
  panelMode: 'none',
  saveStatus: 'saved',
  collaborators: [],

  setDiagram: (diagram) => {
    set({
      currentDiagram: diagram,
      mermaidCode: diagram?.mermaidCode || '',
      canvasData: diagram?.canvasData || null,
      documentContent: diagram?.documentContent || '',
      viewMode: (diagram?.viewMode as WorkspaceViewMode) || 'both',
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
      await apiClient.patch(`/diagrams/${currentDiagram.id}`, {
        mermaidCode,
        canvasData,
        documentContent,
        viewMode,
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
