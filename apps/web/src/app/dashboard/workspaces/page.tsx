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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
        return <ShieldCheck className="size-3.5 text-indigo-400" />;
      case 'admin':
        return <Shield className="size-3.5 text-blue-400" />;
      case 'editor':
        return <UserCheck className="size-3.5 text-emerald-400" />;
      default:
        return <Eye className="size-3.5 text-slate-400" />;
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
          <UserPlus className="size-4" />
          <span>Invite Member</span>
        </Button>
      </div>

      {/* Members Table with shadcn Table component */}
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div className="flex items-center gap-3.5">
                        <Avatar className="size-9">
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
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getRoleIcon(member.role)}
                        {member.role === 'owner' ? (
                          <span className="text-xs font-medium capitalize text-indigo-300">
                            Owner
                          </span>
                        ) : (
                          <Select
                            value={member.role}
                            onValueChange={(val) =>
                              handleRoleChange(member.id, val as WorkspaceRole)
                            }
                          >
                            <SelectTrigger className="h-8 w-32 text-xs capitalize">
                              <SelectValue placeholder="Role" />
                            </SelectTrigger>
                            <SelectContent>
                              {WORKSPACE_ROLES.map((r) => (
                                <SelectItem key={r} value={r} className="capitalize text-xs">
                                  {r}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    </TableCell>

                    <TableCell className="text-right">
                      {member.role !== 'owner' ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveMember(member.id)}
                          className="h-8 w-8 text-slate-400 hover:text-red-400"
                          title="Remove member"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      ) : (
                        <span className="text-[11px] text-slate-500 italic pr-2">Workspace Creator</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Invite Member Dialog using shadcn Dialog, Input, Label, Select */}
      <Dialog open={showInviteModal} onOpenChange={setShowInviteModal}>
        <DialogContent className="sm:max-w-md bg-slate-900 border-slate-800">
          <DialogHeader>
            <DialogTitle>Invite Team Member</DialogTitle>
            <DialogDescription>
              Collaborators will receive access to create and edit diagrams.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleInvite} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="invite-email">Email Address</Label>
              <Input
                id="invite-email"
                type="email"
                required
                placeholder="colleague@company.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="invite-role">Workspace Role</Label>
              <Select
                value={inviteRole}
                onValueChange={(val) => setInviteRole(val as WorkspaceRole)}
              >
                <SelectTrigger id="invite-role" className="h-9 text-xs">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin (Manage members & projects)</SelectItem>
                  <SelectItem value="editor">Editor (Create & edit diagrams)</SelectItem>
                  <SelectItem value="viewer">Viewer (Read-only access)</SelectItem>
                </SelectContent>
              </Select>
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
