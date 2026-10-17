import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as crypto from 'crypto';
import { eq, desc, inArray, and } from 'drizzle-orm';
import { db } from '../../database/drizzle.client';
import {
  diagrams,
  diagramCanvases,
  diagramVersions,
  projects,
  users,
  diagramCollaborators,
} from '../../database/schema';
import {
  CreateDiagramDto,
  UpdateDiagramDto,
  CreateDiagramVersionDto,
  UpdateShareSettingsDto,
  UpdateSharedDiagramDto,
  AddDiagramCollaboratorDto,
  UpdateDiagramCollaboratorDto,
  DiagramSummary,
  DiagramDetail,
  DiagramVersionSummary,
  DiagramAccessOverview,
  DiagramCollaboratorSummary,
} from '@diagramz/shared';
import { AuditLogEvent } from '../audit/audit.event';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class DiagramsService {
  constructor(
    private eventEmitter: EventEmitter2,
    private notificationsService: NotificationsService,
  ) {}

  async listProjectDiagrams(projectId: string): Promise<DiagramSummary[]> {
    const list = await db.query.diagrams.findMany({
      where: eq(diagrams.projectId, projectId),
      orderBy: [desc(diagrams.updatedAt)],
    });

    return list.map((d) => ({
      id: d.id,
      projectId: d.projectId,
      folderId: d.folderId,
      title: d.title,
      documentContent: d.documentContent,
      viewMode: (d.viewMode as any) || 'both',
      isStarred: d.isStarred,
      deletedAt: d.deletedAt ? d.deletedAt.toISOString() : null,
      mermaidCode: d.mermaidCode,
      thumbnailKey: d.thumbnailKey,
      isPublic: d.isPublic,
      shareToken: d.shareToken,
      shareRole: (d.shareRole as 'viewer' | 'editor') || 'viewer',
      createdBy: d.createdBy,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
    }));
  }

  async createDiagram(
    projectId: string,
    userId: string,
    dto: CreateDiagramDto,
  ): Promise<DiagramDetail> {
    const proj = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
    });

    if (!proj) {
      throw new NotFoundException('Project not found');
    }

    const shareToken = crypto.randomBytes(16).toString('hex');
    const initialCanvas = dto.canvasData || { elements: [], appState: {} };

    const result = await db.transaction(async (tx) => {
      const [diag] = await tx
        .insert(diagrams)
        .values({
          projectId,
          folderId: dto.folderId || null,
          title: dto.title,
          documentContent: dto.documentContent || '',
          viewMode: dto.viewMode || 'both',
          mermaidCode: dto.mermaidCode || '',
          shareToken,
          createdBy: userId,
        })
        .returning();

      await tx.insert(diagramCanvases).values({
        diagramId: diag.id,
        canvasData: initialCanvas,
      });

      return diag;
    });

    this.eventEmitter.emit(
      'audit.log',
      new AuditLogEvent(proj.workspaceId, userId, 'create', 'diagram', result.id, {
        title: result.title,
      }),
    );

    return {
      id: result.id,
      projectId: result.projectId,
      folderId: result.folderId,
      title: result.title,
      documentContent: result.documentContent,
      viewMode: (result.viewMode as any) || 'both',
      isStarred: result.isStarred,
      deletedAt: result.deletedAt ? result.deletedAt.toISOString() : null,
      mermaidCode: result.mermaidCode,
      thumbnailKey: result.thumbnailKey,
      isPublic: result.isPublic,
      shareToken: result.shareToken,
      shareRole: (result.shareRole as 'viewer' | 'editor') || 'viewer',
      canEdit: true,
      createdBy: result.createdBy,
      createdAt: result.createdAt.toISOString(),
      updatedAt: result.updatedAt.toISOString(),
      canvasData: initialCanvas,
    };
  }

  async getDiagramDetail(diagramId: string, userId?: string): Promise<DiagramDetail> {
    const diagram = await db.query.diagrams.findFirst({
      where: eq(diagrams.id, diagramId),
      with: {
        canvas: true,
      },
    });

    if (!diagram) {
      throw new NotFoundException('Diagram not found');
    }

    let canEdit = true;
    if (userId) {
      if (diagram.createdBy === userId) {
        canEdit = true;
      } else {
        const directCollab = await db.query.diagramCollaborators.findFirst({
          where: and(
            eq(diagramCollaborators.diagramId, diagramId),
            eq(diagramCollaborators.userId, userId),
          ),
        });
        if (directCollab) {
          canEdit = directCollab.role === 'editor';
        }
      }
    }

    return {
      id: diagram.id,
      projectId: diagram.projectId,
      folderId: diagram.folderId,
      title: diagram.title,
      documentContent: diagram.documentContent,
      viewMode: (diagram.viewMode as any) || 'both',
      isStarred: diagram.isStarred,
      deletedAt: diagram.deletedAt ? diagram.deletedAt.toISOString() : null,
      mermaidCode: diagram.mermaidCode,
      thumbnailKey: diagram.thumbnailKey,
      isPublic: diagram.isPublic,
      shareToken: diagram.shareToken,
      shareRole: (diagram.shareRole as 'viewer' | 'editor') || 'viewer',
      canEdit,
      createdBy: diagram.createdBy,
      createdAt: diagram.createdAt.toISOString(),
      updatedAt: diagram.updatedAt.toISOString(),
      canvasData: diagram.canvas?.canvasData || { elements: [], appState: {} },
    };
  }

  async updateDiagram(
    diagramId: string,
    userId: string,
    dto: UpdateDiagramDto,
  ): Promise<DiagramDetail> {
    const existing = await db.query.diagrams.findFirst({
      where: eq(diagrams.id, diagramId),
      with: {
        project: true,
        canvas: true,
      },
    });

    if (!existing) {
      throw new NotFoundException('Diagram not found');
    }

    const updatedDiagram = await db.transaction(async (tx) => {
      let diag = existing;
      if (
        dto.title !== undefined ||
        dto.mermaidCode !== undefined ||
        dto.thumbnailKey !== undefined ||
        dto.folderId !== undefined ||
        dto.documentContent !== undefined ||
        dto.viewMode !== undefined ||
        dto.isStarred !== undefined
      ) {
        const [u] = await tx
          .update(diagrams)
          .set({
            ...(dto.title !== undefined ? { title: dto.title } : {}),
            ...(dto.mermaidCode !== undefined ? { mermaidCode: dto.mermaidCode } : {}),
            ...(dto.thumbnailKey !== undefined ? { thumbnailKey: dto.thumbnailKey } : {}),
            ...(dto.folderId !== undefined ? { folderId: dto.folderId } : {}),
            ...(dto.documentContent !== undefined ? { documentContent: dto.documentContent } : {}),
            ...(dto.viewMode !== undefined ? { viewMode: dto.viewMode } : {}),
            ...(dto.isStarred !== undefined ? { isStarred: dto.isStarred } : {}),
            updatedAt: new Date(),
          })
          .where(eq(diagrams.id, diagramId))
          .returning();
        diag = { ...diag, ...u };
      }

      if (dto.canvasData !== undefined) {
        await tx
          .insert(diagramCanvases)
          .values({
            diagramId,
            canvasData: dto.canvasData,
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: diagramCanvases.diagramId,
            set: {
              canvasData: dto.canvasData,
              updatedAt: new Date(),
            },
          });
      }

      return diag;
    });

    return {
      id: updatedDiagram.id,
      projectId: updatedDiagram.projectId,
      folderId: updatedDiagram.folderId,
      title: updatedDiagram.title,
      documentContent: updatedDiagram.documentContent,
      viewMode: (updatedDiagram.viewMode as any) || 'both',
      isStarred: updatedDiagram.isStarred,
      deletedAt: updatedDiagram.deletedAt ? updatedDiagram.deletedAt.toISOString() : null,
      mermaidCode: updatedDiagram.mermaidCode,
      thumbnailKey: updatedDiagram.thumbnailKey,
      isPublic: updatedDiagram.isPublic,
      shareToken: updatedDiagram.shareToken,
      shareRole: (updatedDiagram.shareRole as 'viewer' | 'editor') || 'viewer',
      canEdit: true,
      createdBy: updatedDiagram.createdBy,
      createdAt: updatedDiagram.createdAt.toISOString(),
      updatedAt: updatedDiagram.updatedAt.toISOString(),
      canvasData: dto.canvasData !== undefined ? dto.canvasData : existing.canvas?.canvasData,
    };
  }

  async moveDiagram(
    diagramId: string,
    userId: string,
    folderId: string | null,
  ): Promise<DiagramDetail> {
    const [updated] = await db
      .update(diagrams)
      .set({ folderId, updatedAt: new Date() })
      .where(eq(diagrams.id, diagramId))
      .returning();

    if (!updated) {
      throw new NotFoundException('Diagram not found');
    }

    return this.getDiagramDetail(diagramId);
  }

  async toggleStar(diagramId: string, userId: string): Promise<DiagramDetail> {
    const existing = await db.query.diagrams.findFirst({
      where: eq(diagrams.id, diagramId),
    });
    if (!existing) {
      throw new NotFoundException('Diagram not found');
    }

    const [updated] = await db
      .update(diagrams)
      .set({ isStarred: !existing.isStarred, updatedAt: new Date() })
      .where(eq(diagrams.id, diagramId))
      .returning();

    return this.getDiagramDetail(diagramId);
  }

  async deleteDiagram(diagramId: string, userId: string): Promise<void> {
    const diagram = await db.query.diagrams.findFirst({
      where: eq(diagrams.id, diagramId),
      with: { project: true },
    });

    if (!diagram) {
      throw new NotFoundException('Diagram not found');
    }

    await db.delete(diagrams).where(eq(diagrams.id, diagramId));

    this.eventEmitter.emit(
      'audit.log',
      new AuditLogEvent(diagram.project.workspaceId, userId, 'delete', 'diagram', diagramId),
    );
  }

  async batchDeleteDiagrams(diagramIds: string[], userId: string): Promise<{ deletedCount: number }> {
    if (!diagramIds || diagramIds.length === 0) {
      return { deletedCount: 0 };
    }

    const items = await db.query.diagrams.findMany({
      where: inArray(diagrams.id, diagramIds),
      with: { project: true },
    });

    if (items.length === 0) {
      return { deletedCount: 0 };
    }

    await db.delete(diagrams).where(inArray(diagrams.id, diagramIds));

    for (const item of items) {
      this.eventEmitter.emit(
        'audit.log',
        new AuditLogEvent(item.project.workspaceId, userId, 'delete', 'diagram', item.id),
      );
    }

    return { deletedCount: items.length };
  }

  async createVersion(
    diagramId: string,
    userId: string,
    dto: CreateDiagramVersionDto,
  ): Promise<DiagramVersionSummary> {
    const diagram = await this.getDiagramDetail(diagramId);

    const [version] = await db
      .insert(diagramVersions)
      .values({
        diagramId,
        versionName: dto.versionName || `Version ${new Date().toLocaleString()}`,
        mermaidCode: dto.mermaidCode !== undefined ? dto.mermaidCode : diagram.mermaidCode,
        canvasData: dto.canvasData !== undefined ? dto.canvasData : diagram.canvasData,
        createdBy: userId,
      })
      .returning();

    return {
      id: version.id,
      diagramId: version.diagramId,
      canvasData: version.canvasData,
      mermaidCode: version.mermaidCode,
      versionName: version.versionName,
      createdBy: version.createdBy,
      createdAt: version.createdAt.toISOString(),
    };
  }

  async listVersions(diagramId: string): Promise<DiagramVersionSummary[]> {
    const list = await db.query.diagramVersions.findMany({
      where: eq(diagramVersions.diagramId, diagramId),
      orderBy: [desc(diagramVersions.createdAt)],
    });

    return list.map((v) => ({
      id: v.id,
      diagramId: v.diagramId,
      canvasData: v.canvasData,
      mermaidCode: v.mermaidCode,
      versionName: v.versionName,
      createdBy: v.createdBy,
      createdAt: v.createdAt.toISOString(),
    }));
  }

  async updateShareSettings(
    diagramId: string,
    dto: UpdateShareSettingsDto,
  ): Promise<{ shareToken: string; isPublic: boolean; shareRole: 'viewer' | 'editor' }> {
    const existing = await db.query.diagrams.findFirst({
      where: eq(diagrams.id, diagramId),
    });
    if (!existing) {
      throw new NotFoundException('Diagram not found');
    }

    let token = existing.shareToken;
    if (dto.isPublic && !token) {
      token = crypto.randomBytes(16).toString('hex');
    }

    const shareRole = dto.shareRole || existing.shareRole || 'viewer';

    const [updated] = await db
      .update(diagrams)
      .set({
        isPublic: dto.isPublic,
        shareToken: token,
        shareRole: shareRole as any,
        updatedAt: new Date(),
      })
      .where(eq(diagrams.id, diagramId))
      .returning();

    if (!updated) {
      throw new NotFoundException('Diagram not found');
    }

    return {
      shareToken: updated.shareToken || '',
      isPublic: updated.isPublic,
      shareRole: (updated.shareRole as 'viewer' | 'editor') || 'viewer',
    };
  }

  async getPublicDiagram(shareToken: string): Promise<DiagramDetail> {
    const diagram = await db.query.diagrams.findFirst({
      where: eq(diagrams.shareToken, shareToken),
      with: {
        canvas: true,
      },
    });

    if (!diagram || !diagram.isPublic) {
      throw new NotFoundException('Diagram not found or sharing is disabled');
    }

    const isEditor = diagram.shareRole === 'editor';

    return {
      id: diagram.id,
      projectId: diagram.projectId,
      folderId: diagram.folderId,
      title: diagram.title,
      documentContent: diagram.documentContent,
      viewMode: (diagram.viewMode as any) || 'both',
      isStarred: diagram.isStarred,
      deletedAt: diagram.deletedAt ? diagram.deletedAt.toISOString() : null,
      mermaidCode: diagram.mermaidCode,
      thumbnailKey: diagram.thumbnailKey,
      isPublic: diagram.isPublic,
      shareToken: diagram.shareToken,
      shareRole: (diagram.shareRole as 'viewer' | 'editor') || 'viewer',
      canEdit: isEditor,
      createdBy: diagram.createdBy,
      createdAt: diagram.createdAt.toISOString(),
      updatedAt: diagram.updatedAt.toISOString(),
      canvasData: diagram.canvas?.canvasData || { elements: [], appState: {} },
    };
  }

  async updatePublicDiagram(
    shareToken: string,
    dto: UpdateSharedDiagramDto,
  ): Promise<DiagramDetail> {
    const diagram = await db.query.diagrams.findFirst({
      where: eq(diagrams.shareToken, shareToken),
      with: {
        canvas: true,
      },
    });

    if (!diagram || !diagram.isPublic) {
      throw new NotFoundException('Diagram not found or sharing is disabled');
    }

    if (diagram.shareRole !== 'editor') {
      throw new ForbiddenException('You only have view permissions on this shared diagram');
    }

    const updatedDiagram = await db.transaction(async (tx) => {
      let diag = diagram;
      if (
        dto.title !== undefined ||
        dto.mermaidCode !== undefined ||
        dto.documentContent !== undefined ||
        dto.viewMode !== undefined
      ) {
        const [u] = await tx
          .update(diagrams)
          .set({
            ...(dto.title !== undefined ? { title: dto.title } : {}),
            ...(dto.mermaidCode !== undefined ? { mermaidCode: dto.mermaidCode } : {}),
            ...(dto.documentContent !== undefined ? { documentContent: dto.documentContent } : {}),
            ...(dto.viewMode !== undefined ? { viewMode: dto.viewMode } : {}),
            updatedAt: new Date(),
          })
          .where(eq(diagrams.id, diagram.id))
          .returning();
        diag = { ...diag, ...u };
      }

      if (dto.canvasData !== undefined) {
        await tx
          .insert(diagramCanvases)
          .values({
            diagramId: diagram.id,
            canvasData: dto.canvasData,
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: diagramCanvases.diagramId,
            set: {
              canvasData: dto.canvasData,
              updatedAt: new Date(),
            },
          });
      }

      return diag;
    });

    return {
      id: updatedDiagram.id,
      projectId: updatedDiagram.projectId,
      folderId: updatedDiagram.folderId,
      title: updatedDiagram.title,
      documentContent: updatedDiagram.documentContent,
      viewMode: (updatedDiagram.viewMode as any) || 'both',
      isStarred: updatedDiagram.isStarred,
      deletedAt: updatedDiagram.deletedAt ? updatedDiagram.deletedAt.toISOString() : null,
      mermaidCode: updatedDiagram.mermaidCode,
      thumbnailKey: updatedDiagram.thumbnailKey,
      isPublic: updatedDiagram.isPublic,
      shareToken: updatedDiagram.shareToken,
      shareRole: (updatedDiagram.shareRole as 'viewer' | 'editor') || 'viewer',
      canEdit: true,
      createdBy: updatedDiagram.createdBy,
      createdAt: updatedDiagram.createdAt.toISOString(),
      updatedAt: updatedDiagram.updatedAt.toISOString(),
      canvasData: dto.canvasData !== undefined ? dto.canvasData : diagram.canvas?.canvasData,
    };
  }

  async getDiagramAccessOverview(diagramId: string): Promise<DiagramAccessOverview> {
    const diagram = await db.query.diagrams.findFirst({
      where: eq(diagrams.id, diagramId),
      with: {
        project: {
          with: {
            workspace: {
              with: {
                owner: true,
                members: {
                  with: {
                    user: true,
                  },
                },
              },
            },
          },
        },
        collaborators: {
          with: {
            user: true,
          },
        },
      },
    });

    if (!diagram) {
      throw new NotFoundException('Diagram not found');
    }

    const ws = diagram.project.workspace;
    const owner = ws.owner
      ? {
          id: ws.owner.id,
          email: ws.owner.email,
          name: ws.owner.name,
          avatarUrl: ws.owner.avatarUrl,
          createdAt: ws.owner.createdAt.toISOString(),
          updatedAt: ws.owner.updatedAt.toISOString(),
        }
      : null;

    const workspaceMembersList = ws.members.map((m) => ({
      id: m.id,
      userId: m.userId,
      name: m.user?.name || 'Workspace Member',
      email: m.user?.email || '',
      avatarUrl: m.user?.avatarUrl || null,
      role: m.role,
    }));

    const collabs: DiagramCollaboratorSummary[] = diagram.collaborators.map((c) => ({
      id: c.id,
      diagramId: c.diagramId,
      userId: c.userId,
      email: c.email,
      role: (c.role as 'viewer' | 'editor') || 'viewer',
      user: c.user
        ? {
            id: c.user.id,
            email: c.user.email,
            name: c.user.name,
            avatarUrl: c.user.avatarUrl,
            createdAt: c.user.createdAt.toISOString(),
            updatedAt: c.user.updatedAt.toISOString(),
          }
        : undefined,
      createdAt: c.createdAt.toISOString(),
    }));

    return {
      diagramId: diagram.id,
      isPublic: diagram.isPublic,
      shareToken: diagram.shareToken,
      shareRole: (diagram.shareRole as 'viewer' | 'editor') || 'viewer',
      owner,
      workspaceMembers: workspaceMembersList,
      collaborators: collabs,
    };
  }

  async addCollaborator(
    diagramId: string,
    dto: AddDiagramCollaboratorDto,
  ): Promise<DiagramCollaboratorSummary> {
    const diagram = await db.query.diagrams.findFirst({
      where: eq(diagrams.id, diagramId),
    });
    if (!diagram) {
      throw new NotFoundException('Diagram not found');
    }

    const cleanEmail = dto.email.toLowerCase().trim();
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, cleanEmail),
    });

    const [collab] = await db
      .insert(diagramCollaborators)
      .values({
        diagramId,
        userId: existingUser?.id || null,
        email: cleanEmail,
        role: dto.role,
      })
      .onConflictDoUpdate({
        target: [diagramCollaborators.diagramId, diagramCollaborators.email],
        set: {
          role: dto.role,
          ...(existingUser?.id ? { userId: existingUser.id } : {}),
        },
      })
      .returning();

    if (existingUser && existingUser.id !== diagram.createdBy) {
      this.notificationsService
        .createNotification({
          userId: existingUser.id,
          type: 'diagram_shared',
          title: 'Diagram Shared',
          message: `"${diagram.title}" was shared with you as ${dto.role}`,
          link: `/d/${diagram.id}`,
          metadata: {
            diagramId: diagram.id,
            diagramTitle: diagram.title,
            role: dto.role,
          },
        })
        .catch(() => {});
    }

    return {
      id: collab.id,
      diagramId: collab.diagramId,
      userId: collab.userId,
      email: collab.email,
      role: collab.role as 'viewer' | 'editor',
      user: existingUser
        ? {
            id: existingUser.id,
            email: existingUser.email,
            name: existingUser.name,
            avatarUrl: existingUser.avatarUrl,
            createdAt: existingUser.createdAt.toISOString(),
            updatedAt: existingUser.updatedAt.toISOString(),
          }
        : undefined,
      createdAt: collab.createdAt.toISOString(),
    };
  }

  async removeCollaborator(diagramId: string, collaboratorId: string): Promise<void> {
    await db
      .delete(diagramCollaborators)
      .where(
        and(
          eq(diagramCollaborators.id, collaboratorId),
          eq(diagramCollaborators.diagramId, diagramId),
        ),
      );
  }

  async updateCollaboratorRole(
    diagramId: string,
    collaboratorId: string,
    dto: UpdateDiagramCollaboratorDto,
  ): Promise<DiagramCollaboratorSummary> {
    const [updated] = await db
      .update(diagramCollaborators)
      .set({ role: dto.role })
      .where(
        and(
          eq(diagramCollaborators.id, collaboratorId),
          eq(diagramCollaborators.diagramId, diagramId),
        ),
      )
      .returning();

    if (!updated) {
      throw new NotFoundException('Collaborator not found');
    }

    const user = updated.userId
      ? await db.query.users.findFirst({
          where: eq(users.id, updated.userId),
        })
      : null;

    return {
      id: updated.id,
      diagramId: updated.diagramId,
      userId: updated.userId,
      email: updated.email,
      role: updated.role as 'viewer' | 'editor',
      user: user
        ? {
            id: user.id,
            email: user.email,
            name: user.name,
            avatarUrl: user.avatarUrl,
            createdAt: user.createdAt.toISOString(),
            updatedAt: user.updatedAt.toISOString(),
          }
        : undefined,
      createdAt: updated.createdAt.toISOString(),
    };
  }
}
