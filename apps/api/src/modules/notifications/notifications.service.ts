import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { db } from '../../database/drizzle.client';
import { notifications, userNotificationPreferences } from '../../database/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import {
  NotificationItem,
  NotificationListResponse,
  NotificationPreferences,
  UpdateNotificationPreferencesDto,
} from '@diagramz/shared';

export interface CreateNotificationInternalDto {
  userId: string;
  type: string;
  title: string;
  message: string;
  link?: string | null;
  metadata?: Record<string, unknown> | null;
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  diagramShared: true,
  teamInvite: true,
  commentAdded: false,
  weeklyDigest: false,
  productUpdates: true,
  securityAlerts: true,
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private eventEmitter: EventEmitter2) {}

  async getUserNotifications(
    userId: string,
    query?: { unreadOnly?: boolean; limit?: number },
  ): Promise<NotificationListResponse> {
    const limit = Math.min(Math.max(query?.limit || 50, 1), 100);
    const unreadOnly = !!query?.unreadOnly;

    const conditions = [eq(notifications.userId, userId)];
    if (unreadOnly) {
      conditions.push(eq(notifications.isRead, false));
    }

    const items = await db.query.notifications.findMany({
      where: and(...conditions),
      orderBy: [desc(notifications.createdAt)],
      limit,
    });

    // Compute unread count
    const [unreadRes] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));

    const unreadCount = unreadRes?.count ?? 0;

    const mapped: NotificationItem[] = items.map((item) => ({
      id: item.id,
      userId: item.userId,
      type: item.type,
      title: item.title,
      message: item.message,
      link: item.link,
      isRead: item.isRead,
      metadata: (item.metadata as Record<string, unknown>) || null,
      createdAt: item.createdAt.toISOString(),
    }));

    return {
      notifications: mapped,
      unreadCount,
    };
  }

  async getUnreadCount(userId: string): Promise<{ unreadCount: number }> {
    const [unreadRes] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));

    return { unreadCount: unreadRes?.count ?? 0 };
  }

  async markAsRead(userId: string, notificationId: string): Promise<NotificationItem> {
    const [updated] = await db
      .update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)))
      .returning();

    if (!updated) {
      throw new NotFoundException('Notification not found');
    }

    return {
      id: updated.id,
      userId: updated.userId,
      type: updated.type,
      title: updated.title,
      message: updated.message,
      link: updated.link,
      isRead: updated.isRead,
      metadata: (updated.metadata as Record<string, unknown>) || null,
      createdAt: updated.createdAt.toISOString(),
    };
  }

  async markAllAsRead(userId: string): Promise<{ count: number }> {
    const updated = await db
      .update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)))
      .returning({ id: notifications.id });

    return { count: updated.length };
  }

  async deleteNotification(userId: string, notificationId: string): Promise<void> {
    const deleted = await db
      .delete(notifications)
      .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)))
      .returning({ id: notifications.id });

    if (deleted.length === 0) {
      throw new NotFoundException('Notification not found');
    }
  }

  async clearAll(userId: string): Promise<{ count: number }> {
    const deleted = await db
      .delete(notifications)
      .where(eq(notifications.userId, userId))
      .returning({ id: notifications.id });

    return { count: deleted.length };
  }

  async getPreferences(userId: string): Promise<NotificationPreferences> {
    const pref = await db.query.userNotificationPreferences.findFirst({
      where: eq(userNotificationPreferences.userId, userId),
    });

    if (!pref) {
      return { ...DEFAULT_PREFERENCES };
    }

    return {
      diagramShared: pref.diagramShared,
      teamInvite: pref.teamInvite,
      commentAdded: pref.commentAdded,
      weeklyDigest: pref.weeklyDigest,
      productUpdates: pref.productUpdates,
      securityAlerts: pref.securityAlerts,
    };
  }

  async updatePreferences(
    userId: string,
    dto: UpdateNotificationPreferencesDto,
  ): Promise<NotificationPreferences> {
    const current = await this.getPreferences(userId);
    const updatedValues = {
      diagramShared: dto.diagramShared !== undefined ? dto.diagramShared : current.diagramShared,
      teamInvite: dto.teamInvite !== undefined ? dto.teamInvite : current.teamInvite,
      commentAdded: dto.commentAdded !== undefined ? dto.commentAdded : current.commentAdded,
      weeklyDigest: dto.weeklyDigest !== undefined ? dto.weeklyDigest : current.weeklyDigest,
      productUpdates: dto.productUpdates !== undefined ? dto.productUpdates : current.productUpdates,
      securityAlerts: dto.securityAlerts !== undefined ? dto.securityAlerts : current.securityAlerts,
      updatedAt: new Date(),
    };

    const [upserted] = await db
      .insert(userNotificationPreferences)
      .values({
        userId,
        ...updatedValues,
      })
      .onConflictDoUpdate({
        target: [userNotificationPreferences.userId],
        set: updatedValues,
      })
      .returning();

    return {
      diagramShared: upserted.diagramShared,
      teamInvite: upserted.teamInvite,
      commentAdded: upserted.commentAdded,
      weeklyDigest: upserted.weeklyDigest,
      productUpdates: upserted.productUpdates,
      securityAlerts: upserted.securityAlerts,
    };
  }

  async createNotification(dto: CreateNotificationInternalDto): Promise<NotificationItem | null> {
    try {
      // Check user preferences
      const prefs = await this.getPreferences(dto.userId);
      if (dto.type === 'diagram_shared' && !prefs.diagramShared) {
        this.logger.debug(`User ${dto.userId} has disabled diagram_shared notifications.`);
        return null;
      }
      if (dto.type === 'team_invite' && !prefs.teamInvite) {
        this.logger.debug(`User ${dto.userId} has disabled team_invite notifications.`);
        return null;
      }
      if (dto.type === 'comment_added' && !prefs.commentAdded) {
        this.logger.debug(`User ${dto.userId} has disabled comment_added notifications.`);
        return null;
      }
      if (dto.type === 'product_updates' && !prefs.productUpdates) {
        this.logger.debug(`User ${dto.userId} has disabled product_updates notifications.`);
        return null;
      }
      if (dto.type === 'security_alert' && !prefs.securityAlerts) {
        this.logger.debug(`User ${dto.userId} has disabled security_alert notifications.`);
        return null;
      }

      const [created] = await db
        .insert(notifications)
        .values({
          userId: dto.userId,
          type: dto.type,
          title: dto.title,
          message: dto.message,
          link: dto.link || null,
          metadata: dto.metadata || {},
          isRead: false,
        })
        .returning();

      const notificationItem: NotificationItem = {
        id: created.id,
        userId: created.userId,
        type: created.type,
        title: created.title,
        message: created.message,
        link: created.link,
        isRead: created.isRead,
        metadata: (created.metadata as Record<string, unknown>) || null,
        createdAt: created.createdAt.toISOString(),
      };

      this.eventEmitter.emit('notification.created', notificationItem);
      return notificationItem;
    } catch (err: any) {
      this.logger.error(`Failed to create notification: ${err.message}`, err.stack);
      return null;
    }
  }
}
