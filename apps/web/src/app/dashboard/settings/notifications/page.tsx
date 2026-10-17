'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { apiClient } from '@/lib/api';
import { NotificationPreferences } from '@diagramz/shared';
import { Loader2 } from 'lucide-react';

interface ToggleProps {
  id: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}

function Toggle({ id, checked, disabled, onChange }: ToggleProps) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'bg-primary' : 'bg-muted-foreground/30',
      )}
    >
      <span
        className={cn(
          'pointer-events-none inline-block size-4 transform rounded-full bg-white shadow-lg transition duration-200',
          checked ? 'translate-x-4' : 'translate-x-0',
        )}
      />
    </button>
  );
}

export default function NotificationsSettingsPage() {
  const [prefs, setPrefs] = useState<NotificationPreferences>({
    diagramShared: true,
    teamInvite: true,
    commentAdded: false,
    weeklyDigest: false,
    productUpdates: true,
    securityAlerts: true,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    apiClient
      .get<NotificationPreferences>('/notifications/preferences')
      .then((res) => {
        if (mounted && res.data) {
          setPrefs(res.data);
        }
      })
      .catch((err) => {
        console.error('Failed to load notification preferences:', err);
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const set = (key: keyof NotificationPreferences) => (val: boolean) =>
    setPrefs((p) => ({ ...p, [key]: val }));

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await apiClient.put<NotificationPreferences>(
        '/notifications/preferences',
        prefs,
      );
      if (res.data) {
        setPrefs(res.data);
      }
      toast.success('Notification preferences saved successfully');
    } catch {
      toast.error('Failed to save notification preferences');
    } finally {
      setIsSaving(false);
    }
  };

  const sections = [
    {
      title: 'Collaboration',
      items: [
        {
          key: 'diagramShared' as const,
          label: 'Diagram shared with you',
          desc: 'Receive alerts when someone shares a diagram or grants you edit access.',
        },
        {
          key: 'teamInvite' as const,
          label: 'Team invitations',
          desc: 'Get notified when you are invited to collaborate in a workspace.',
        },
        {
          key: 'commentAdded' as const,
          label: 'Comments & mentions',
          desc: 'When someone mentions you in a document or comment.',
        },
      ],
    },
    {
      title: 'Digest & Updates',
      items: [
        {
          key: 'weeklyDigest' as const,
          label: 'Weekly activity digest',
          desc: 'A summary of activity across your diagrams and workspaces.',
        },
        {
          key: 'productUpdates' as const,
          label: 'Product announcements',
          desc: 'New features, updates, and release notes from Diagramz.',
        },
        {
          key: 'securityAlerts' as const,
          label: 'Security alerts',
          desc: 'Sign-in from new device or location.',
        },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold">Notifications</h2>
        <p className="text-sm text-muted-foreground">
          Configure when and how you receive notifications.
        </p>
      </div>

      {sections.map((section, si) => (
        <Card key={si} className="border-border/70 shadow-2xs">
          <CardContent className="p-6 space-y-1">
            <p className="text-sm font-semibold mb-3 tracking-tight">{section.title}</p>
            {section.items.map((item, idx) => (
              <React.Fragment key={item.key}>
                {idx > 0 && <Separator className="my-0 bg-border/50" />}
                <div className="flex items-center justify-between py-3 gap-4">
                  <div>
                    <Label
                      htmlFor={item.key}
                      className="text-sm font-normal cursor-pointer select-none"
                    >
                      {item.label}
                    </Label>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                      {item.desc}
                    </p>
                  </div>
                  <Toggle
                    id={item.key}
                    checked={prefs[item.key]}
                    disabled={isLoading || isSaving}
                    onChange={set(item.key)}
                  />
                </div>
              </React.Fragment>
            ))}
          </CardContent>
        </Card>
      ))}

      <div className="flex justify-end gap-3 items-center">
        <Button
          size="sm"
          onClick={handleSave}
          disabled={isLoading || isSaving}
          className="min-w-32 font-medium"
        >
          {isSaving ? (
            <>
              <Loader2 className="mr-2 size-3.5 animate-spin" />
              Saving...
            </>
          ) : (
            'Save Preferences'
          )}
        </Button>
      </div>
    </div>
  );
}
