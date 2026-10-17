'use client';

import React, { useState } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Camera, Mail, User } from 'lucide-react';

export default function AccountSettingsPage() {
  const { user } = useAuthStore();
  const [name, setName] = useState(user?.name || '');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    await new Promise((r) => setTimeout(r, 800));
    toast.success('Profile updated successfully');
    setIsSaving(false);
  };

  const userInitial = user?.name?.charAt(0).toUpperCase() || 'U';

  return (
    <div className="space-y-6">
      {/* Profile Section */}
      <div>
        <h2 className="text-base font-semibold">Profile</h2>
        <p className="text-sm text-muted-foreground">Update your display name and profile picture.</p>
      </div>

      <Card>
        <CardContent className="p-6 space-y-6">
          {/* Avatar */}
          <div className="flex items-center gap-4">
            <div className="relative">
              <Avatar className="size-16 border-2 border-border">
                <AvatarImage src={user?.avatarUrl || ''} />
                <AvatarFallback className="text-lg font-semibold bg-primary/10 text-primary">
                  {userInitial}
                </AvatarFallback>
              </Avatar>
              <button className="absolute -bottom-1 -right-1 size-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-sm hover:bg-primary/90 transition-colors">
                <Camera className="size-3" />
              </button>
            </div>
            <div>
              <p className="text-sm font-medium">{user?.name}</p>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
              <Badge variant="secondary" className="mt-1 text-[10px]">Free Plan</Badge>
            </div>
          </div>

          <Separator />

          {/* Name Field */}
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="display-name" className="text-sm font-medium">Display Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                  <Input
                    id="display-name"
                    className="pl-9 h-9"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-sm font-medium">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                  <Input
                    id="email"
                    className="pl-9 h-9"
                    value={user?.email || ''}
                    disabled
                    placeholder="your@email.com"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">Email cannot be changed.</p>
              </div>
            </div>

            <div className="flex justify-end">
              <Button type="submit" size="sm" disabled={isSaving} className="gap-2">
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <div>
        <h2 className="text-base font-semibold">Danger Zone</h2>
        <p className="text-sm text-muted-foreground">Irreversible and destructive actions.</p>
      </div>
      <Card className="border-destructive/50">
        <CardContent className="p-6 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Delete Account</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Permanently delete your account and all associated data.
            </p>
          </div>
          <Button variant="destructive" size="sm" onClick={() => toast.error('Contact support to delete your account.')}>
            Delete Account
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
