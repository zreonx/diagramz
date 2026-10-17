'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ShieldCheck,
  Shield,
  UserCheck,
  Eye,
  Building2,
  Users,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  Sparkles,
  LogIn,
  UserPlus,
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { WorkspaceInvitationDetails, WorkspaceRole, AcceptInvitationResponse } from '@diagramz/shared';
import { useAuthStore } from '@/stores/auth.store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

export default function WorkspaceInvitePage() {
  const params = useParams();
  const router = useRouter();
  const token = params?.token as string | undefined;

  const { user, isAuthenticated, checkAuth } = useAuthStore();
  const [invitation, setInvitation] = useState<WorkspaceInvitationDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAccepting, setIsAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (!token) {
      setError('Invalid invitation link.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    apiClient
      .get<WorkspaceInvitationDetails>(`/workspaces/invitations/${token}`)
      .then((res) => {
        setInvitation(res.data);
      })
      .catch((err) => {
        const msg = err.response?.data?.message || 'This invitation is invalid or has expired.';
        setError(msg);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [token]);

  const handleAccept = async () => {
    if (!token) return;
    setIsAccepting(true);
    try {
      const res = await apiClient.post<AcceptInvitationResponse>(`/workspaces/invitations/${token}/accept`);
      toast.success(`Successfully joined "${res.data.workspace.name}"!`);
      // Update saved active workspace so the dashboard immediately switches to it
      if (typeof window !== 'undefined') {
        localStorage.setItem('diagramz_active_workspace_id', res.data.workspace.id);
      }
      router.push('/dashboard');
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to accept invitation.';
      toast.error(msg);
      setError(msg);
    } finally {
      setIsAccepting(false);
    }
  };

  const roleBadgeConfig: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
    owner: { label: 'Owner', icon: <ShieldCheck className="size-3" />, color: 'bg-primary/10 text-primary' },
    admin: { label: 'Admin', icon: <Shield className="size-3" />, color: 'bg-indigo-500/10 text-indigo-500' },
    editor: { label: 'Editor', icon: <UserCheck className="size-3" />, color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
    viewer: { label: 'Viewer', icon: <Eye className="size-3" />, color: 'bg-muted text-muted-foreground' },
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-7 animate-spin text-primary" />
          <p className="text-xs text-muted-foreground font-medium">Verifying invitation...</p>
        </div>
      </div>
    );
  }

  if (error || !invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="max-w-md w-full border border-border/60 bg-card/60 backdrop-blur-md rounded-2xl shadow-xl overflow-hidden text-center p-6 sm:p-8">
          <div className="size-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="size-6" />
          </div>
          <CardTitle className="text-lg font-semibold tracking-tight text-foreground">
            Invitation Expired or Invalid
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground mt-2 leading-relaxed">
            {error || 'This invitation link may have already been used, expired, or revoked by a workspace administrator.'}
          </CardDescription>

          <div className="mt-6 flex flex-col gap-2">
            <Button asChild className="w-full text-xs font-medium rounded-lg h-9">
              <Link href="/dashboard">Go to Dashboard</Link>
            </Button>
            <Button asChild variant="outline" className="w-full text-xs font-medium rounded-lg h-9 border-border/60">
              <Link href="/">Back to Home</Link>
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const roleInfo = roleBadgeConfig[invitation.role] || roleBadgeConfig.editor;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden px-4 py-12">
      {/* Subtle Background Glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none" />

      <Card className="max-w-md w-full border border-border/60 bg-card/70 backdrop-blur-md rounded-2xl shadow-2xl overflow-hidden relative z-10">
        <CardHeader className="text-center pt-8 pb-4 px-6">
          <div className="size-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-4 shadow-xs">
            <Building2 className="size-7 text-primary" />
          </div>
          <Badge variant="outline" className="mx-auto text-[11px] font-medium border-border/60 mb-2 gap-1.5 px-2.5 py-0.5 rounded-full">
            <Sparkles className="size-3 text-primary" />
            Workspace Invitation
          </Badge>
          <CardTitle className="text-xl font-semibold tracking-tight text-foreground">
            Join {invitation.workspaceName}
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground mt-1.5">
            {invitation.inviterName ? (
              <span>
                <strong className="text-foreground font-medium">{invitation.inviterName}</strong> invited you to collaborate
              </span>
            ) : (
              'You have been invited to collaborate on diagrams and technical specs'
            )}
          </CardDescription>
        </CardHeader>

        <CardContent className="px-6 py-4 space-y-4">
          <div className="p-3.5 rounded-xl border border-border/50 bg-muted/30 space-y-2.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Workspace</span>
              <span className="font-medium text-foreground">{invitation.workspaceName}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Assigned Role</span>
              <Badge variant="secondary" className={`gap-1 font-medium text-[11px] px-2 py-0.5 rounded-md ${roleInfo.color}`}>
                {roleInfo.icon}
                {roleInfo.label}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Invited Email</span>
              <span className="font-mono text-[11px] text-foreground">{invitation.email}</span>
            </div>
          </div>

          {isAuthenticated && user && user.email.toLowerCase() !== invitation.email.toLowerCase() && (
            <div className="p-3 rounded-lg border border-amber-500/20 bg-amber-500/5 text-[11px] text-amber-600 dark:text-amber-400 leading-relaxed">
              You are currently signed in as <strong>{user.email}</strong>. Accepting this invite will associate your membership with this account.
            </div>
          )}
        </CardContent>

        <CardFooter className="px-6 pb-8 pt-2 flex flex-col gap-2.5">
          {isAuthenticated ? (
            <Button
              onClick={handleAccept}
              disabled={isAccepting}
              className="w-full text-xs font-medium rounded-lg h-10 shadow-xs gap-1.5"
            >
              {isAccepting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Joining Workspace...
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-4" />
                  Accept & Join Workspace
                </>
              )}
            </Button>
          ) : (
            <>
              <Button asChild className="w-full text-xs font-medium rounded-lg h-10 shadow-xs gap-1.5">
                <Link
                  href={`/register?redirect=${encodeURIComponent(`/invite/${invitation.token}`)}&email=${encodeURIComponent(
                    invitation.email
                  )}`}
                >
                  <UserPlus className="size-3.5" />
                  Create Account & Join
                </Link>
              </Button>
              <Button asChild variant="outline" className="w-full text-xs font-medium rounded-lg h-9 border-border/60 gap-1.5">
                <Link href={`/login?redirect=${encodeURIComponent(`/invite/${invitation.token}`)}`}>
                  <LogIn className="size-3.5" />
                  Log in to Existing Account
                </Link>
              </Button>
            </>
          )}

          <div className="text-center pt-2">
            <Link href="/" className="text-[11px] text-muted-foreground hover:text-foreground transition-colors">
              Return to Diagramz homepage
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
