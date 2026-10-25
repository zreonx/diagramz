'use client';

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  Sparkles,
  Send,
  Loader2,
  Check,
  ShieldCheck,
  Box,
  Layers,
  ChevronDown,
  ChevronUp,
  Code2,
  Cpu,
  History,
  Plus,
  Trash2,
  X,
  MessageSquare,
  RotateCcw,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';
import { ZCanvasStencilGraphic } from '@/lib/zcanvaskit/react/ZCanvasArtwork';
import { cn } from '@/lib/utils';

type AiProvider = 'gemini' | 'openai' | 'anthropic';

export interface Message {
  role: 'user' | 'assistant';
  content?: string;
  explanation?: string;
  canvasData?: Record<string, any> | null;
  mermaidCode?: string;
}

export interface AiChatSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: Message[];
}

interface AiAssistantProps {
  diagramId?: string;
  currentMermaidCode: string;
  onApplyDiagram: (mermaidCode: string) => void;
  onInsertToCanvas?: (mermaidCode: string) => void;
  onInsertNativeCanvasDoc?: (canvasData: any) => void;
  onClose?: () => void;
}

const DEFAULT_WELCOME_MESSAGE: Message = {
  role: 'assistant',
  explanation:
    '### Welcome to Diagramz AI ⚡\n\nI generate **precise, high-impact diagrams** directly for your canvas — including business workflows, flowcharts & decision trees, database schemas (ERDs), sequence flows, and cloud architectures.\n\nDescribe any process, system, or workflow, or choose a prompt below.'
};

function createDefaultSession(title = 'New AI Diagram'): AiChatSession {
  const id = `session_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  return {
    id,
    title,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messages: [DEFAULT_WELCOME_MESSAGE],
  };
}

function formatStencilName(id: string): string {
  const clean = id.replace(/^(tech-|arch-)/, '');
  const words = clean.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1));
  return words.join(' ');
}

function formatTimeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 3600000);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function AiAssistant({
  diagramId = 'default',
  currentMermaidCode,
  onApplyDiagram,
  onInsertToCanvas,
  onInsertNativeCanvasDoc,
  onClose,
}: AiAssistantProps) {
  const storageKey = useMemo(() => `diagramz_ai_sessions_${diagramId}`, [diagramId]);
  const activeSessionKey = useMemo(() => `diagramz_ai_active_session_${diagramId}`, [diagramId]);

  // Load persisted sessions or initialize
  const [sessions, setSessions] = useState<AiChatSession[]>(() => {
    if (typeof window === 'undefined') return [createDefaultSession()];
    try {
      const raw = localStorage.getItem(`diagramz_ai_sessions_${diagramId}`);
      if (raw) {
        const parsed: AiChatSession[] = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('Failed to parse AI sessions from localStorage', e);
    }
    return [createDefaultSession()];
  });

  const [activeSessionId, setActiveSessionId] = useState<string>(() => {
    if (typeof window === 'undefined') return sessions[0]?.id || '';
    try {
      const savedActive = localStorage.getItem(`diagramz_ai_active_session_${diagramId}`);
      if (savedActive && sessions.some((s) => s.id === savedActive)) {
        return savedActive;
      }
    } catch {}
    return sessions[0]?.id || '';
  });

  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [provider] = useState<AiProvider>('gemini');
  const [showHistory, setShowHistory] = useState(false);
  const [insertedIndex, setInsertedIndex] = useState<number | null>(null);
  const [expandedMermaidIndex, setExpandedMermaidIndex] = useState<number | null>(null);

  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Active session object
  const activeSession = useMemo(() => {
    return sessions.find((s) => s.id === activeSessionId) || sessions[0] || createDefaultSession();
  }, [sessions, activeSessionId]);

  const messages = activeSession.messages;

  // Persist sessions and active session ID on change
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(sessions));
      localStorage.setItem(activeSessionKey, activeSessionId);
    } catch (e) {
      console.warn('Failed to save AI sessions to localStorage', e);
    }
  }, [sessions, activeSessionId, storageKey, activeSessionKey]);

  // Reload sessions if diagramId changes
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      const savedActive = localStorage.getItem(activeSessionKey);
      if (raw) {
        const parsed: AiChatSession[] = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSessions(parsed);
          setActiveSessionId(
            savedActive && parsed.some((s) => s.id === savedActive) ? savedActive : parsed[0].id
          );
          return;
        }
      }
      const fresh = [createDefaultSession()];
      setSessions(fresh);
      setActiveSessionId(fresh[0].id);
    } catch {
      const fresh = [createDefaultSession()];
      setSessions(fresh);
      setActiveSessionId(fresh[0].id);
    }
  }, [storageKey, activeSessionKey]);

  useEffect(() => {
    if (!showHistory) {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading, showHistory]);

  // Session Management Actions
  const handleNewChat = useCallback(() => {
    const newSession = createDefaultSession();
    setSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
    setShowHistory(false);
    toast.success('Started new chat session');
  }, []);

  const handleClearCurrentSession = useCallback(() => {
    setSessions((prev) =>
      prev.map((s) =>
        s.id === activeSession.id
          ? {
              ...s,
              title: 'New AI Diagram',
              updatedAt: Date.now(),
              messages: [DEFAULT_WELCOME_MESSAGE],
            }
          : s
      )
    );
    toast.success('Session cleared');
  }, [activeSession.id]);

  const handleDeleteSession = useCallback(
    (sessionId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setSessions((prev) => {
        const remaining = prev.filter((s) => s.id !== sessionId);
        if (remaining.length === 0) {
          const fresh = createDefaultSession();
          setActiveSessionId(fresh.id);
          return [fresh];
        }
        if (activeSessionId === sessionId) {
          setActiveSessionId(remaining[0].id);
        }
        return remaining;
      });
      toast.success('Session deleted');
    },
    [activeSessionId]
  );

  const handleClearAllHistory = useCallback(() => {
    const fresh = createDefaultSession();
    setSessions([fresh]);
    setActiveSessionId(fresh.id);
    setShowHistory(false);
    toast.success('All chat history cleared');
  }, []);

  // Update messages in active session
  const updateActiveSessionMessages = useCallback(
    (newMessages: Message[] | ((prev: Message[]) => Message[]), firstUserPrompt?: string) => {
      setSessions((prevSessions) =>
        prevSessions.map((session) => {
          if (session.id !== activeSession.id) return session;

          const updatedMessages =
            typeof newMessages === 'function' ? newMessages(session.messages) : newMessages;

          // Auto-title session if it was default
          let title = session.title;
          if (
            firstUserPrompt &&
            (session.title === 'New AI Diagram' || session.title === 'New Architecture Chat' || session.messages.length <= 1)
          ) {
            title = firstUserPrompt.length > 36 ? `${firstUserPrompt.slice(0, 36)}...` : firstUserPrompt;
          }

          return {
            ...session,
            title,
            updatedAt: Date.now(),
            messages: updatedMessages,
          };
        })
      );
    },
    [activeSession.id]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isLoading) return;

    const userPrompt = prompt.trim();
    const userMsg: Message = { role: 'user', content: userPrompt };

    updateActiveSessionMessages((prev) => [...prev, userMsg], userPrompt);
    setPrompt('');
    setIsLoading(true);

    try {
      const res = await apiClient.post('/ai/generate', {
        prompt: userPrompt,
        provider,
        currentDiagramCode: currentMermaidCode,
      });

      const { mermaidCode, canvasData, explanation } = res.data;
      const assistantMsg: Message = {
        role: 'assistant',
        explanation: explanation || 'Here is your diagram:',
        canvasData: canvasData || null,
        mermaidCode: mermaidCode || '',
      };

      updateActiveSessionMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      updateActiveSessionMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          explanation: `⚠️ **Generation failed**: ${err.response?.data?.message || err.message}`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyNative = (canvasData: any, index: number) => {
    if (onInsertNativeCanvasDoc && canvasData) {
      onInsertNativeCanvasDoc(canvasData);
      setInsertedIndex(index);
      setTimeout(() => setInsertedIndex(null), 2500);
    } else if (onInsertToCanvas && messages[index]?.mermaidCode) {
      handleApplyMermaid(messages[index].mermaidCode!, index);
    }
  };

  const handleApplyMermaid = (mermaidCode: string, index: number) => {
    onApplyDiagram(mermaidCode);
    if (onInsertToCanvas) {
      onInsertToCanvas(mermaidCode);
      toast.success('Inserted diagram components into canvas!');
    }
    setInsertedIndex(index);
    setTimeout(() => setInsertedIndex(null), 2500);
  };

  const templates = [
    'User Onboarding & Identity Verification Flowchart',
    'Customer Support & Refund Decision Tree',
    'AWS Serverless: API Gateway, Lambda, DynamoDB & S3',
    'E-Commerce ERD: Users, Orders, Products & Payments',
    'Event-driven Kafka streaming pipeline with microservices',
  ];

  return (
    <div className="flex flex-col h-full bg-card border-r border-border/50 text-card-foreground relative overflow-hidden select-none">
      {/* Header */}
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-border/50 bg-muted/30 shrink-0">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <Sparkles className="w-3.5 h-3.5 text-purple-500" />
          <span>Diagramz AI Assistant</span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* History Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowHistory((prev) => !prev)}
            className={cn(
              'h-7 px-2 text-[11px] rounded-lg text-muted-foreground hover:text-foreground cursor-pointer transition-colors',
              showHistory && 'bg-muted text-foreground'
            )}
            title="View chat history & sessions"
          >
            <History className="w-3.5 h-3.5 mr-1 text-purple-400" />
            <span>History</span>
            {sessions.length > 1 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full bg-purple-500/15 text-purple-400 text-[9.5px] font-mono">
                {sessions.length}
              </span>
            )}
          </Button>

          {/* New Chat Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleNewChat}
            className="h-7 px-2 text-[11px] rounded-lg text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
            title="Start new chat session"
          >
            <Plus className="w-3.5 h-3.5 mr-0.5 text-emerald-400" />
            <span>New</span>
          </Button>

          {/* Close Drawer Button */}
          {onClose && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-7 w-7 p-0 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer"
              title="Close AI Assistant drawer"
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Session History Overlay */}
      {showHistory ? (
        <div className="flex-1 flex flex-col bg-card/95 backdrop-blur-sm z-30 overflow-hidden">
          {/* History Header */}
          <div className="flex items-center justify-between px-3.5 py-2 border-b border-border/50 bg-muted/20">
            <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
              <Clock className="w-3.5 h-3.5 text-purple-400" />
              <span>Previous Chat Sessions ({sessions.length})</span>
            </div>
            {sessions.length > 0 && (
              <button
                type="button"
                onClick={handleClearAllHistory}
                className="text-[10.5px] text-red-400 hover:text-red-300 flex items-center gap-1 px-2 py-0.5 rounded hover:bg-red-500/10 cursor-pointer transition-colors"
                title="Clear all chat sessions"
              >
                <Trash2 className="w-3 h-3" />
                <span>Clear All</span>
              </button>
            )}
          </div>

          {/* Sessions List */}
          <div className="flex-1 eraser-doc-scroll overflow-y-auto p-3 space-y-2 text-xs">
            {sessions.map((sess) => {
              const isActive = sess.id === activeSessionId;
              const userMsgs = sess.messages.filter((m) => m.role === 'user');
              return (
                <div
                  key={sess.id}
                  onClick={() => {
                    setActiveSessionId(sess.id);
                    setShowHistory(false);
                  }}
                  className={cn(
                    'group p-2.5 rounded-xl border transition-all cursor-pointer flex flex-col gap-1',
                    isActive
                      ? 'border-purple-500/40 bg-purple-500/10 text-foreground shadow-2xs'
                      : 'border-border/60 bg-muted/20 hover:bg-muted/40 text-foreground/80'
                  )}
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <div className="flex items-center gap-1.5 truncate">
                      <MessageSquare
                        className={cn(
                          'w-3.5 h-3.5 shrink-0',
                          isActive ? 'text-purple-400' : 'text-muted-foreground'
                        )}
                      />
                      <span className="font-medium truncate text-[11.5px]">{sess.title}</span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {isActive && (
                        <span className="text-[9.5px] px-1.5 py-0.2 rounded-full bg-purple-500/20 text-purple-300 font-mono">
                          Active
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={(e) => handleDeleteSession(sess.id, e)}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/20 text-muted-foreground hover:text-red-400 transition-all cursor-pointer"
                        title="Delete session"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-0.5">
                    <span>{formatTimeAgo(sess.updatedAt)}</span>
                    <span>
                      {sess.messages.length} {sess.messages.length === 1 ? 'message' : 'messages'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* History Footer */}
          <div className="p-3 border-t border-border/50 bg-muted/20 flex gap-2">
            <Button
              size="sm"
              onClick={handleNewChat}
              className="flex-1 h-7.5 text-xs rounded-lg font-medium cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Start New Chat
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowHistory(false)}
              className="h-7.5 text-xs rounded-lg font-medium cursor-pointer"
            >
              Back to Chat
            </Button>
          </div>
        </div>
      ) : (
        <>
          {/* Active Session Subheader */}
          <div className="flex items-center justify-between px-3.5 py-1.5 border-b border-border/40 bg-muted/15 text-[11px] shrink-0">
            <div className="flex items-center gap-1.5 truncate text-muted-foreground max-w-[240px]">
              <MessageSquare className="w-3 h-3 text-purple-400 shrink-0" />
              <span className="truncate font-medium text-foreground/90">{activeSession.title}</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleClearCurrentSession}
                className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-muted/50 cursor-pointer transition-colors"
                title="Clear messages in this session"
              >
                <RotateCcw className="w-2.5 h-2.5" />
                <span>Clear</span>
              </button>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 eraser-doc-scroll overflow-y-auto p-3.5 space-y-3.5 text-xs select-text">
            {messages.map((msg, i) => {
              const isUser = msg.role === 'user';
              const isInserted = insertedIndex === i;
              const isMermaidExpanded = expandedMermaidIndex === i;

              // For assistant messages, parse unique tech and arch stencils if canvasData exists
              const detectedStencils: string[] = [];
              if (msg.canvasData?.nodes && Array.isArray(msg.canvasData.nodes)) {
                const seen = new Set<string>();
                for (const n of msg.canvasData.nodes) {
                  const id = n.data?.techLogoId || n.data?.stencilId;
                  if (id && !seen.has(id)) {
                    seen.add(id);
                    detectedStencils.push(id);
                  }
                }
              }

              return (
                <div
                  key={i}
                  className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[95%] p-3.5 ${
                      isUser
                        ? 'bg-primary text-primary-foreground font-medium rounded-2xl rounded-tr-xs shadow-xs'
                        : 'bg-muted/40 text-foreground border border-border/60 rounded-2xl rounded-tl-xs shadow-2xs'
                    }`}
                  >
                    {/* Markdown Explanation */}
                    <div className={cn(
                      'prose prose-xs dark:prose-invert max-w-none leading-relaxed text-[11.5px]',
                      isUser ? 'text-white/90' : 'text-foreground/90'
                    )}>
                      <ReactMarkdown
                        components={{
h1: ({ children }) => (
                            <h1 className={cn('text-sm font-bold', isUser ? 'text-white' : 'text-foreground', 'mt-2 mb-1.5 flex items-center gap-1.5')}>
                              {children}
                            </h1>
                          ),
                          h2: ({ children }) => (
                            <h2 className={cn('text-xs font-bold', isUser ? 'text-white' : 'text-foreground', 'mt-2 mb-1')}>
                              {children}
                            </h2>
                          ),
                          h3: ({ children }) => (
                            <h3 className={cn('text-[11.5px] font-semibold', isUser ? 'text-white' : 'text-foreground', 'mt-1.5 mb-0.5')}>
                              {children}
                            </h3>
                          ),
                          p: ({ children }) => (
                            <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>
                          ),
                          ul: ({ children }) => (
                            <ul className="list-disc pl-4 mb-2 space-y-1">{children}</ul>
                          ),
                          ol: ({ children }) => (
                            <ol className="list-decimal pl-4 mb-2 space-y-1">{children}</ol>
                          ),
                          li: ({ children }) => (
                            <li className="leading-relaxed">{children}</li>
                          ),
                          strong: ({ children }) => (
                            <strong className={cn('font-semibold', isUser ? 'text-white' : 'text-foreground')}>
                              {children}
                            </strong>
                          ),
                          blockquote: ({ children }) => (
                            <blockquote className={cn(
                              'border-l-2 pl-2.5 py-0.5 my-2 italic rounded-r',
                              isUser ? 'bg-white/10 text-white' : 'border-primary/50 bg-muted/20 text-muted-foreground'
                            )}>
                              {children}
                            </blockquote>
                          ),
                          code: ({ className, children, ...props }) => {
                            const isInline = !className && typeof children === 'string' && !children.includes('\n');
                            if (isInline) {
                              return (
                            <code
                                   className={cn(
                                     'px-1.5 py-0.5 rounded bg-white/20 font-mono text-[10.5px]',
                                     isUser ? 'text-white' : 'text-primary font-medium',
                                     className
                                   )}
                                   {...props}
                                 >
                                   {children}
                                 </code>
                               );
                            }
                            return (
                              <code
                                className={cn(
                                  'block p-2 bg-white/10 rounded-lg font-mono text-[10.5px] overflow-x-auto my-1.5 border border-white/20',
                                  isUser ? 'text-white' : 'text-foreground',
                                  className
                                )}
                                {...props}
                              >
                                {children}
                              </code>
                            );
                          },
                        }}
                      >
                        {msg.explanation || msg.content || ''}
                      </ReactMarkdown>
                    </div>

                    {/* Native Diagramz Card */}
                    {msg.canvasData && msg.canvasData.nodes?.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-border/60">
                        <div className="rounded-xl border border-purple-500/30 bg-purple-500/5 p-3 space-y-2.5">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <Layers className="w-4 h-4 text-purple-400" />
                              <span className="text-xs font-semibold text-foreground">
                                Native Diagramz Diagram
                              </span>
                            </div>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 font-medium">
                              {msg.canvasData.nodes.length} nodes · {msg.canvasData.edges?.length || 0} edges
                            </span>
                          </div>

                          {/* Detected Stencils and Tech Logos */}
                          {detectedStencils.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 items-center pt-0.5">
                              {detectedStencils.slice(0, 8).map((stencilId) => (
                                <div
                                  key={stencilId}
                                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-background/80 border border-border/70 text-[10.5px] text-foreground/90 font-medium shadow-2xs"
                                  title={stencilId}
                                >
                                  <div className="w-3.5 h-3.5 flex items-center justify-center shrink-0">
                                    <ZCanvasStencilGraphic
                                      id={stencilId}
                                      width={14}
                                      height={14}
                                      isDark={true}
                                    />
                                  </div>
                                  <span className="truncate max-w-[90px]">{formatStencilName(stencilId)}</span>
                                </div>
                              ))}
                              {detectedStencils.length > 8 && (
                                <span className="text-[10px] text-muted-foreground font-mono">
                                  +{detectedStencils.length - 8} more
                                </span>
                              )}
                            </div>
                          )}

                          {/* Primary Insert Button */}
                          <Button
                            size="sm"
                            onClick={() => handleApplyNative(msg.canvasData, i)}
                            className="w-full h-8 text-xs font-semibold rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-sm transition-all cursor-pointer"
                          >
                            {isInserted ? (
                              <>
                                <Check className="w-3.5 h-3.5 mr-1.5 text-white" />
                                Diagram Placed on Canvas!
                              </>
                            ) : (
                              <>
                                <Sparkles className="w-3.5 h-3.5 mr-1.5 text-purple-200" />
                                Insert Diagram to Canvas
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Optional Mermaid Accordion */}
                    {msg.mermaidCode && (
                      <div className="mt-2.5 pt-2 border-t border-border/40">
                        <button
                          type="button"
                          onClick={() => setExpandedMermaidIndex(isMermaidExpanded ? null : i)}
                          className="flex items-center justify-between w-full text-[10.5px] font-medium text-muted-foreground hover:text-foreground py-1 px-1 rounded-md transition-colors cursor-pointer"
                        >
                          <span className="flex items-center gap-1.5">
                            <Code2 className="w-3.5 h-3.5 text-muted-foreground" />
                            <span>Mermaid Definition (Optional)</span>
                          </span>
                          {isMermaidExpanded ? (
                            <ChevronUp className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5" />
                          )}
                        </button>

                        {isMermaidExpanded && (
                          <div className="mt-2 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
                                Source Syntax
                              </span>
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => handleApplyMermaid(msg.mermaidCode!, i)}
                                className="h-6.5 text-[10px] px-2 font-medium rounded-md cursor-pointer"
                              >
                                {isInserted ? (
                                  <Check className="w-3 h-3 mr-1 text-emerald-500" />
                                ) : (
                                  <Box className="w-3 h-3 mr-1 text-purple-400" />
                                )}
                                Insert Mermaid
                              </Button>
                            </div>
                            <pre className="p-2.5 bg-background/90 rounded-xl text-[10.5px] font-mono overflow-x-auto text-foreground border border-border/60 max-h-48">
                              {msg.mermaidCode}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {isLoading && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 p-2.5 rounded-xl border border-border/50 w-fit">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-400" />
                <span>Generating diagram components & layout...</span>
              </div>
            )}
            <div ref={chatBottomRef} />
          </div>

          {/* Suggested Templates */}
          {messages.length <= 2 && (
            <div className="px-3.5 py-2.5 border-t border-border/50 bg-muted/15 shrink-0">
              <div className="text-[10px] uppercase font-semibold text-muted-foreground/70 mb-1.5 flex items-center gap-1">
                <Cpu className="w-3 h-3" />
                <span>Quick Prompts:</span>
              </div>
              <div className="space-y-1">
                {templates.map((tpl, idx) => (
                  <button
                    key={idx}
                    onClick={() => setPrompt(tpl)}
                    className="w-full text-left text-[11px] text-muted-foreground hover:text-foreground bg-muted/30 hover:bg-muted/60 px-2.5 py-1.5 rounded-lg truncate transition-colors cursor-pointer"
                  >
                    • {tpl}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Prompt Form */}
          <form
            onSubmit={handleSubmit}
            className="p-2.5 border-t border-border/50 bg-card flex gap-1.5 items-center shrink-0"
          >
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe any diagram, workflow, or architecture to generate..."
              disabled={isLoading}
              className="flex-1 bg-muted/30 border border-border/60 rounded-xl px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:bg-background transition-colors"
            />
            <Button
              type="submit"
              size="sm"
              disabled={isLoading || !prompt.trim()}
              className="h-8 w-8 p-0 rounded-xl font-medium shadow-xs cursor-pointer"
            >
              {isLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
            </Button>
          </form>
        </>
      )}
    </div>
  );
}
