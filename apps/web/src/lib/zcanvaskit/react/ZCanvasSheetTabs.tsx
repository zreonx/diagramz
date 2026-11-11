'use client';

import React, { useState } from 'react';
import { Plus, MoreVertical, Copy, Trash2, Edit2, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ZCanvasPage } from '../core/schema';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

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

  const handleStartRename = (page: ZCanvasPage) => {
    if (readOnly) return;
    setEditingId(page.id);
    setEditingName(page.name);
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
              title={isEditing ? undefined : `Page: ${page.name || `Page ${idx + 1}`} (Double-click to rename)`}
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
                  onMouseDown={(e) => e.stopPropagation()}
                />
              ) : (
                <span className="truncate max-w-[120px]">{page.name || `Page ${idx + 1}`}</span>
              )}

              {!readOnly && !isEditing && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      onClick={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                      className={cn(
                        'w-5 h-5 ml-1 rounded flex items-center justify-center transition-all cursor-pointer',
                        isActive
                          ? 'text-primary-foreground hover:bg-white/20'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                        'opacity-60 hover:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100 data-[state=open]:bg-white/20'
                      )}
                      title="Page options"
                      aria-label={`Options for ${page.name || `Page ${idx + 1}`}`}
                    >
                      <MoreVertical className="w-3.5 h-3.5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    side="top"
                    align="start"
                    sideOffset={8}
                    className="w-36 p-1 rounded-xl bg-card border border-border shadow-xl text-xs z-[100]"
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartRename(page);
                      }}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-muted-foreground" />
                      <span>Rename</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        onDuplicatePage(page.id);
                      }}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                      <span>Duplicate</span>
                    </DropdownMenuItem>
                    {pages.length > 1 && (
                      <>
                        <DropdownMenuSeparator className="my-1" />
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeletePage(page.id);
                          }}
                          className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-destructive hover:bg-destructive/10 focus:text-destructive focus:bg-destructive/10 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete</span>
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
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
