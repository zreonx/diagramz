import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { AuditLogEvent } from './audit.event';
import { db } from '../../database/drizzle.client';
import { auditLogs } from '../../database/schema';
import { eq, desc } from 'drizzle-orm';
import { AuditLogSummary } from '@diagramz/shared';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  @OnEvent('audit.log', { async: true })
  async handleAuditLog(event: AuditLogEvent): Promise<void> {
    try {
      await db.insert(auditLogs).values({
        workspaceId: event.workspaceId,
        userId: event.userId,
        action: event.action,
        resourceType: event.resourceType,
        resourceId: event.resourceId,
        metadata: event.metadata || {},
      });
      this.logger.log(
        `Audit logged: [${event.action}] on ${event.resourceType}:${event.resourceId} in workspace ${event.workspaceId}`,
      );
    } catch (err: any) {
      this.logger.error(`Failed to persist audit log: ${err.message}`, err.stack);
    }
  }

  async getWorkspaceLogs(workspaceId: string, limit = 50): Promise<AuditLogSummary[]> {
    const logs = await db.query.auditLogs.findMany({
      where: eq(auditLogs.workspaceId, workspaceId),
      orderBy: [desc(auditLogs.createdAt)],
      limit,
    });

    return logs.map((l) => ({
      id: l.id,
      workspaceId: l.workspaceId,
      userId: l.userId,
      action: l.action,
      resourceType: l.resourceType,
      resourceId: l.resourceId,
      metadata: l.metadata as Record<string, unknown> | null,
      createdAt: l.createdAt.toISOString(),
    }));
  }
}
