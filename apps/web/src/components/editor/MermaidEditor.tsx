'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { markdown } from '@codemirror/lang-markdown';
import { oneDark } from '@codemirror/theme-one-dark';
import mermaid from 'mermaid';
import { AlertCircle, CheckCircle2, Copy, Check, Layers, ChevronDown, Sparkles, Plus, Code2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface MermaidEditorProps {
  value: string;
  onChange: (value: string) => void;
  onInsertToCanvas?: (
    code: string,
    options?: { mode?: 'mermaid-component' | 'stencils'; svg?: string }
  ) => void;
}

export function MermaidEditor({ value, onChange, onInsertToCanvas }: MermaidEditorProps) {
  const [copied, setCopied] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [svgOutput, setSvgOutput] = useState<string>('');
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: 'dark',
      securityLevel: 'loose',
      fontFamily: 'system-ui, sans-serif',
    });
  }, []);

  const renderMermaid = useCallback(async (code: string) => {
    if (!code.trim()) {
      setSvgOutput('');
      setRenderError(null);
      return;
    }

    try {
      const id = `mermaid-render-${Date.now()}`;
      const { svg } = await mermaid.render(id, code);
      setSvgOutput(svg);
      setRenderError(null);
    } catch (err: any) {
      setRenderError(err.message || 'Syntax error in Mermaid code');
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      renderMermaid(value);
    }, 300);

    return () => clearTimeout(timer);
  }, [value, renderMermaid]);

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col h-full bg-card border-r border-border/50 text-card-foreground">
      {/* Editor Header */}
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-border/50 bg-muted/30">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-foreground uppercase tracking-wider">
            Mermaid Editor
          </span>
          {renderError ? (
            <span className="flex items-center gap-1 text-[10px] text-destructive bg-destructive/10 px-2 py-0.5 rounded-full border border-destructive/20 font-medium">
              <AlertCircle className="w-3 h-3" /> Syntax Issue
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[10px] text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 font-medium">
              <CheckCircle2 className="w-3 h-3" /> Valid
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {onInsertToCanvas && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="default"
                  size="sm"
                  disabled={!value.trim()}
                  className="h-7.5 px-2.5 text-xs gap-1.5 font-medium rounded-lg shadow-xs"
                  title="Insert diagram onto the canvas"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Insert to Canvas</span>
                  <ChevronDown className="w-3 h-3 opacity-70 ml-0.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuItem
                  onClick={() => onInsertToCanvas(value, { mode: 'mermaid-component', svg: svgOutput })}
                  className="cursor-pointer py-2 flex flex-col items-start gap-0.5"
                >
                  <div className="flex items-center gap-1.5 font-medium text-xs text-foreground">
                    <Code2 className="w-3.5 h-3.5 text-primary" />
                    <span>Insert as Mermaid Component</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    High-fidelity live vector render of the exact Mermaid diagram
                  </span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => onInsertToCanvas(value, { mode: 'stencils', svg: svgOutput })}
                  className="cursor-pointer py-2 flex flex-col items-start gap-0.5"
                >
                  <div className="flex items-center gap-1.5 font-medium text-xs text-foreground">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>Convert to Diagramz Stencils</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    Native editable architecture cards, containers, and stencils
                  </span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className="h-7.5 text-xs text-muted-foreground hover:text-foreground rounded-lg"
          >
            {copied ? <Check className="w-3.5 h-3.5 mr-1 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
            {copied ? 'Copied' : 'Copy'}
          </Button>
        </div>
      </div>

      {/* Code Editor */}
      <div className="flex-1 overflow-auto">
        <CodeMirror
          value={value}
          height="100%"
          theme={oneDark}
          extensions={[markdown()]}
          onChange={(val) => onChange(val)}
          basicSetup={{
            lineNumbers: true,
            foldGutter: true,
            highlightActiveLine: true,
          }}
          className="text-xs font-mono"
        />
      </div>

      {/* Live Diagram Preview / Error Panel */}
      <div className="h-64 border-t border-border/50 bg-muted/15 p-3.5 overflow-auto flex flex-col shrink-0">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/70">
            Live Render Preview
          </div>
          {svgOutput && onInsertToCanvas && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onInsertToCanvas(value, { mode: 'mermaid-component', svg: svgOutput })}
              className="h-6 px-2 text-[11px] gap-1 font-medium rounded-md text-primary hover:text-primary hover:bg-primary/10 border-primary/20 cursor-pointer shadow-2xs"
              title="Insert this live preview as a Mermaid component onto the canvas"
            >
              <Plus className="w-3 h-3" />
              <span>Insert Live Preview</span>
            </Button>
          )}
        </div>
        {renderError ? (
          <div className="text-xs text-destructive bg-destructive/10 p-2.5 rounded-lg border border-destructive/20 font-mono whitespace-pre-wrap">
            {renderError}
          </div>
        ) : svgOutput ? (
          <div
            ref={previewRef}
            className="flex-1 flex items-center justify-center p-2 [&>svg]:max-w-full [&>svg]:h-auto"
            dangerouslySetInnerHTML={{ __html: svgOutput }}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground italic">
            Enter Mermaid syntax above to see live preview
          </div>
        )}
      </div>
    </div>
  );
}
