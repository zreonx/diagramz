import { z } from 'zod';

export type NotificationType =
  | 'diagram_shared'
  | 'team_invite'
  | 'comment_added'
  | 'weekly_digest'
  | 'product_updates'
  | 'security_alert'
  | 'system_alert';

export interface NotificationItem {
  id: string;
  userId: string;
  type: NotificationType | string;
  title: string;
  message: string;
  link?: string | null;
  isRead: boolean;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

export interface NotificationListResponse {
  notifications: NotificationItem[];
  unreadCount: number;
}

export interface NotificationPreferences {
  diagramShared: boolean;
  teamInvite: boolean;
  commentAdded: boolean;
  weeklyDigest: boolean;
  productUpdates: boolean;
  securityAlerts: boolean;
}

export const updateNotificationPreferencesSchema = z.object({
  diagramShared: z.boolean().optional(),
  teamInvite: z.boolean().optional(),
  commentAdded: z.boolean().optional(),
  weeklyDigest: z.boolean().optional(),
  productUpdates: z.boolean().optional(),
  securityAlerts: z.boolean().optional(),
});
export type UpdateNotificationPreferencesDto = z.infer<typeof updateNotificationPreferencesSchema>;

export const createNotificationSchema = z.object({
  userId: z.string().uuid(),
  type: z.string(),
  title: z.string().min(1).max(200),
  message: z.string().min(1).max(1000),
  link: z.string().nullable().optional(),
  metadata: z.record(z.unknown()).nullable().optional(),
});
export type CreateNotificationDto = z.infer<typeof createNotificationSchema>;
