'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Globe,
  Lock,
  Link2,
  Copy,
  Check,
  Users,
  UserPlus,
  Trash2,
  Eye,
  Edit3,
  Loader2,
  Shield,
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { toast } from 'sonner';
import {
  DiagramAccessOverview,
  DiagramCollaboratorSummary,
} from '@diagramz/shared';
import { useDiagramStore } from '@/stores/diagram.store';

interface ShareDiagramDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  diagramId: string;
  diagramTitle?: string;
  initialIsPublic?: boolean;
  initialShareToken?: string | null;
  initialShareRole?: 'viewer' | 'editor';
  onShareSettingsChanged?: (settings: {
    isPublic: boolean;
    shareToken: string;
    shareRole: 'viewer' | 'editor';
  }) => void;
}

export function ShareDiagramDialog({
  open,
  onOpenChange,
  diagramId,
  diagramTitle,
  initialIsPublic = false,
  initialShareToken = null,
  initialShareRole = 'viewer',
  onShareSettingsChanged,
}: ShareDiagramDialogProps) {
  const [accessData, setAccessData] = useState<DiagramAccessOverview | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPublic, setIsPublic] = useState(initialIsPublic);
  const [shareRole, setShareRole] = useState<'viewer' | 'editor'>(initialShareRole);
  const [shareToken, setShareToken] = useState<string | null>(initialShareToken);
  const [isUpdatingLink, setIsUpdatingLink] = useState(false);
  const [copied, setCopied] = useState(false);

  // Invite collaborator state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'viewer' | 'editor'>('viewer');
  const [isInviting, setIsInviting] = useState(false);

  // Load access overview whenever dialog opens
  const loadAccessData = useCallback(async () => {
    if (!diagramId) return;
    setIsLoading(true);
    try {
      const res = await apiClient.get<DiagramAccessOverview>(`/diagrams/${diagramId}/access`);
      setAccessData(res.data);
      setIsPublic(res.data.isPublic);
      setShareRole(res.data.shareRole || 'viewer');
      setShareToken(res.data.shareToken);
    } catch (e: any) {
      console.error('Failed to load diagram access overview:', e);
    } finally {
      setIsLoading(false);
    }
  }, [diagramId]);

  useEffect(() => {
    if (open) {
      setIsPublic(initialIsPublic);
      setShareRole(initialShareRole);
      setShareToken(initialShareToken);
      loadAccessData();
    }
  }, [open, diagramId, initialIsPublic, initialShareRole, initialShareToken, loadAccessData]);

  const updateShareSettings = async (nextPublic: boolean, nextRole: 'viewer' | 'editor') => {
    setIsUpdatingLink(true);
    try {
      const res = await apiClient.post<{
        shareToken: string;
        isPublic: boolean;
        shareRole: 'viewer' | 'editor';
      }>(`/diagrams/${diagramId}/share`, {
        isPublic: nextPublic,
        shareRole: nextRole,
      });

      setIsPublic(res.data.isPublic);
      setShareRole(res.data.shareRole);
      setShareToken(res.data.shareToken);

      // Update store
      useDiagramStore.getState().updateDiagramShareSettings({
        isPublic: res.data.isPublic,
        shareToken: res.data.shareToken,
        shareRole: res.data.shareRole,
      });

      if (onShareSettingsChanged) {
        onShareSettingsChanged({
          isPublic: res.data.isPublic,
          shareToken: res.data.shareToken,
          shareRole: res.data.shareRole,
        });
      }

      toast.success(
        nextPublic
          ? `Link sharing enabled (${nextRole === 'editor' ? 'Can edit' : 'Can view'})`
          : 'Link sharing set to restricted'
      );
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to update share settings');
    } finally {
      setIsUpdatingLink(false);
    }
  };

  const handleInviteCollaborator = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail || !inviteEmail.trim()) return;

    setIsInviting(true);
    try {
      const res = await apiClient.post<DiagramCollaboratorSummary>(
        `/diagrams/${diagramId}/collaborators`,
        {
          email: inviteEmail.trim(),
          role: inviteRole,
        }
      );

      setInviteEmail('');
      toast.success(`Access granted to ${res.data.email} as ${inviteRole}`);
      await loadAccessData();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to invite collaborator');
    } finally {
      setIsInviting(false);
    }
  };

  const handleRemoveCollaborator = async (collaboratorId: string, email: string) => {
    try {
      await apiClient.delete(`/diagrams/${diagramId}/collaborators/${collaboratorId}`);
      toast.success(`Removed access for ${email}`);
      await loadAccessData();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to remove collaborator');
    }
  };

  const handleUpdateCollaboratorRole = async (
    collaboratorId: string,
    newRole: 'viewer' | 'editor'
  ) => {
    try {
      await apiClient.patch(`/diagrams/${diagramId}/collaborators/${collaboratorId}`, {
        role: newRole,
      });
      toast.success(`Collaborator permission updated to ${newRole}`);
      await loadAccessData();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to update collaborator role');
    }
  };

  const shareUrl =
    typeof window !== 'undefined' && shareToken
      ? `${window.location.origin}/share/${shareToken}`
      : '';

  const handleCopyLink = () => {
    if (!shareUrl) {
      toast.error('No share link available. Enable link sharing below.');
      return;
    }
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast.success('Share link copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg rounded-2xl border border-border/60 bg-background/95 backdrop-blur-md p-6 shadow-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold tracking-tight">
                Share &quot;{diagramTitle || 'Diagram'}&quot;
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Manage who can view or edit this architecture diagram.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-5 py-2 pr-1">
          {/* 1. Invite People Section */}
          <form onSubmit={handleInviteCollaborator} className="space-y-2">
            <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <UserPlus className="w-3.5 h-3.5 text-muted-foreground" />
              Invite people
            </label>
            <div className="flex items-center gap-2">
              <Input
                type="email"
                placeholder="colleague@company.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="flex-1 h-9 text-xs rounded-xl border-border/60 bg-muted/20 focus:bg-background"
                disabled={isInviting}
              />
              <Select
                value={inviteRole}
                onValueChange={(val: 'viewer' | 'editor') => setInviteRole(val)}
                disabled={isInviting}
              >
                <SelectTrigger className="w-[110px] h-9 text-xs rounded-xl border-border/60">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-border/60">
                  <SelectItem value="viewer" className="text-xs">
                    <span className="flex items-center gap-1.5">
                      <Eye className="w-3 h-3 text-muted-foreground" />
                      Can view
                    </span>
                  </SelectItem>
                  <SelectItem value="editor" className="text-xs">
                    <span className="flex items-center gap-1.5">
                      <Edit3 className="w-3 h-3 text-emerald-500" />
                      Can edit
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
              <Button
                type="submit"
                size="sm"
                disabled={!inviteEmail.trim() || isInviting}
                className="h-9 px-3.5 text-xs rounded-xl font-medium shrink-0"
              >
                {isInviting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Invite'}
              </Button>
            </div>
          </form>

          {/* 2. People with Access */}
          <div className="space-y-2.5">
            <div className="text-xs font-semibold text-foreground flex items-center justify-between">
              <span>People with access</span>
              {isLoading && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
            </div>

            <div className="rounded-xl border border-border/50 divide-y divide-border/40 overflow-hidden bg-muted/10 max-h-48 overflow-y-auto">
              {/* Workspace Owner */}
              {accessData?.owner && (
                <div className="flex items-center justify-between p-2.5 text-xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold text-[11px] shrink-0">
                      {accessData.owner.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-foreground truncate flex items-center gap-1.5">
                        {accessData.owner.name}
                        <span className="text-[10px] text-muted-foreground font-normal">(you)</span>
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate font-mono">
                        {accessData.owner.email}
                      </div>
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-[10px] h-5 rounded-md px-1.5 font-normal">
                    Owner
                  </Badge>
                </div>
              )}

              {/* Direct Collaborators */}
              {accessData?.collaborators && accessData.collaborators.length > 0 && (
                <>
                  {accessData.collaborators.map((c) => (
                    <div key={c.id} className="flex items-center justify-between p-2.5 text-xs">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-semibold text-[11px] shrink-0">
                          {(c.user?.name || c.email).charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-foreground truncate">
                            {c.user?.name || c.email.split('@')[0]}
                          </div>
                          <div className="text-[11px] text-muted-foreground truncate font-mono">
                            {c.email}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <Select
                          value={c.role}
                          onValueChange={(val: 'viewer' | 'editor') =>
                            handleUpdateCollaboratorRole(c.id, val)
                          }
                        >
                          <SelectTrigger className="h-7 w-[95px] text-[11px] rounded-lg border-border/50">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl border-border/60">
                            <SelectItem value="viewer" className="text-xs">
                              Can view
                            </SelectItem>
                            <SelectItem value="editor" className="text-xs">
                              Can edit
                            </SelectItem>
                          </SelectContent>
                        </Select>

                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleRemoveCollaborator(c.id, c.email)}
                          className="h-7 w-7 text-muted-foreground hover:text-destructive rounded-lg"
                          title="Remove access"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </>
              )}

              {/* Workspace Members summary */}
              {accessData?.workspaceMembers && accessData.workspaceMembers.length > 0 && (
                <div className="p-2.5 bg-muted/20 flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Shield className="w-3.5 h-3.5 text-primary" />
                    <span>All Workspace Members</span>
                  </div>
                  <span className="text-[11px] font-mono">Workspace Role Access</span>
                </div>
              )}
            </div>
          </div>

          {/* 3. General Access / Link Sharing */}
          <div className="space-y-3 pt-2 border-t border-border/50">
            <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-muted-foreground" />
              General access
            </div>

            <div className="p-3.5 rounded-xl border border-border/50 bg-muted/20 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                      isPublic
                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {isPublic ? <Globe className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                  </div>

                  <div>
                    <Select
                      value={isPublic ? 'public' : 'restricted'}
                      onValueChange={(val) => {
                        const nextPublic = val === 'public';
                        updateShareSettings(nextPublic, shareRole);
                      }}
                      disabled={isUpdatingLink}
                    >
                      <SelectTrigger className="h-7 text-xs font-medium border-none shadow-none px-0 focus:ring-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-border/60">
                        <SelectItem value="restricted" className="text-xs font-medium">
                          Restricted
                        </SelectItem>
                        <SelectItem value="public" className="text-xs font-medium">
                          Anyone with the link
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-[11px] text-muted-foreground -mt-1">
                      {isPublic
                        ? 'Anyone on the internet with this link can access'
                        : 'Only people invited or in this workspace can access'}
                    </p>
                  </div>
                </div>

                {isPublic && (
                  <Select
                    value={shareRole}
                    onValueChange={(val: 'viewer' | 'editor') => {
                      setShareRole(val);
                      updateShareSettings(true, val);
                    }}
                    disabled={isUpdatingLink}
                  >
                    <SelectTrigger className="h-7 w-[105px] text-xs font-medium rounded-lg border-border/60 bg-background shrink-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-border/60">
                      <SelectItem value="viewer" className="text-xs">
                        <span className="flex items-center gap-1.5">
                          <Eye className="w-3 h-3 text-muted-foreground" />
                          Viewer
                        </span>
                      </SelectItem>
                      <SelectItem value="editor" className="text-xs">
                        <span className="flex items-center gap-1.5">
                          <Edit3 className="w-3 h-3 text-emerald-500" />
                          Editor
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Link Input Bar */}
              {isPublic && shareUrl && (
                <div className="flex items-center gap-2 pt-1">
                  <Input
                    readOnly
                    value={shareUrl}
                    className="flex-1 font-mono text-[11px] select-all h-8 rounded-lg border-border/60 bg-background"
                  />
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={handleCopyLink}
                    className="h-8 px-3 text-xs rounded-lg font-medium shrink-0 border border-border/50 gap-1.5"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'Copied' : 'Copy link'}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between gap-2 mt-2 pt-3 border-t border-border/50 shrink-0">
          <Button
            size="sm"
            variant="outline"
            onClick={handleCopyLink}
            disabled={!isPublic}
            className="rounded-xl border-border/60 text-xs font-medium gap-1.5"
          >
            <Link2 className="w-3.5 h-3.5" />
            Copy link
          </Button>

          <Button
            size="sm"
            onClick={() => onOpenChange(false)}
            className="rounded-xl text-xs font-medium px-4"
          >
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
