'use client';

import React, { useState } from 'react';
import { apiClient } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Lock, Monitor, LogOut, ShieldCheck } from 'lucide-react';

const sessions = [
  { device: 'Chrome on Windows', location: 'Manila, PH', lastActive: 'Active now', current: true },
  { device: 'Safari on iPhone', location: 'Manila, PH', lastActive: '2 hours ago', current: false },
];

export default function SecuritySettingsPage() {
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPw !== confirmPw) {
      toast.error('Passwords do not match');
      return;
    }
    if (newPw.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    setIsSaving(true);
    try {
      await apiClient.post('/auth/change-password', {
        currentPassword: currentPw,
        newPassword: newPw,
      });
      toast.success('Password changed successfully');
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to change password');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold">Security</h2>
        <p className="text-sm text-muted-foreground">Manage your password, sessions, and security settings.</p>
      </div>

      {/* Change Password */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Lock className="size-4 text-muted-foreground" />
            <p className="text-sm font-medium">Change Password</p>
          </div>
          <Separator />
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="current-pw" className="text-sm">Current Password</Label>
              <Input id="current-pw" type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} className="h-9 max-w-sm" placeholder="••••••••" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-pw" className="text-sm">New Password</Label>
              <Input id="new-pw" type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} className="h-9 max-w-sm" placeholder="Min. 8 characters" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm-pw" className="text-sm">Confirm New Password</Label>
              <Input id="confirm-pw" type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} className="h-9 max-w-sm" placeholder="Re-enter new password" />
            </div>
            <Button type="submit" size="sm" disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Update Password'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Active Sessions */}
      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Monitor className="size-4 text-muted-foreground" />
            <p className="text-sm font-medium">Active Sessions</p>
          </div>
          <Separator />
          <div className="space-y-3">
            {sessions.map((s, i) => (
              <div key={i} className="flex items-center justify-between gap-4 py-1">
                <div>
                  <div className="flex items-center gap-2 text-sm font-medium">
                    {s.device}
                    {s.current && <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 text-primary bg-primary/10">Current</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">{s.location} · {s.lastActive}</div>
                </div>
                {!s.current && (
                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-1.5">
                    <LogOut className="size-3.5" /> Revoke
                  </Button>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 2FA */}
      <Card>
        <CardContent className="p-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <ShieldCheck className="size-5 text-muted-foreground shrink-0" />
            <div>
              <p className="text-sm font-medium">Two-Factor Authentication</p>
              <p className="text-xs text-muted-foreground mt-0.5">Add an extra layer of security to your account.</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => toast.info('2FA setup coming soon')}>
            Enable 2FA
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
