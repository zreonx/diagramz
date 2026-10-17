'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bell,
  Check,
  CheckCheck,
  Trash2,
  Layers,
  Users,
  ShieldAlert,
  Sparkles,
  MessageSquare,
  Settings,
  Inbox,
  Clock,
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api';
import { NotificationItem, NotificationListResponse } from '@diagramz/shared';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSecs = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSecs < 60) return 'Just now';
  const diffInMins = Math.floor(diffInSecs / 60);
  if (diffInMins < 60) return `${diffInMins}m ago`;
  const diffInHours = Math.floor(diffInMins / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) return `${diffInDays}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function getNotificationIcon(type: string) {
  switch (type) {
    case 'diagram_shared':
      return <Layers className="size-4 text-blue-500" />;
    case 'team_invite':
      return <Users className="size-4 text-emerald-500" />;
    case 'security_alert':
      return <ShieldAlert className="size-4 text-amber-500" />;
    case 'product_updates':
      return <Sparkles className="size-4 text-purple-500" />;
    case 'comment_added':
      return <MessageSquare className="size-4 text-cyan-500" />;
    default:
      return <Bell className="size-4 text-primary" />;
  }
}

export function NotificationCenter() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'all' | 'unread'>('all');
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await apiClient.get<NotificationListResponse>('/notifications');
      setNotifications(res.data.notifications);
      setUnreadCount(res.data.unreadCount);
    } catch {
      // silently ignore when unauthenticated
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 25000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      fetchNotifications();
    }
  };

  const handleMarkAsRead = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await apiClient.patch(`/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      toast.error('Failed to mark notification as read');
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await apiClient.post('/notifications/mark-all-read');
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
      toast.success('All notifications marked as read');
    } catch {
      toast.error('Failed to mark all as read');
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await apiClient.delete(`/notifications/${id}`);
      setNotifications((prev) => {
        const item = prev.find((n) => n.id === id);
        if (item && !item.isRead) {
          setUnreadCount((c) => Math.max(0, c - 1));
        }
        return prev.filter((n) => n.id !== id);
      });
    } catch {
      toast.error('Failed to delete notification');
    }
  };

  const handleClearAll = async () => {
    try {
      await apiClient.delete('/notifications');
      setNotifications([]);
      setUnreadCount(0);
      toast.success('All notifications cleared');
    } catch {
      toast.error('Failed to clear notifications');
    }
  };

  const handleClickItem = (item: NotificationItem) => {
    if (!item.isRead) {
      apiClient.patch(`/notifications/${item.id}/read`).catch(() => {});
      setNotifications((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, isRead: true } : n)),
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    }
    if (item.link) {
      setOpen(false);
      router.push(item.link);
    }
  };

  const displayedList =
    tab === 'unread' ? notifications.filter((n) => !n.isRead) : notifications;

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative size-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors"
          title="Notifications"
          aria-label="Notifications"
        >
          <Bell className="size-3.5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white shadow-xs animate-in zoom-in-75">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        className="w-80 sm:w-96 p-0 shadow-2xl rounded-2xl border border-border/80 bg-background/95 backdrop-blur-xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/60 bg-muted/30">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-semibold tracking-tight text-foreground">
              Notifications
            </h3>
            {unreadCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-primary/10 text-primary text-[10px] font-semibold">
                {unreadCount} unread
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="text-[11px] text-muted-foreground hover:text-foreground font-medium flex items-center gap-1 px-2 py-1 rounded-md hover:bg-muted/80 transition-colors cursor-pointer"
                title="Mark all as read"
              >
                <CheckCheck className="size-3" />
                <span>Read all</span>
              </button>
            )}
            <button
              onClick={() => {
                setOpen(false);
                router.push('/dashboard/settings/notifications');
              }}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors cursor-pointer"
              title="Notification Settings"
            >
              <Settings className="size-3.5" />
            </button>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1 px-4 pt-2 pb-1 border-b border-border/40 text-xs">
          <button
            onClick={() => setTab('all')}
            className={cn(
              'px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer',
              tab === 'all'
                ? 'bg-muted text-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
            )}
          >
            All <span className="opacity-60 text-[10px]">({notifications.length})</span>
          </button>
          <button
            onClick={() => setTab('unread')}
            className={cn(
              'px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer',
              tab === 'unread'
                ? 'bg-muted text-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
            )}
          >
            Unread <span className="opacity-60 text-[10px]">({unreadCount})</span>
          </button>
        </div>

        {/* Notifications List */}
        <div className="max-h-[380px] overflow-y-auto divide-y divide-border/30">
          {displayedList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
              <div className="size-10 rounded-full bg-muted/60 flex items-center justify-center text-muted-foreground mb-2.5">
                <Inbox className="size-5 stroke-[1.5]" />
              </div>
              <p className="text-xs font-medium text-foreground">
                {tab === 'unread' ? 'All caught up!' : 'No notifications yet'}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5 max-w-[200px]">
                {tab === 'unread'
                  ? "You don't have any unread notifications."
                  : 'Important updates and mentions will appear here.'}
              </p>
            </div>
          ) : (
            displayedList.map((item) => (
              <div
                key={item.id}
                onClick={() => handleClickItem(item)}
                className={cn(
                  'group flex items-start gap-3 px-4 py-3 text-left transition-colors cursor-pointer relative',
                  item.isRead ? 'hover:bg-muted/40' : 'bg-primary/3 hover:bg-primary/6',
                )}
              >
                {/* Icon */}
                <div
                  className={cn(
                    'size-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 border shadow-2xs',
                    item.isRead
                      ? 'bg-muted border-border/50 text-muted-foreground'
                      : 'bg-background border-border text-foreground',
                  )}
                >
                  {getNotificationIcon(item.type)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 pr-4">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={cn(
                        'text-xs truncate',
                        item.isRead ? 'font-medium text-foreground' : 'font-semibold text-foreground',
                      )}
                    >
                      {item.title}
                    </span>
                    {!item.isRead && (
                      <span className="size-1.5 rounded-full bg-blue-500 shrink-0" />
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5 leading-relaxed">
                    {item.message}
                  </p>
                  <div className="flex items-center gap-1 mt-1 text-[10px] text-muted-foreground/70">
                    <Clock className="size-2.5" />
                    <span>{formatTimeAgo(item.createdAt)}</span>
                  </div>
                </div>

                {/* Hover Actions */}
                <div className="absolute right-3 top-3 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-background/90 backdrop-blur-xs p-0.5 rounded-md border border-border/60 shadow-xs">
                  {!item.isRead && (
                    <button
                      onClick={(e) => handleMarkAsRead(e, item.id)}
                      className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                      title="Mark as read"
                    >
                      <Check className="size-3" />
                    </button>
                  )}
                  <button
                    onClick={(e) => handleDelete(e, item.id)}
                    className="p-1 rounded text-muted-foreground hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                    title="Delete notification"
                  >
                    <Trash2 className="size-3" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {notifications.length > 0 && (
          <div className="flex items-center justify-between px-4 py-2 border-t border-border/60 bg-muted/20 text-xs">
            <button
              onClick={handleClearAll}
              className="text-[11px] text-muted-foreground hover:text-rose-500 transition-colors cursor-pointer font-medium"
            >
              Clear all
            </button>
            <button
              onClick={() => {
                setOpen(false);
                router.push('/dashboard/settings/notifications');
              }}
              className="text-[11px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer font-medium"
            >
              Notification preferences →
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
