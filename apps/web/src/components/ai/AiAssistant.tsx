'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, Loader2, ArrowRight, RefreshCw, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api';
import { AiChatMessage, AiProvider } from '@diagramz/shared';

interface AiAssistantProps {
  currentMermaidCode: string;
  onApplyDiagram: (mermaidCode: string) => void;
}

export function AiAssistant({ currentMermaidCode, onApplyDiagram }: AiAssistantProps) {
  const [messages, setMessages] = useState<AiChatMessage[]>([
    {
      role: 'assistant',
      content:
        'Hello! I am your AI Architecture Assistant. Describe a system or workflow, and I will generate or refine strict Mermaid diagrams for you.',
    },
  ]);
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [provider, setProvider] = useState<AiProvider>('openai');
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isLoading) return;

    const userText = prompt.trim();
    setPrompt('');
    setApplied(false);
    setGeneratedCode(null);

    const updatedMessages: AiChatMessage[] = [
      ...messages,
      { role: 'user', content: userText },
    ];
    setMessages(updatedMessages);
    setIsLoading(true);

    try {
      // Call AI generate endpoint
      const res = await apiClient.post('/ai/generate', {
        prompt: userText,
        provider,
        currentMermaidCode: currentMermaidCode || undefined,
      });

      const { mermaidCode, explanation } = res.data;
      setGeneratedCode(mermaidCode);

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `${explanation}\n\n\`\`\`mermaid\n${mermaidCode}\n\`\`\``,
        },
      ]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Sorry, an error occurred while generating the diagram: ${err.response?.data?.message || err.message}`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApply = (codeToApply?: string) => {
    const code = codeToApply || generatedCode;
    if (code) {
      onApplyDiagram(code);
      setApplied(true);
      setTimeout(() => setApplied(false), 2500);
    }
  };

  const templates = [
    'Event-driven Kafka microservices with order and notification services',
    'User authentication flow with JWT and refresh token rotation',
    'Serverless RAG pipeline with vector database and embedding models',
  ];

  return (
    <div className="flex flex-col h-full bg-slate-900 border-r border-slate-800">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800 bg-slate-950/80">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-400">
          <Sparkles className="w-4 h-4" />
          <span>AI Architecture Assistant</span>
        </div>
        <select
          value={provider}
          onChange={(e) => setProvider(e.target.value as AiProvider)}
          className="bg-slate-800 text-slate-300 text-xs rounded border border-slate-700 px-2 py-1 outline-none"
        >
          <option value="openai">OpenAI (GPT-4o)</option>
          <option value="anthropic">Claude 3.5 Sonnet</option>
        </select>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 text-xs">
        {messages.map((msg, i) => {
          const isUser = msg.role === 'user';
          const mermaidMatch = msg.content.match(/```(?:mermaid)?\s*([\s\S]*?)```/i);
          const mermaidBlock = mermaidMatch ? mermaidMatch[1].trim() : null;
          const textOnly = msg.content.replace(/```(?:mermaid)?[\s\S]*?```/gi, '').trim();

          return (
            <div
              key={i}
              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[90%] rounded-lg p-3 ${
                  isUser
                    ? 'bg-blue-600 text-white font-medium'
                    : 'bg-slate-800/90 text-slate-200 border border-slate-700/60'
                }`}
              >
                <div className="whitespace-pre-wrap leading-relaxed">{textOnly}</div>
                {mermaidBlock && (
                  <div className="mt-2.5 pt-2.5 border-t border-slate-700/80">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-mono text-blue-300 uppercase">
                        Mermaid Diagram Code
                      </span>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleApply(mermaidBlock)}
                        className="h-6 text-[10px] px-2 bg-blue-600/30 text-blue-300 hover:bg-blue-600 hover:text-white border border-blue-500/30"
                      >
                        {applied ? <Check className="w-3 h-3 mr-1" /> : <ArrowRight className="w-3 h-3 mr-1" />}
                        {applied ? 'Applied!' : 'Apply to Canvas'}
                      </Button>
                    </div>
                    <pre className="p-2 bg-slate-950 rounded text-[11px] font-mono overflow-x-auto text-emerald-300 border border-slate-800">
                      {mermaidBlock}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {isLoading && (
          <div className="flex items-center gap-2 text-xs text-blue-400 bg-slate-800/60 p-2.5 rounded-lg border border-slate-700/40 w-fit">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Architecting Mermaid diagram...</span>
          </div>
        )}
        <div ref={chatBottomRef} />
      </div>

      {/* Suggested Templates */}
      {messages.length <= 2 && (
        <div className="px-3 py-2 border-t border-slate-800/80 bg-slate-950/40">
          <div className="text-[10px] uppercase font-semibold text-slate-400 mb-1.5">
            Quick Prompts:
          </div>
          <div className="space-y-1">
            {templates.map((tpl, idx) => (
              <button
                key={idx}
                onClick={() => setPrompt(tpl)}
                className="w-full text-left text-[11px] text-slate-300 hover:text-blue-300 bg-slate-800/40 hover:bg-slate-800/80 px-2 py-1 rounded truncate transition-colors"
              >
                • {tpl}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Prompt Form */}
      <form onSubmit={handleSubmit} className="p-2.5 border-t border-slate-800 bg-slate-950/90 flex gap-1.5">
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Ask AI to design or modify diagram..."
          disabled={isLoading}
          className="flex-1 bg-slate-800 border border-slate-700 rounded-md px-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
        />
        <Button
          type="submit"
          size="sm"
          disabled={isLoading || !prompt.trim()}
          className="h-8 px-3 bg-blue-600 hover:bg-blue-700 text-white"
        >
          {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
        </Button>
      </form>
    </div>
  );
}
