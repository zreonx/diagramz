'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { markdown } from '@codemirror/lang-markdown';
import { oneDark } from '@codemirror/theme-one-dark';
import mermaid from 'mermaid';
import { AlertCircle, CheckCircle2, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MermaidEditorProps {
  value: string;
  onChange: (value: string) => void;
}

export function MermaidEditor({ value, onChange }: MermaidEditorProps) {
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
    <div className="flex flex-col h-full bg-slate-900 border-r border-slate-800">
      {/* Editor Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800 bg-slate-950/80">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
            Mermaid-as-Code
          </span>
          {renderError ? (
            <span className="flex items-center gap-1 text-[11px] text-red-400 bg-red-950/50 px-2 py-0.5 rounded border border-red-800/40">
              <AlertCircle className="w-3 h-3" /> Syntax Issue
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[11px] text-emerald-400 bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-800/40">
              <CheckCircle2 className="w-3 h-3" /> Valid
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          className="h-7 text-xs text-slate-400 hover:text-slate-100"
        >
          {copied ? <Check className="w-3.5 h-3.5 mr-1 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
          {copied ? 'Copied' : 'Copy'}
        </Button>
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
          className="text-sm font-mono"
        />
      </div>

      {/* Live Diagram Preview / Error Panel */}
      <div className="h-64 border-t border-slate-800 bg-slate-950/60 p-3 overflow-auto flex flex-col">
        <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 mb-2">
          Live Render Preview
        </div>
        {renderError ? (
          <div className="text-xs text-red-400 bg-red-950/30 p-2.5 rounded border border-red-900/50 font-mono whitespace-pre-wrap">
            {renderError}
          </div>
        ) : svgOutput ? (
          <div
            ref={previewRef}
            className="flex-1 flex items-center justify-center p-2 [&>svg]:max-w-full [&>svg]:h-auto"
            dangerouslySetInnerHTML={{ __html: svgOutput }}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-xs text-slate-500 italic">
            Enter Mermaid syntax above to see live preview
          </div>
        )}
      </div>
    </div>
  );
}
