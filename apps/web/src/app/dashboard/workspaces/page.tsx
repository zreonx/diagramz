'use client';

import React, { useEffect, useState } from 'react';
import { Users, UserPlus, Shield, Trash2, Mail, Check } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
    apiClient.get<WorkspaceSummary[]>('/workspaces').then((res) => {
      setWorkspaces(res.data);
      if (res.data.length > 0) {
        setActiveWorkspace(res.data[0]);
        loadMembers(res.data[0].id);
      } else {
        setIsLoading(false);
      }
    }).catch(console.error);
  }, []);

  const loadMembers = async (wsId: string) => {
    setIsLoading(true);
    try {
      const res = await apiClient.get<WorkspaceMemberSummary[]>(`/workspaces/${wsId}/members`);
      setMembers(res.data);
    } catch (err: any) {
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
      toast.success('Role updated');
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

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Team Members</h1>
          <p className="text-xs text-slate-400 mt-1">
            Manage who has access to {activeWorkspace?.name || 'this workspace'} and their role permissions.
          </p>
        </div>

        <Button
          onClick={() => setShowInviteModal(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-9 px-4 gap-1.5"
        >
          <UserPlus className="w-4 h-4" />
          <span>Invite Member</span>
        </Button>
      </div>

      {/* Members Table */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between text-xs font-semibold text-slate-400 uppercase tracking-wider">
          <span>Member</span>
          <span>Role & Access</span>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-xs text-slate-500">Loading members...</div>
        ) : (
          <div className="divide-y divide-slate-800/60">
            {members.map((member) => (
              <div
                key={member.id}
                className="p-4 flex items-center justify-between hover:bg-slate-800/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-sm text-blue-400">
                    {member.user?.name.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-100">{member.user?.name}</div>
                    <div className="text-[11px] text-slate-400">{member.user?.email}</div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {member.role === 'owner' ? (
                    <Badge variant="default" className="text-xs capitalize bg-indigo-600">
                      Owner
                    </Badge>
                  ) : (
                    <select
                      value={member.role}
                      onChange={(e) =>
                        handleRoleChange(member.id, e.target.value as WorkspaceRole)
                      }
                      className="bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-xs text-slate-200 capitalize outline-none"
                    >
                      {WORKSPACE_ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  )}

                  {member.role !== 'owner' && (
                    <button
                      onClick={() => handleRemoveMember(member.id)}
                      className="text-slate-500 hover:text-red-400 p-1.5 rounded transition-colors"
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
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-base font-semibold text-slate-100 mb-1">Invite Team Member</h3>
            <p className="text-xs text-slate-400 mb-4">
              Send an invitation link to collaborate on this workspace.
            </p>

            <form onSubmit={handleInvite} className="space-y-4">
              <div>
                <label className="text-xs text-slate-300 block mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="colleague@company.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 block mb-1">Workspace Role</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as WorkspaceRole)}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-100 outline-none capitalize"
                >
                  <option value="admin">Admin (Manage members & projects)</option>
                  <option value="editor">Editor (Create & edit diagrams)</option>
                  <option value="viewer">Viewer (Read-only access)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button size="sm" variant="ghost" onClick={() => setShowInviteModal(false)}>
                  Cancel
                </Button>
                <Button size="sm" type="submit" disabled={isInviting}>
                  {isInviting ? 'Inviting...' : 'Send Invite'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
