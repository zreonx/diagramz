'use client';

import React, { useEffect, useState } from 'react';
import {
  Users,
  UserPlus,
  Shield,
  Trash2,
  ShieldCheck,
  UserCheck,
  Eye,
  Mail,
  Link2,
  Copy,
  Check,
  Clock,
  Send,
  AlertCircle,
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import {
  WorkspaceSummary,
  WorkspaceMemberSummary,
  WorkspaceInvitationSummary,
  WorkspaceRole,
  WORKSPACE_ROLES,
} from '@diagramz/shared';
import { toast } from 'sonner';

export default function WorkspaceMembersPage() {
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceSummary | null>(null);
  const [members, setMembers] = useState<WorkspaceMemberSummary[]>([]);
  const [invitations, setInvitations] = useState<WorkspaceInvitationSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingInvites, setIsLoadingInvites] = useState(false);

  // Invite modal state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>('editor');
  const [isInviting, setIsInviting] = useState(false);
  const [createdInviteUrl, setCreatedInviteUrl] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedTokenId, setCopiedTokenId] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .get<WorkspaceSummary[]>('/workspaces')
      .then((res) => {
        setWorkspaces(res.data);
        if (res.data.length > 0) {
          setActiveWorkspace(res.data[0]);
          loadMembers(res.data[0].id);
          loadInvitations(res.data[0].id);
        } else {
          setIsLoading(false);
        }
      })
      .catch(console.error);
  }, []);

  const loadMembers = async (wsId: string) => {
    setIsLoading(true);
    try {
      const res = await apiClient.get<WorkspaceMemberSummary[]>(`/workspaces/${wsId}/members`);
      setMembers(res.data);
    } catch {
      toast.error('Failed to load members');
    } finally {
      setIsLoading(false);
    }
  };

  const loadInvitations = async (wsId: string) => {
    setIsLoadingInvites(true);
    try {
      const res = await apiClient.get<WorkspaceInvitationSummary[]>(`/workspaces/${wsId}/invitations`);
      setInvitations(res.data);
    } catch {
      // Non-admins might get 403, which is expected
      setInvitations([]);
    } finally {
      setIsLoadingInvites(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspace || !inviteEmail.trim()) return;
    setIsInviting(true);
    try {
      const res = await apiClient.post<WorkspaceInvitationSummary>(
        `/workspaces/${activeWorkspace.id}/invitations`,
        { email: inviteEmail.trim(), role: inviteRole }
      );
      const url = typeof window !== 'undefined' ? `${window.location.origin}/invite/${res.data.token}` : '';
      setCreatedInviteUrl(url);
      loadInvitations(activeWorkspace.id);
      toast.success(`Invite created for ${inviteEmail.trim()}`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to send invitation');
    } finally {
      setIsInviting(false);
    }
  };

  const handleCopyLink = (url: string, id?: string) => {
    navigator.clipboard.writeText(url);
    if (id) {
      setCopiedTokenId(id);
      setTimeout(() => setCopiedTokenId(null), 2000);
    } else {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
    toast.success('Invite link copied to clipboard!');
  };

  const handleRevokeInvitation = async (invitationId: string) => {
    if (!activeWorkspace || !confirm('Revoke this invitation?')) return;
    try {
      await apiClient.delete(`/workspaces/${activeWorkspace.id}/invitations/${invitationId}`);
      setInvitations(invitations.filter((inv) => inv.id !== invitationId));
      toast.success('Invitation revoked');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to revoke invitation');
    }
  };

  const handleRoleChange = async (memberId: string, newRole: WorkspaceRole) => {
    if (!activeWorkspace) return;
    try {
      await apiClient.patch(`/workspaces/${activeWorkspace.id}/members/${memberId}`, { role: newRole });
      setMembers(members.map((m) => (m.id === memberId ? { ...m, role: newRole } : m)));
      toast.success('Role updated');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update role');
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!activeWorkspace || !confirm('Remove this member?')) return;
    try {
      await apiClient.delete(`/workspaces/${activeWorkspace.id}/members/${memberId}`);
      setMembers(members.filter((m) => m.id !== memberId));
      toast.success('Member removed');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to remove member');
    }
  };

  const resetInviteModal = () => {
    setShowInviteModal(false);
    setCreatedInviteUrl(null);
    setInviteEmail('');
    setInviteRole('editor');
  };

  const roleConfig: Record<string, { icon: React.ReactNode; label: string; variant: 'default' | 'secondary' | 'outline' }> = {
    owner: { icon: <ShieldCheck className="size-3" />, label: 'Owner', variant: 'default' },
    admin: { icon: <Shield className="size-3" />, label: 'Admin', variant: 'secondary' },
    editor: { icon: <UserCheck className="size-3" />, label: 'Editor', variant: 'outline' },
    viewer: { icon: <Eye className="size-3" />, label: 'Viewer', variant: 'outline' },
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Team & Members</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage workspace access, roles, and collaborate with your team.
          </p>
        </div>
        <Button onClick={() => setShowInviteModal(true)} className="gap-2 h-9 text-xs font-medium rounded-lg shadow-xs">
          <UserPlus className="size-3.5" />
          Invite Member
        </Button>
      </div>

      {/* Members Table */}
      <Card className="border border-border/60 bg-card/60 backdrop-blur-xs rounded-xl shadow-2xs overflow-hidden">
        <CardHeader className="pb-3.5 pt-4 px-5">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold tracking-tight">Members</CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-0.5">
                {activeWorkspace?.name || 'Workspace'} · {members.length} {members.length === 1 ? 'member' : 'members'}
              </CardDescription>
            </div>
            <Badge variant="secondary" className="font-mono text-[10px] px-2 py-0.5 rounded-full border border-border/50">
              {members.length} active
            </Badge>
          </div>
        </CardHeader>

        <Separator className="bg-border/50" />

        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-xs text-muted-foreground">Loading members...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-b border-border/40">
                  <TableHead className="text-xs font-semibold text-muted-foreground px-5 py-2.5">Member</TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground px-5 py-2.5">Role</TableHead>
                  <TableHead className="text-right text-xs font-semibold text-muted-foreground px-5 py-2.5">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => {
                  const role = roleConfig[member.role] || roleConfig.viewer;
                  return (
                    <TableRow key={member.id} className="group hover:bg-muted/30 transition-colors">
                      <TableCell className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="size-8 border border-border/60 shadow-2xs">
                            <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">
                              {member.user?.name.charAt(0).toUpperCase() || 'U'}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="text-xs font-semibold leading-none text-foreground">{member.user?.name}</div>
                            <div className="text-[11px] text-muted-foreground mt-1">{member.user?.email}</div>
                          </div>
                        </div>
                      </TableCell>

                      <TableCell className="px-5 py-3">
                        {member.role === 'owner' ? (
                          <Badge variant="default" className="gap-1 text-[11px] font-medium h-6 px-2.5 rounded-full">
                            {role.icon} {role.label}
                          </Badge>
                        ) : (
                          <Select value={member.role} onValueChange={(val) => handleRoleChange(member.id, val as WorkspaceRole)}>
                            <SelectTrigger className="h-7 w-28 text-xs rounded-lg border-border/60 bg-muted/40 hover:bg-muted/70 transition-colors">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border border-border/60 bg-popover/95 backdrop-blur-md p-1 shadow-xl">
                              {WORKSPACE_ROLES.filter((r) => r !== 'owner').map((r) => (
                                <SelectItem key={r} value={r} className="text-xs capitalize rounded-lg">
                                  {r}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </TableCell>

                      <TableCell className="text-right px-5 py-3">
                        {member.role !== 'owner' ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-all"
                            onClick={() => handleRemoveMember(member.id)}
                            title="Remove member"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        ) : (
                          <span className="text-[11px] text-muted-foreground/70 italic">Creator</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pending Invitations Table */}
      {invitations.length > 0 && (
        <Card className="border border-border/60 bg-card/60 backdrop-blur-xs rounded-xl shadow-2xs overflow-hidden">
          <CardHeader className="pb-3.5 pt-4 px-5">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold tracking-tight">Pending Invitations</CardTitle>
                <CardDescription className="text-xs text-muted-foreground mt-0.5">
                  Users invited to join who haven&apos;t accepted yet.
                </CardDescription>
              </div>
              <Badge variant="outline" className="font-mono text-[10px] px-2 py-0.5 rounded-full border-border/60 text-muted-foreground">
                {invitations.length} pending
              </Badge>
            </div>
          </CardHeader>

          <Separator className="bg-border/50" />

          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-b border-border/40">
                  <TableHead className="text-xs font-semibold text-muted-foreground px-5 py-2.5">Email</TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground px-5 py-2.5">Role</TableHead>
                  <TableHead className="text-xs font-semibold text-muted-foreground px-5 py-2.5">Expires</TableHead>
                  <TableHead className="text-right text-xs font-semibold text-muted-foreground px-5 py-2.5">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invitations.map((inv) => {
                  const role = roleConfig[inv.role] || roleConfig.editor;
                  const inviteUrl = typeof window !== 'undefined' ? `${window.location.origin}/invite/${inv.token}` : '';
                  const isCopied = copiedTokenId === inv.id;
                  const expires = new Date(inv.expiresAt).toLocaleDateString();

                  return (
                    <TableRow key={inv.id} className="group hover:bg-muted/30 transition-colors">
                      <TableCell className="px-5 py-3 font-medium text-xs text-foreground">
                        <div className="flex items-center gap-2">
                          <Mail className="size-3.5 text-muted-foreground" />
                          <span>{inv.email}</span>
                        </div>
                      </TableCell>
                      <TableCell className="px-5 py-3">
                        <Badge variant="secondary" className="text-[11px] font-medium h-6 px-2 rounded-md capitalize">
                          {role.icon} {role.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-5 py-3 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5 text-[11px]">
                          <Clock className="size-3 text-muted-foreground" />
                          <span>{expires}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right px-5 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
                            onClick={() => handleCopyLink(inviteUrl, inv.id)}
                            title="Copy invite link"
                          >
                            {isCopied ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
                            <span className="hidden sm:inline">{isCopied ? 'Copied' : 'Copy Link'}</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-all"
                            onClick={() => handleRevokeInvitation(inv.id)}
                            title="Revoke invitation"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Invite Dialog */}
      <Dialog open={showInviteModal} onOpenChange={setShowInviteModal}>
        <DialogContent className="sm:max-w-md rounded-2xl border border-border/60 bg-background/95 backdrop-blur-md p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold tracking-tight">Invite Team Member</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Invite teammates to collaborate on {activeWorkspace?.name || 'your workspace'}.
            </DialogDescription>
          </DialogHeader>

          {createdInviteUrl ? (
            <div className="space-y-4 pt-2">
              <div className="p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  <Check className="size-4" />
                  Invitation Link Ready
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Share this invitation link with <strong>{inviteEmail}</strong>. When they open the link, they will join with{' '}
                  <strong className="capitalize">{inviteRole}</strong> permissions.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Invitation URL</Label>
                <div className="flex items-center gap-2">
                  <Input readOnly value={createdInviteUrl} className="h-9 font-mono text-[11px] bg-muted/40" />
                  <Button
                    type="button"
                    size="sm"
                    className="h-9 px-3 gap-1.5 shrink-0 text-xs font-medium"
                    onClick={() => handleCopyLink(createdInviteUrl)}
                  >
                    {copiedLink ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                    {copiedLink ? 'Copied' : 'Copy'}
                  </Button>
                </div>
              </div>

              <DialogFooter className="pt-2 flex flex-row items-center justify-between gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setCreatedInviteUrl(null);
                    setInviteEmail('');
                  }}
                  className="rounded-lg text-xs border-border/60"
                >
                  Invite Another
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={resetInviteModal}
                  className="rounded-lg text-xs font-medium"
                >
                  Done
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <form onSubmit={handleInvite} className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label htmlFor="invite-email" className="text-xs font-medium">
                  Email Address
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                  <Input
                    id="invite-email"
                    type="email"
                    required
                    placeholder="colleague@company.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="pl-9 h-9 rounded-lg border-border/60 bg-muted/30 focus:bg-background transition-colors text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="invite-role" className="text-xs font-medium">
                  Role
                </Label>
                <Select value={inviteRole} onValueChange={(val) => setInviteRole(val as WorkspaceRole)}>
                  <SelectTrigger id="invite-role" className="h-9 rounded-lg border-border/60 bg-muted/30 focus:bg-background transition-colors text-xs">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border border-border/60 bg-popover/95 backdrop-blur-md p-1 shadow-xl">
                    <SelectItem value="admin" className="text-xs rounded-lg">
                      Admin — Manage members & projects
                    </SelectItem>
                    <SelectItem value="editor" className="text-xs rounded-lg">
                      Editor — Create & edit diagrams
                    </SelectItem>
                    <SelectItem value="viewer" className="text-xs rounded-lg">
                      Viewer — Read-only access
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <DialogFooter className="gap-2 sm:gap-0 pt-1">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowInviteModal(false)} className="rounded-lg border-border/60 text-xs">
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={isInviting} className="gap-1.5 rounded-lg text-xs font-medium">
                  <Send className="size-3.5" />
                  {isInviting ? 'Generating...' : 'Generate Invite Link'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
