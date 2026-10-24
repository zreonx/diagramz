'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Plus, MoreVertical, Copy, Trash2, Edit2, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ZCanvasPage } from '../core/schema';

export interface ZCanvasSheetTabsProps {
  pages: ZCanvasPage[];
  activePageId: string;
  onSelectPage: (pageId: string) => void;
  onAddPage: () => void;
  onRenamePage: (pageId: string, newName: string) => void;
  onDuplicatePage: (pageId: string) => void;
  onDeletePage: (pageId: string) => void;
  readOnly?: boolean;
}

export function ZCanvasSheetTabs({
  pages,
  activePageId,
  onSelectPage,
  onAddPage,
  onRenamePage,
  onDuplicatePage,
  onDeletePage,
  readOnly = false,
}: ZCanvasSheetTabsProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [menuPageId, setMenuPageId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuPageId(null);
      }
    };
    if (menuPageId) {
      window.addEventListener('mousedown', handleClickOutside);
      return () => window.removeEventListener('mousedown', handleClickOutside);
    }
  }, [menuPageId]);

  const handleStartRename = (page: ZCanvasPage) => {
    if (readOnly) return;
    setEditingId(page.id);
    setEditingName(page.name);
    setMenuPageId(null);
  };

  const handleSaveRename = () => {
    if (!editingId) return;
    const trimmed = editingName.trim();
    if (trimmed.length > 0) {
      onRenamePage(editingId, trimmed);
    }
    setEditingId(null);
  };

  return (
    <div
      data-testid="zcanvas-sheet-tabs"
      className="absolute bottom-3 left-4 z-20 flex items-center gap-1 p-1 rounded-xl bg-card/90 backdrop-blur-md border border-border shadow-md select-none max-w-[calc(100vw-22rem)] overflow-x-auto no-scrollbar"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-1 min-w-0">
        {pages.map((page, idx) => {
          const isActive = page.id === activePageId;
          const isEditing = editingId === page.id;

          return (
            <div
              key={page.id}
              className={cn(
                'group relative flex items-center h-7 px-2.5 rounded-lg text-xs font-medium transition-all shrink-0 cursor-pointer',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
              )}
              onClick={() => {
                if (!isActive && !isEditing) onSelectPage(page.id);
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                handleStartRename(page);
              }}
              title={isEditing ? undefined : `Page: ${page.name} (Double-click to rename)`}
            >
              <FileText className={cn('w-3.5 h-3.5 mr-1.5 shrink-0', isActive ? 'opacity-90' : 'opacity-60')} />

              {isEditing ? (
                <input
                  type="text"
                  autoFocus
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onBlur={handleSaveRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveRename();
                    else if (e.key === 'Escape') setEditingId(null);
                  }}
                  className="w-24 h-5 px-1 text-xs font-medium rounded bg-background text-foreground border border-input outline-none"
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span className="truncate max-w-[120px]">{page.name || `Page ${idx + 1}`}</span>
              )}

              {!readOnly && !isEditing && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuPageId(menuPageId === page.id ? null : page.id);
                  }}
                  className={cn(
                    'w-4 h-4 ml-1 rounded flex items-center justify-center transition-opacity cursor-pointer',
                    isActive ? 'text-primary-foreground hover:bg-white/20' : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                    menuPageId === page.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                  )}
                  title="Page options"
                >
                  <MoreVertical className="w-3 h-3" />
                </button>
              )}

              {/* Context Menu for Page */}
              {menuPageId === page.id && (
                <div
                  ref={menuRef}
                  className="absolute bottom-8 left-0 w-36 p-1 rounded-xl bg-card border border-border shadow-xl z-50 text-xs text-foreground space-y-0.5 animate-in fade-in-50 zoom-in-95 duration-100"
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStartRename(page);
                    }}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted text-left transition-colors cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-muted-foreground" />
                    <span>Rename</span>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDuplicatePage(page.id);
                      setMenuPageId(null);
                    }}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted text-left transition-colors cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                    <span>Duplicate</span>
                  </button>
                  {pages.length > 1 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeletePage(page.id);
                        setMenuPageId(null);
                      }}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-destructive/10 text-destructive text-left transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!readOnly && (
        <button
          type="button"
          onClick={onAddPage}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0 cursor-pointer"
          title="Add new canvas page / sheet"
          aria-label="Add page"
        >
          <Plus className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
