'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Bold,
  Italic,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  CheckSquare,
  Code,
  Quote,
  FileCode,
  Copy,
  Check,
  Send,
  Plus,
  Edit2,
  FileText,
  Sparkles,
  Code2,
  Undo2,
  Minus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface DocumentEditorProps {
  initialContent?: string | null;
  onChange?: (content: string) => void;
  className?: string;
  readOnly?: boolean;
  onInsertMermaidToCanvas?: (code: string) => void;
  viewLayoutMode?: 'both' | 'doc' | 'canvas';
}

interface ParsedBlock {
  id: string;
  type: 'h1' | 'h2' | 'h3' | 'todo' | 'bullet' | 'number' | 'code' | 'quote' | 'divider' | 'p';
  raw: string;
  text: string;
  checked?: boolean;
  lang?: string;
  code?: string;
  num?: string;
}

/**
 * Parses raw Markdown text into structured blocks for live in-place rendering & editing.
 */
function parseMarkdownToBlocks(markdown: string): ParsedBlock[] {
  const lines = markdown.split('\n');
  const blocks: ParsedBlock[] = [];
  let inCodeBlock = false;
  let codeLang = '';
  let codeBuffer: string[] = [];
  let codeBlockRaw: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Handle code fence starts/ends
    if (line.trim().startsWith('```')) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeLang = line.trim().slice(3).trim() || 'text';
        codeBuffer = [];
        codeBlockRaw = [line];
        continue;
      } else {
        inCodeBlock = false;
        codeBlockRaw.push(line);
        blocks.push({
          id: `block-${blocks.length}`,
          type: 'code',
          raw: codeBlockRaw.join('\n'),
          text: codeBuffer.join('\n'),
          lang: codeLang,
          code: codeBuffer.join('\n'),
        });
        codeBuffer = [];
        codeBlockRaw = [];
        continue;
      }
    }

    if (inCodeBlock) {
      codeBuffer.push(line);
      codeBlockRaw.push(line);
      continue;
    }

    const trimmed = line.trim();

    // Horizontal Rule
    if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
      blocks.push({
        id: `block-${blocks.length}`,
        type: 'divider',
        raw: line,
        text: '',
      });
      continue;
    }

    // Heading 1
    if (line.startsWith('# ')) {
      blocks.push({
        id: `block-${blocks.length}`,
        type: 'h1',
        raw: line,
        text: line.slice(2),
      });
      continue;
    }

    // Heading 2
    if (line.startsWith('## ')) {
      blocks.push({
        id: `block-${blocks.length}`,
        type: 'h2',
        raw: line,
        text: line.slice(3),
      });
      continue;
    }

    // Heading 3
    if (line.startsWith('### ')) {
      blocks.push({
        id: `block-${blocks.length}`,
        type: 'h3',
        raw: line,
        text: line.slice(4),
      });
      continue;
    }

    // Todo / Checklist Item
    if (line.startsWith('- [ ] ') || line.startsWith('- [x] ') || line.startsWith('- [X] ')) {
      const isChecked = line.startsWith('- [x] ') || line.startsWith('- [X] ');
      blocks.push({
        id: `block-${blocks.length}`,
        type: 'todo',
        raw: line,
        text: line.slice(6),
        checked: isChecked,
      });
      continue;
    }

    // Bullet List
    if (line.startsWith('- ') || line.startsWith('* ')) {
      blocks.push({
        id: `block-${blocks.length}`,
        type: 'bullet',
        raw: line,
        text: line.slice(2),
      });
      continue;
    }

    // Numbered List
    const numMatch = line.match(/^(\d+)\.\s+(.*)$/);
    if (numMatch) {
      blocks.push({
        id: `block-${blocks.length}`,
        type: 'number',
        raw: line,
        num: numMatch[1],
        text: numMatch[2],
      });
      continue;
    }

    // Quote / Callout
    if (line.startsWith('> ')) {
      blocks.push({
        id: `block-${blocks.length}`,
        type: 'quote',
        raw: line,
        text: line.slice(2),
      });
      continue;
    }

    // Blank line or standard paragraph
    blocks.push({
      id: `block-${blocks.length}`,
      type: 'p',
      raw: line,
      text: line,
    });
  }

  // If code block was not closed
  if (inCodeBlock) {
    blocks.push({
      id: `block-${blocks.length}`,
      type: 'code',
      raw: codeBlockRaw.join('\n'),
      text: codeBuffer.join('\n'),
      lang: codeLang,
      code: codeBuffer.join('\n'),
    });
  }

  return blocks;
}

/**
 * Reassembles parsed blocks back into canonical Markdown string.
 */
function rebuildMarkdown(blocks: ParsedBlock[]): string {
  return blocks
    .map((b) => {
      switch (b.type) {
        case 'h1':
          return `# ${b.text}`;
        case 'h2':
          return `## ${b.text}`;
        case 'h3':
          return `### ${b.text}`;
        case 'todo':
          return `- [${b.checked ? 'x' : ' '}] ${b.text}`;
        case 'bullet':
          return `- ${b.text}`;
        case 'number':
          return `${b.num || '1'}. ${b.text}`;
        case 'quote':
          return `> ${b.text}`;
        case 'code':
          return `\`\`\`${b.lang || 'text'}\n${b.code || ''}\n\`\`\``;
        case 'divider':
          return '---';
        case 'p':
        default:
          return b.text;
      }
    })
    .join('\n');
}

/**
 * Lightweight inline markdown formatter for bold, italic, and inline code.
 */
function renderInlineFormatting(text: string) {
  if (!text) return null;
  const parts: React.ReactNode[] = [];
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let lastIndex = 0;
  let match;
  let key = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith('`') && token.endsWith('`')) {
      parts.push(
        <code
          key={key++}
          className="px-1.5 py-0.5 rounded bg-muted/80 font-mono text-[11px] text-foreground border border-border/40 font-medium"
        >
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith('**') && token.endsWith('**')) {
      parts.push(
        <strong key={key++} className="font-semibold text-foreground">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith('*') && token.endsWith('*')) {
      parts.push(
        <em key={key++} className="italic text-foreground">
          {token.slice(1, -1)}
        </em>
      );
    }
    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts.length > 0 ? parts : text;
}

export function DocumentEditor({
  initialContent = '',
  onChange,
  className,
  readOnly = false,
  onInsertMermaidToCanvas,
  viewLayoutMode = 'both',
}: DocumentEditorProps) {
  const [content, setContent] = useState<string>(initialContent || '');
  const [blocks, setBlocks] = useState<ParsedBlock[]>(() =>
    parseMarkdownToBlocks(initialContent || '')
  );
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState<string>('');
  const [viewMode, setViewMode] = useState<'live' | 'source'>('live');
  const [copiedBlockId, setCopiedBlockId] = useState<string | null>(null);

  const rawTextareaRef = useRef<HTMLTextAreaElement>(null);
  const inlineInputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  // Sync incoming initial content
  useEffect(() => {
    const val = initialContent || '';
    setContent(val);
    setBlocks(parseMarkdownToBlocks(val));
  }, [initialContent]);

  // Update both content and notify parent
  const updateContent = useCallback(
    (newContent: string) => {
      setContent(newContent);
      setBlocks(parseMarkdownToBlocks(newContent));
      onChange?.(newContent);
    },
    [onChange]
  );

  // Handle direct raw textarea typing in 'source' view
  const handleRawChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    updateContent(val);
  };

  // Checkbox toggle: instantly updates the markdown state without entering edit mode
  const handleToggleTodo = (blockIndex: number) => {
    if (readOnly) return;
    const nextBlocks = [...blocks];
    const b = nextBlocks[blockIndex];
    if (b && b.type === 'todo') {
      b.checked = !b.checked;
      const nextContent = rebuildMarkdown(nextBlocks);
      updateContent(nextContent);
    }
  };

  // Start in-place editing of a block
  const handleStartEdit = (block: ParsedBlock) => {
    if (readOnly) return;
    setEditingBlockId(block.id);
    setEditingValue(block.type === 'code' ? block.code || '' : block.text);
    setTimeout(() => {
      inlineInputRef.current?.focus();
    }, 20);
  };

  // Commit in-place editing of a block
  const handleCommitEdit = (blockIndex: number) => {
    if (!editingBlockId) return;
    const nextBlocks = [...blocks];
    const b = nextBlocks[blockIndex];
    if (b) {
      if (b.type === 'code') {
        b.code = editingValue;
        b.text = editingValue;
      } else {
        b.text = editingValue;
      }
      const nextContent = rebuildMarkdown(nextBlocks);
      updateContent(nextContent);
    }
    setEditingBlockId(null);
    setEditingValue('');
  };

  // Cancel edit
  const handleCancelEdit = () => {
    setEditingBlockId(null);
    setEditingValue('');
  };

  // Quick insertion helpers for top formatting toolbar
  const insertSnippet = (prefix: string, suffix = '') => {
    if (readOnly) return;
    const addition = `${prefix}${suffix ? 'text' + suffix : ''}\n`;
    const nextContent = content ? `${content.trimEnd()}\n\n${addition}` : addition;
    updateContent(nextContent);
  };

  // Copy code block contents
  const handleCopyCode = async (blockId: string, codeText: string) => {
    try {
      await navigator.clipboard.writeText(codeText);
      setCopiedBlockId(blockId);
      toast.success('Code copied to clipboard');
      setTimeout(() => setCopiedBlockId(null), 2000);
    } catch {
      toast.error('Failed to copy code');
    }
  };

  // Word count & Char count
  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;

  return (
    <div
      className={cn(
        'flex flex-col h-full bg-background text-foreground select-none overflow-hidden',
        className
      )}
    >
      {/* ─── Eraser Top Action Bar ─── */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/70 bg-card/60 backdrop-blur-xs text-muted-foreground gap-2 shrink-0">
        {/* Left: Quick Formatting Toolbar */}
        {!readOnly ? (
          <div className="flex items-center gap-0.5 overflow-x-auto py-0.5">
            <Button
              size="icon"
              variant="ghost"
              className="size-7 hover:bg-muted text-muted-foreground hover:text-foreground"
              title="Heading 1"
              onClick={() => insertSnippet('# Heading 1')}
            >
              <Heading1 className="size-3.5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="size-7 hover:bg-muted text-muted-foreground hover:text-foreground"
              title="Heading 2"
              onClick={() => insertSnippet('## Heading 2')}
            >
              <Heading2 className="size-3.5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="size-7 hover:bg-muted text-muted-foreground hover:text-foreground"
              title="Heading 3"
              onClick={() => insertSnippet('### Heading 3')}
            >
              <Heading3 className="size-3.5" />
            </Button>

            <div className="w-[1px] h-4 bg-border/60 mx-1 shrink-0" />

            <Button
              size="icon"
              variant="ghost"
              className="size-7 hover:bg-muted text-muted-foreground hover:text-foreground"
              title="Task Checklist"
              onClick={() => insertSnippet('- [ ] Task description')}
            >
              <CheckSquare className="size-3.5 text-primary" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="size-7 hover:bg-muted text-muted-foreground hover:text-foreground"
              title="Bullet List"
              onClick={() => insertSnippet('- List item')}
            >
              <List className="size-3.5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="size-7 hover:bg-muted text-muted-foreground hover:text-foreground"
              title="Numbered List"
              onClick={() => insertSnippet('1. First item')}
            >
              <ListOrdered className="size-3.5" />
            </Button>

            <div className="w-[1px] h-4 bg-border/60 mx-1 shrink-0" />

            <Button
              size="icon"
              variant="ghost"
              className="size-7 hover:bg-muted text-muted-foreground hover:text-foreground"
              title="Code Block"
              onClick={() => insertSnippet('```typescript\n// Technical spec implementation\n', '```')}
            >
              <Code className="size-3.5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="size-7 hover:bg-muted text-muted-foreground hover:text-foreground"
              title="Callout Note"
              onClick={() => insertSnippet('> **Note:** Important architectural decision.')}
            >
              <Quote className="size-3.5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="size-7 hover:bg-muted text-muted-foreground hover:text-foreground"
              title="Insert Mermaid Diagram"
              onClick={() =>
                insertSnippet('```mermaid\nflowchart TD\n  Client[Web App] --> Gateway[API Gateway]\n  Gateway --> Service[Core Microservice]\n```')
              }
            >
              <FileCode className="size-3.5 text-blue-500" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground px-1">
            <FileText className="size-3.5 text-primary" />
            <span className="font-medium text-foreground">Technical Specification</span>
            <Badge variant="outline" className="text-[10px] h-4.5 px-1.5 ml-1 font-normal">
              Read Only
            </Badge>
          </div>
        )}

        {/* Right: Mode Toggle (Live Document vs Raw Markdown) & Word Count */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="hidden sm:inline text-[11px] text-muted-foreground/70 font-mono">
            {wordCount} words
          </span>

          {!readOnly && (
            <div className="flex items-center bg-muted/60 p-0.5 rounded-lg border border-border/60 text-xs">
              <button
                type="button"
                onClick={() => setViewMode('live')}
                className={cn(
                  'px-2 py-1 rounded-md text-[11px] font-medium transition-all flex items-center gap-1 cursor-pointer',
                  viewMode === 'live'
                    ? 'bg-background text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                )}
                title="Live rendered document with in-place editing (Eraser style)"
              >
                <Sparkles className="size-3 text-primary" />
                <span>Live Doc</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('source')}
                className={cn(
                  'px-2 py-1 rounded-md text-[11px] font-medium transition-all flex items-center gap-1 cursor-pointer',
                  viewMode === 'source'
                    ? 'bg-background text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                )}
                title="Edit raw Markdown source code"
              >
                <Code2 className="size-3" />
                <span>Source</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ─── Document Editor Body with Smooth Custom Scrollbar ─── */}
      <div
        className={cn(
          'flex-1 eraser-doc-scroll overflow-y-auto select-text',
          viewLayoutMode === 'doc' ? 'px-8 md:px-16 py-10' : 'px-6 md:px-8 py-6'
        )}
      >
        {viewMode === 'source' && !readOnly ? (
          /* Raw Markdown Source Mode */
          <div className={cn('mx-auto h-full flex flex-col', viewLayoutMode === 'doc' ? 'max-w-4xl' : 'max-w-3xl')}>
            <textarea
              ref={rawTextareaRef}
              value={content}
              onChange={handleRawChange}
              placeholder="# Write your technical spec or notes here in Markdown..."
              className="w-full flex-1 min-h-[500px] bg-transparent border-0 outline-none resize-none font-mono text-sm text-foreground placeholder:text-muted-foreground/50 leading-relaxed select-text"
            />
          </div>
        ) : (
          /* Live Document Mode (Eraser style: already previewed, with click-to-edit) */
          <div
            className={cn(
              'mx-auto space-y-4 pb-32 transition-all duration-150',
              viewLayoutMode === 'doc' ? 'max-w-4xl' : 'max-w-3xl'
            )}
          >
            {blocks.length === 0 || (blocks.length === 1 && !blocks[0].text.trim()) ? (
              <div
                onClick={() => {
                  if (!readOnly) {
                    updateContent('# Architecture Specification\n\nClick here to start writing your technical document or RFC notes...');
                  }
                }}
                className="py-16 text-center text-sm text-muted-foreground/60 border border-dashed border-border/60 rounded-2xl cursor-pointer hover:border-primary/40 transition-colors"
              >
                <FileText className="size-8 mx-auto mb-2 text-muted-foreground/30" />
                <p className="font-semibold text-foreground">Empty Document</p>
                <p className="mt-1 text-muted-foreground/70 text-xs">
                  {!readOnly ? 'Click anywhere here or use the toolbar above to start writing.' : 'No notes written yet.'}
                </p>
              </div>
            ) : (
              blocks.map((block, idx) => {
                const isEditing = editingBlockId === block.id;

                // ─── Heading 1 ───
                if (block.type === 'h1') {
                  if (isEditing) {
                    return (
                      <div key={block.id} className="my-4 pb-2 border-b border-border/50">
                        <input
                          ref={inlineInputRef as any}
                          type="text"
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          onBlur={() => handleCommitEdit(idx)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleCommitEdit(idx);
                            if (e.key === 'Escape') handleCancelEdit();
                          }}
                          className="w-full bg-muted/30 border border-primary/40 rounded-lg px-2.5 py-1 text-2xl md:text-3xl font-bold text-foreground outline-none tracking-tight"
                        />
                      </div>
                    );
                  }
                  return (
                    <h1
                      key={block.id}
                      onClick={() => handleStartEdit(block)}
                      className="text-2xl md:text-3xl font-bold tracking-tight text-foreground my-4 pb-2 border-b border-border/50 group flex items-center justify-between cursor-pointer hover:text-primary transition-colors"
                      title={readOnly ? undefined : 'Click to edit heading'}
                    >
                      <span>{renderInlineFormatting(block.text) || <span className="text-muted-foreground/50">Untitled Heading</span>}</span>
                      {!readOnly && (
                        <Edit2 className="size-3.5 text-muted-foreground/0 group-hover:text-muted-foreground/40 transition-colors shrink-0 ml-2" />
                      )}
                    </h1>
                  );
                }

                // ─── Heading 2 ───
                if (block.type === 'h2') {
                  if (isEditing) {
                    return (
                      <div key={block.id} className="mt-6 mb-2.5">
                        <input
                          ref={inlineInputRef as any}
                          type="text"
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          onBlur={() => handleCommitEdit(idx)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleCommitEdit(idx);
                            if (e.key === 'Escape') handleCancelEdit();
                          }}
                          className="w-full bg-muted/30 border border-primary/40 rounded-lg px-2.5 py-1 text-xl font-bold text-foreground outline-none tracking-tight"
                        />
                      </div>
                    );
                  }
                  return (
                    <h2
                      key={block.id}
                      onClick={() => handleStartEdit(block)}
                      className="text-xl font-bold tracking-tight text-foreground mt-6 mb-2.5 group flex items-center justify-between cursor-pointer hover:text-primary transition-colors"
                      title={readOnly ? undefined : 'Click to edit heading'}
                    >
                      <span>{renderInlineFormatting(block.text)}</span>
                      {!readOnly && (
                        <Edit2 className="size-3.5 text-muted-foreground/0 group-hover:text-muted-foreground/40 transition-colors shrink-0 ml-2" />
                      )}
                    </h2>
                  );
                }

                // ─── Heading 3 ───
                if (block.type === 'h3') {
                  if (isEditing) {
                    return (
                      <div key={block.id} className="mt-4 mb-2">
                        <input
                          ref={inlineInputRef as any}
                          type="text"
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          onBlur={() => handleCommitEdit(idx)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleCommitEdit(idx);
                            if (e.key === 'Escape') handleCancelEdit();
                          }}
                          className="w-full bg-muted/30 border border-primary/40 rounded-lg px-2 py-0.5 text-base font-semibold text-foreground outline-none"
                        />
                      </div>
                    );
                  }
                  return (
                    <h3
                      key={block.id}
                      onClick={() => handleStartEdit(block)}
                      className="text-base font-semibold text-foreground mt-4 mb-2 group flex items-center justify-between cursor-pointer hover:text-primary transition-colors"
                      title={readOnly ? undefined : 'Click to edit heading'}
                    >
                      <span>{renderInlineFormatting(block.text)}</span>
                      {!readOnly && (
                        <Edit2 className="size-3 text-muted-foreground/0 group-hover:text-muted-foreground/40 transition-colors shrink-0 ml-2" />
                      )}
                    </h3>
                  );
                }

                // ─── Interactive Todo Checklist Item ───
                if (block.type === 'todo') {
                  return (
                    <div
                      key={block.id}
                      className="flex items-start gap-3 my-2 group text-sm text-foreground/90 select-none"
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleTodo(idx);
                        }}
                        className={cn(
                          'size-4.5 rounded-md border flex items-center justify-center transition-all mt-0.5 shrink-0 cursor-pointer shadow-2xs',
                          block.checked
                            ? 'bg-primary border-primary text-primary-foreground'
                            : 'border-border/80 hover:border-primary/60 bg-muted/20 hover:bg-muted/40'
                        )}
                        title={block.checked ? 'Mark as incomplete' : 'Mark as complete'}
                      >
                        {block.checked && <Check className="size-3 stroke-[3]" />}
                      </button>

                      {isEditing ? (
                        <input
                          ref={inlineInputRef as any}
                          type="text"
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          onBlur={() => handleCommitEdit(idx)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleCommitEdit(idx);
                            if (e.key === 'Escape') handleCancelEdit();
                          }}
                          className="flex-1 bg-muted/30 border border-primary/40 rounded px-2 py-0.5 text-sm text-foreground outline-none"
                        />
                      ) : (
                        <span
                          onClick={() => handleStartEdit(block)}
                          className={cn(
                            'flex-1 leading-relaxed cursor-pointer select-text',
                            block.checked && 'line-through text-muted-foreground/70'
                          )}
                          title={readOnly ? undefined : 'Click to edit text'}
                        >
                          {renderInlineFormatting(block.text)}
                        </span>
                      )}
                    </div>
                  );
                }

                // ─── Bullet List ───
                if (block.type === 'bullet') {
                  if (isEditing) {
                    return (
                      <div key={block.id} className="ml-5 my-1.5">
                        <input
                          ref={inlineInputRef as any}
                          type="text"
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          onBlur={() => handleCommitEdit(idx)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleCommitEdit(idx);
                            if (e.key === 'Escape') handleCancelEdit();
                          }}
                          className="w-full bg-muted/30 border border-primary/40 rounded px-2 py-0.5 text-sm text-foreground outline-none"
                        />
                      </div>
                    );
                  }
                  return (
                    <li
                      key={block.id}
                      onClick={() => handleStartEdit(block)}
                      className="ml-5 list-disc text-sm text-foreground/85 my-1.5 leading-relaxed cursor-pointer hover:text-foreground transition-colors"
                      title={readOnly ? undefined : 'Click to edit'}
                    >
                      {renderInlineFormatting(block.text)}
                    </li>
                  );
                }

                // ─── Numbered List ───
                if (block.type === 'number') {
                  if (isEditing) {
                    return (
                      <div key={block.id} className="ml-2 my-1.5">
                        <input
                          ref={inlineInputRef as any}
                          type="text"
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          onBlur={() => handleCommitEdit(idx)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleCommitEdit(idx);
                            if (e.key === 'Escape') handleCancelEdit();
                          }}
                          className="w-full bg-muted/30 border border-primary/40 rounded px-2 py-0.5 text-sm text-foreground outline-none"
                        />
                      </div>
                    );
                  }
                  return (
                    <div
                      key={block.id}
                      onClick={() => handleStartEdit(block)}
                      className="ml-2 flex items-start gap-2.5 text-sm text-foreground/85 my-1.5 leading-relaxed cursor-pointer"
                      title={readOnly ? undefined : 'Click to edit'}
                    >
                      <span className="font-mono text-muted-foreground/80 shrink-0 font-medium">{block.num}.</span>
                      <span className="flex-1">{renderInlineFormatting(block.text)}</span>
                    </div>
                  );
                }

                // ─── Blockquote / Callout ───
                if (block.type === 'quote') {
                  if (isEditing) {
                    return (
                      <div key={block.id} className="my-3.5">
                        <textarea
                          ref={inlineInputRef as any}
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          onBlur={() => handleCommitEdit(idx)}
                          className="w-full bg-muted/40 border border-primary/40 rounded-lg p-2.5 text-sm italic text-foreground outline-none resize-none leading-relaxed"
                          rows={2}
                        />
                      </div>
                    );
                  }
                  return (
                    <blockquote
                      key={block.id}
                      onClick={() => handleStartEdit(block)}
                      className="my-3.5 border-l-3 border-blue-500/80 bg-blue-500/[0.04] dark:bg-blue-500/[0.08] px-4 py-3 rounded-r-xl text-sm text-foreground/85 italic leading-relaxed cursor-pointer hover:bg-blue-500/[0.07] transition-colors"
                      title={readOnly ? undefined : 'Click to edit callout'}
                    >
                      {renderInlineFormatting(block.text)}
                    </blockquote>
                  );
                }

                // ─── Code Block (Syntax Styling + Copy + Mermaid Canvas Action) ───
                if (block.type === 'code') {
                  const isMermaid = (block.lang || '').toLowerCase() === 'mermaid';

                  if (isEditing) {
                    return (
                      <div key={block.id} className="my-3.5 rounded-xl border border-primary/50 bg-muted/40 p-3.5 shadow-2xs">
                        <div className="flex items-center justify-between pb-2 mb-2 border-b border-border/60 text-[11px] text-muted-foreground">
                          <span className="font-mono font-medium uppercase tracking-wider">{block.lang || 'code'}</span>
                          <Button
                            size="sm"
                            variant="secondary"
                            className="h-6 text-[11px] px-2"
                            onClick={() => handleCommitEdit(idx)}
                          >
                            Done Editing
                          </Button>
                        </div>
                        <textarea
                          ref={inlineInputRef as any}
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          onBlur={() => handleCommitEdit(idx)}
                          className="w-full bg-transparent border-0 outline-none font-mono text-xs text-foreground leading-relaxed resize-y min-h-[100px]"
                        />
                      </div>
                    );
                  }

                  return (
                    <div
                      key={block.id}
                      className={cn(
                        'my-3.5 rounded-xl border overflow-hidden transition-all shadow-2xs',
                        isMermaid
                          ? 'border-blue-500/30 bg-blue-500/[0.03]'
                          : 'border-border/70 bg-card/60'
                      )}
                    >
                      {/* Code Block Header */}
                      <div className="flex items-center justify-between px-3.5 py-1.5 bg-muted/50 border-b border-border/50 text-[11px] text-muted-foreground font-mono">
                        <div className="flex items-center gap-1.5">
                          <Code className="size-3 text-muted-foreground/70" />
                          <span className="font-medium tracking-wide uppercase text-[10px]">
                            {block.lang || 'text'}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {/* Send Mermaid to canvas button */}
                          {isMermaid && onInsertMermaidToCanvas && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                onInsertMermaidToCanvas(block.code || '');
                                toast.success('Mermaid diagram rendered to canvas!');
                              }}
                              className="h-6 text-[10px] px-2 gap-1 border-blue-500/40 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10"
                              title="Render this Mermaid code block directly onto the canvas"
                            >
                              <Send className="size-2.5" />
                              <span>Send to Canvas</span>
                            </Button>
                          )}

                          {/* Copy Code Button */}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopyCode(block.id, block.code || '');
                            }}
                            className="h-6 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
                            title="Copy code"
                          >
                            {copiedBlockId === block.id ? (
                              <Check className="size-3 text-emerald-500" />
                            ) : (
                              <Copy className="size-3" />
                            )}
                          </Button>

                          {!readOnly && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleStartEdit(block)}
                              className="h-6 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
                              title="Edit code block"
                            >
                              <Edit2 className="size-2.5" />
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Code Body */}
                      <div
                        onClick={() => !readOnly && handleStartEdit(block)}
                        className="p-4 font-mono text-xs leading-relaxed overflow-x-auto text-foreground/90 whitespace-pre cursor-pointer"
                        title={readOnly ? undefined : 'Click to edit code'}
                      >
                        {block.code || '// Empty code block'}
                      </div>
                    </div>
                  );
                }

                // ─── Divider ───
                if (block.type === 'divider') {
                  return <hr key={block.id} className="my-5 border-border/50" />;
                }

                // ─── Blank Line ───
                if (!block.text.trim()) {
                  return <div key={block.id} className="h-2.5" />;
                }

                // ─── Standard Paragraph (with in-place click-to-edit) ───
                if (isEditing) {
                  return (
                    <div key={block.id} className="my-2">
                      <textarea
                        ref={inlineInputRef as any}
                        value={editingValue}
                        onChange={(e) => setEditingValue(e.target.value)}
                        onBlur={() => handleCommitEdit(idx)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleCommitEdit(idx);
                          }
                          if (e.key === 'Escape') handleCancelEdit();
                        }}
                        className="w-full bg-muted/30 border border-primary/40 rounded-lg p-2.5 text-sm text-foreground outline-none resize-none leading-relaxed"
                        rows={2}
                      />
                    </div>
                  );
                }

                return (
                  <p
                    key={block.id}
                    onClick={() => handleStartEdit(block)}
                    className="text-sm text-foreground/85 my-2 leading-relaxed cursor-pointer hover:bg-muted/20 rounded p-1 -m-1 transition-colors"
                    title={readOnly ? undefined : 'Click to edit paragraph'}
                  >
                    {renderInlineFormatting(block.text)}
                  </p>
                );
              })
            )}

            {/* Quick Add Block Toolbar at Bottom */}
            {!readOnly && (
              <div className="pt-6 border-t border-border/40 flex items-center gap-2 flex-wrap">
                <span className="text-[11px] text-muted-foreground/60 font-medium">Add block:</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => insertSnippet('## New Section\n')}
                  className="h-6 text-[10px] px-2 rounded-lg"
                >
                  <Plus className="size-2.5 mr-1" /> Heading
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => insertSnippet('- [ ] New action item\n')}
                  className="h-6 text-[10px] px-2 rounded-lg"
                >
                  <CheckSquare className="size-2.5 mr-1 text-primary" /> Checklist
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => insertSnippet('```typescript\n// Architecture snippet\n```\n')}
                  className="h-6 text-[10px] px-2 rounded-lg"
                >
                  <Code className="size-2.5 mr-1" /> Code
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => insertSnippet('```mermaid\nflowchart LR\n  A[Frontend] --> B[Backend API]\n```\n')}
                  className="h-6 text-[10px] px-2 rounded-lg border-blue-500/30 text-blue-600 dark:text-blue-400"
                >
                  <FileCode className="size-2.5 mr-1" /> Mermaid
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => insertSnippet('> **Notice:** Architectural note or warning.\n')}
                  className="h-6 text-[10px] px-2 rounded-lg"
                >
                  <Quote className="size-2.5 mr-1" /> Callout
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
