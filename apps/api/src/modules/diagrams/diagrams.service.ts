import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as crypto from 'crypto';
import { eq, desc } from 'drizzle-orm';
import { db } from '../../database/drizzle.client';
import {
  diagrams,
  diagramCanvases,
  diagramVersions,
  projects,
} from '../../database/schema';
import {
  CreateDiagramDto,
  UpdateDiagramDto,
  CreateDiagramVersionDto,
  UpdateShareSettingsDto,
  DiagramSummary,
  DiagramDetail,
  DiagramVersionSummary,
} from '@diagramz/shared';
import { AuditLogEvent } from '../audit/audit.event';

@Injectable()
export class DiagramsService {
  constructor(private eventEmitter: EventEmitter2) {}

  async listProjectDiagrams(projectId: string): Promise<DiagramSummary[]> {
    const list = await db.query.diagrams.findMany({
      where: eq(diagrams.projectId, projectId),
      orderBy: [desc(diagrams.updatedAt)],
    });

    return list.map((d) => ({
      id: d.id,
      projectId: d.projectId,
      title: d.title,
      mermaidCode: d.mermaidCode,
      thumbnailKey: d.thumbnailKey,
      isPublic: d.isPublic,
      shareToken: d.shareToken,
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
          title: dto.title,
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
      title: result.title,
      mermaidCode: result.mermaidCode,
      thumbnailKey: result.thumbnailKey,
      isPublic: result.isPublic,
      shareToken: result.shareToken,
      createdBy: result.createdBy,
      createdAt: result.createdAt.toISOString(),
      updatedAt: result.updatedAt.toISOString(),
      canvasData: initialCanvas,
    };
  }

  async getDiagramDetail(diagramId: string): Promise<DiagramDetail> {
    const diagram = await db.query.diagrams.findFirst({
      where: eq(diagrams.id, diagramId),
      with: {
        canvas: true,
      },
    });

    if (!diagram) {
      throw new NotFoundException('Diagram not found');
    }

    return {
      id: diagram.id,
      projectId: diagram.projectId,
      title: diagram.title,
      mermaidCode: diagram.mermaidCode,
      thumbnailKey: diagram.thumbnailKey,
      isPublic: diagram.isPublic,
      shareToken: diagram.shareToken,
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
        dto.thumbnailKey !== undefined
      ) {
        const [u] = await tx
          .update(diagrams)
          .set({
            ...(dto.title ? { title: dto.title } : {}),
            ...(dto.mermaidCode !== undefined ? { mermaidCode: dto.mermaidCode } : {}),
            ...(dto.thumbnailKey !== undefined ? { thumbnailKey: dto.thumbnailKey } : {}),
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
      title: updatedDiagram.title,
      mermaidCode: updatedDiagram.mermaidCode,
      thumbnailKey: updatedDiagram.thumbnailKey,
      isPublic: updatedDiagram.isPublic,
      shareToken: updatedDiagram.shareToken,
      createdBy: updatedDiagram.createdBy,
      createdAt: updatedDiagram.createdAt.toISOString(),
      updatedAt: updatedDiagram.updatedAt.toISOString(),
      canvasData: dto.canvasData !== undefined ? dto.canvasData : existing.canvas?.canvasData,
    };
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
  ): Promise<{ shareToken: string; isPublic: boolean }> {
    let token: string | undefined;
    if (dto.isPublic) {
      token = crypto.randomBytes(16).toString('hex');
    }

    const [updated] = await db
      .update(diagrams)
      .set({
        isPublic: dto.isPublic,
        ...(token ? { shareToken: token } : {}),
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

    return {
      id: diagram.id,
      projectId: diagram.projectId,
      title: diagram.title,
      mermaidCode: diagram.mermaidCode,
      thumbnailKey: diagram.thumbnailKey,
      isPublic: diagram.isPublic,
      shareToken: diagram.shareToken,
      createdBy: diagram.createdBy,
      createdAt: diagram.createdAt.toISOString(),
      updatedAt: diagram.updatedAt.toISOString(),
      canvasData: diagram.canvas?.canvasData || { elements: [], appState: {} },
    };
  }
}
