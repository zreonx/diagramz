'use client';

import React, { useEffect, useState } from 'react';
import {
  Users,
  UserPlus,
  Shield,
  Trash2,
  Mail,
  Check,
  Building2,
  ShieldCheck,
  UserCheck,
  Eye,
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  WorkspaceSummary,
  WorkspaceMemberSummary,
  WorkspaceRole,
  WORKSPACE_ROLES,
} from '@diagramz/shared';
import { toast } from 'sonner';

export default function WorkspaceMembersPage() {
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceSummary | null>(null);
  const [members, setMembers] = useState<WorkspaceMemberSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>('editor');
  const [isInviting, setIsInviting] = useState(false);

  useEffect(() => {
    apiClient
      .get<WorkspaceSummary[]>('/workspaces')
      .then((res) => {
        setWorkspaces(res.data);
        if (res.data.length > 0) {
          setActiveWorkspace(res.data[0]);
          loadMembers(res.data[0].id);
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

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspace || !inviteEmail.trim()) return;

    setIsInviting(true);
    try {
      await apiClient.post(`/workspaces/${activeWorkspace.id}/invitations`, {
        email: inviteEmail.trim(),
        role: inviteRole,
      });
      toast.success(`Invitation sent to ${inviteEmail}!`);
      setShowInviteModal(false);
      setInviteEmail('');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to send invitation');
    } finally {
      setIsInviting(false);
    }
  };

  const handleRoleChange = async (memberId: string, newRole: WorkspaceRole) => {
    if (!activeWorkspace) return;
    try {
      await apiClient.patch(`/workspaces/${activeWorkspace.id}/members/${memberId}`, {
        role: newRole,
      });
      setMembers(
        members.map((m) => (m.id === memberId ? { ...m, role: newRole } : m)),
      );
      toast.success('Member role updated successfully');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update role');
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!activeWorkspace || !confirm('Remove this member from the workspace?')) return;
    try {
      await apiClient.delete(`/workspaces/${activeWorkspace.id}/members/${memberId}`);
      setMembers(members.filter((m) => m.id !== memberId));
      toast.success('Member removed');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to remove member');
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner':
        return <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />;
      case 'admin':
        return <Shield className="w-3.5 h-3.5 text-blue-400" />;
      case 'editor':
        return <UserCheck className="w-3.5 h-3.5 text-emerald-400" />;
      default:
        return <Eye className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Team & Roles</h1>
          <p className="text-xs text-slate-400 mt-1">
            Manage members, invite colleagues, and control access permissions.
          </p>
        </div>

        <Button
          onClick={() => setShowInviteModal(true)}
          className="h-9 px-4 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium gap-1.5 shadow-md shadow-blue-600/20"
        >
          <UserPlus className="w-4 h-4" />
          <span>Invite Member</span>
        </Button>
      </div>

      {/* Members Card Table (shadcn Card style) */}
      <Card className="overflow-hidden">
        <CardHeader className="pb-3 border-b border-slate-800/80 bg-slate-950/40">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm">Active Members</CardTitle>
              <CardDescription>
                Members with active access to diagrams and canvas sessions in {activeWorkspace?.name}.
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-xs font-mono">
              {members.length} {members.length === 1 ? 'member' : 'members'}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-xs text-slate-500">Loading team members...</div>
          ) : (
            <div className="divide-y divide-slate-800/60">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="px-6 py-4 flex items-center justify-between hover:bg-slate-800/20 transition-colors"
                >
                  <div className="flex items-center gap-3.5">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback>
                        {member.user?.name.charAt(0).toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="text-xs font-semibold text-slate-100 flex items-center gap-2">
                        <span>{member.user?.name}</span>
                        {member.role === 'owner' && (
                          <span className="text-[10px] text-indigo-400 bg-indigo-950/50 border border-indigo-800/40 px-1.5 py-0.2 rounded font-medium">
                            Owner
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400">{member.user?.email}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5 text-xs text-slate-300">
                      {getRoleIcon(member.role)}
                      {member.role === 'owner' ? (
                        <span className="font-medium capitalize text-indigo-300">Owner</span>
                      ) : (
                        <select
                          value={member.role}
                          onChange={(e) =>
                            handleRoleChange(member.id, e.target.value as WorkspaceRole)
                          }
                          className="bg-slate-950 border border-slate-800 rounded-md px-2.5 py-1 text-xs text-slate-200 capitalize outline-none focus:border-blue-500"
                        >
                          {WORKSPACE_ROLES.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>

                    {member.role !== 'owner' && (
                      <button
                        onClick={() => handleRemoveMember(member.id)}
                        className="text-slate-500 hover:text-red-400 p-1.5 rounded hover:bg-slate-800 transition-colors"
                        title="Remove member"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invite Member Dialog */}
      <Dialog open={showInviteModal} onOpenChange={setShowInviteModal}>
        <DialogContent className="sm:max-w-md bg-slate-900 border-slate-800">
          <DialogHeader>
            <DialogTitle>Invite Team Member</DialogTitle>
            <DialogDescription>
              Collaborators will receive access to create and edit diagrams.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleInvite} className="space-y-4 pt-2">
            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                required
                placeholder="colleague@company.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1.5">
                Workspace Role
              </label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as WorkspaceRole)}
                className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-xs text-slate-100 outline-none capitalize focus:border-blue-500"
              >
                <option value="admin">Admin (Manage members & projects)</option>
                <option value="editor">Editor (Create & edit diagrams)</option>
                <option value="viewer">Viewer (Read-only access)</option>
              </select>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowInviteModal(false)}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={isInviting}>
                {isInviting ? 'Inviting...' : 'Send Invitation'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
