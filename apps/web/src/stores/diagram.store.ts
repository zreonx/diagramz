import { create } from 'zustand';
import { DiagramDetail, PresenceUser } from '@diagramz/shared';
import { apiClient } from '../lib/api';

export type PanelMode = 'none' | 'mermaid' | 'ai';
export type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error';

interface DiagramState {
  currentDiagram: DiagramDetail | null;
  mermaidCode: string;
  canvasData: unknown;
  panelMode: PanelMode;
  saveStatus: SaveStatus;
  collaborators: PresenceUser[];

  setDiagram: (diagram: DiagramDetail | null) => void;
  setMermaidCode: (code: string) => void;
  setCanvasData: (data: unknown) => void;
  setPanelMode: (mode: PanelMode) => void;
  setSaveStatus: (status: SaveStatus) => void;
  setCollaborators: (users: PresenceUser[]) => void;
  saveDiagram: () => Promise<void>;
}

export const useDiagramStore = create<DiagramState>((set, get) => ({
  currentDiagram: null,
  mermaidCode: '',
  canvasData: null,
  panelMode: 'none',
  saveStatus: 'saved',
  collaborators: [],

  setDiagram: (diagram) => {
    set({
      currentDiagram: diagram,
      mermaidCode: diagram?.mermaidCode || '',
      canvasData: diagram?.canvasData || null,
      saveStatus: 'saved',
    });
  },

  setMermaidCode: (code) => {
    set({ mermaidCode: code, saveStatus: 'unsaved' });
  },

  setCanvasData: (data) => {
    set({ canvasData: data, saveStatus: 'unsaved' });
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

  saveDiagram: async () => {
    const { currentDiagram, mermaidCode, canvasData } = get();
    if (!currentDiagram) return;

    set({ saveStatus: 'saving' });
    try {
      await apiClient.patch(`/diagrams/${currentDiagram.id}`, {
        mermaidCode,
        canvasData,
      });
      set({ saveStatus: 'saved' });
    } catch {
      set({ saveStatus: 'error' });
    }
  },
}));
