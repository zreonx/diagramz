'use client';

import React, { useEffect, useRef, useCallback } from 'react';
import { Excalidraw } from './ExcalidrawWrapper';
import { MermaidEditor } from '../editor/MermaidEditor';
import { AiAssistant } from '../ai/AiAssistant';
import { CanvasHeader } from './CanvasHeader';
import { RemoteCursorsOverlay } from './RemoteCursorsOverlay';
import { useDiagramStore } from '@/stores/diagram.store';
import { useCollab } from '@/hooks/useCollab';
import { DiagramDetail } from '@diagramz/shared';

interface DiagramCanvasProps {
  initialDiagram: DiagramDetail;
  workspaceName?: string;
  projectName?: string;
}

export function DiagramCanvas({
  initialDiagram,
  workspaceName,
  projectName,
}: DiagramCanvasProps) {
  const {
    currentDiagram,
    setDiagram,
    mermaidCode,
    setMermaidCode,
    panelMode,
    saveDiagram,
    setCanvasData,
  } = useDiagramStore();

  const { sendCursorPosition, sendYjsUpdate } = useCollab(initialDiagram.id);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize store with diagram
  useEffect(() => {
    setDiagram(initialDiagram);
  }, [initialDiagram, setDiagram]);

  // Debounced auto-save (every 2 seconds after edit)
  const triggerAutoSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      saveDiagram();
    }, 2000);
  }, [saveDiagram]);

  const handleMermaidChange = (newCode: string) => {
    setMermaidCode(newCode);
    triggerAutoSave();
  };

  const handleApplyAiDiagram = (code: string) => {
    setMermaidCode(code);
    triggerAutoSave();
  };

  const handleExcalidrawChange = (elements: readonly any[], appState: any) => {
    const data = { elements: [...elements], appState: { viewBackgroundColor: appState.viewBackgroundColor } };
    setCanvasData(data);
    triggerAutoSave();
  };

  const handlePointerUpdate = (payload: { pointer: { x: number; y: number } }) => {
    sendCursorPosition(payload.pointer);
  };

  const initialElements = React.useMemo(() => {
    try {
      const data = initialDiagram.canvasData;
      if (!data) return [];
      if (typeof data === 'string') {
        const parsed = JSON.parse(data);
        return Array.isArray(parsed?.elements) ? parsed.elements : [];
      }
      if (typeof data === 'object' && data !== null && 'elements' in (data as any)) {
        const els = (data as any).elements;
        return Array.isArray(els) ? els : [];
      }
      return [];
    } catch {
      return [];
    }
  }, [initialDiagram.canvasData]);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-950">
      <CanvasHeader
        title={currentDiagram?.title || initialDiagram.title}
        workspaceName={workspaceName}
        projectName={projectName}
      />

      {/* Main Workspace Body */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Collapsible Left Side Pane (Mode A: Mermaid, Mode B: AI) */}
        {panelMode !== 'none' && (
          <div className="w-[450px] h-full flex-shrink-0 z-10 transition-all duration-200">
            {panelMode === 'mermaid' && (
              <MermaidEditor
                value={mermaidCode}
                onChange={handleMermaidChange}
              />
            )}
            {panelMode === 'ai' && (
              <AiAssistant
                currentMermaidCode={mermaidCode}
                onApplyDiagram={handleApplyAiDiagram}
              />
            )}
          </div>
        )}

        {/* Main Infinite Canvas Surface */}
        <div className="flex-1 h-full relative overflow-hidden bg-[#121212]">
          <RemoteCursorsOverlay />
          <div className="w-full h-full relative">
            <Excalidraw
              initialData={{
                elements: initialElements,
                appState: {
                  theme: 'dark',
                  viewBackgroundColor: '#121212',
                  currentItemStrokeColor: '#3b82f6',
                },
              }}
              onChange={handleExcalidrawChange}
              onPointerUpdate={handlePointerUpdate}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
