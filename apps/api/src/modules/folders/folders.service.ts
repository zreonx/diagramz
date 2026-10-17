import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { eq, and, isNull, inArray, asc } from 'drizzle-orm';
import { db } from '../../database/drizzle.client';
import {
  folders,
  diagrams,
  projects,
  workspaces,
} from '../../database/schema';
import {
  CreateFolderDto,
  UpdateFolderDto,
  MoveFolderDto,
  FolderSummary,
  WorkspaceFolderNode,
  WorkspaceTreeResponse,
  DiagramSummary,
} from '@diagramz/shared';

@Injectable()
export class FoldersService {
  async getWorkspaceTree(workspaceId: string): Promise<WorkspaceTreeResponse> {
    // 1. Get all folders in this workspace
    const allFolders = await db.query.folders.findMany({
      where: eq(folders.workspaceId, workspaceId),
      orderBy: [asc(folders.position), asc(folders.name)],
    });

    // 2. Get all projects in this workspace to find diagrams
    const workspaceProjects = await db.query.projects.findMany({
      where: eq(projects.workspaceId, workspaceId),
      columns: { id: true },
    });

    const projectIds = workspaceProjects.map((p) => p.id);

    let allDiagrams: any[] = [];
    if (projectIds.length > 0) {
      allDiagrams = await db.query.diagrams.findMany({
        where: and(
          inArray(diagrams.projectId, projectIds),
          isNull(diagrams.deletedAt),
        ),
        orderBy: [asc(diagrams.title)],
      });
    }

    const mapDiagram = (d: any): DiagramSummary => ({
      id: d.id,
      projectId: d.projectId,
      folderId: d.folderId,
      title: d.title,
      documentContent: d.documentContent,
      viewMode: d.viewMode,
      isStarred: d.isStarred,
      deletedAt: d.deletedAt ? d.deletedAt.toISOString() : null,
      mermaidCode: d.mermaidCode,
      thumbnailKey: d.thumbnailKey,
      isPublic: d.isPublic,
      shareToken: d.shareToken,
      createdBy: d.createdBy,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
    });

    // Group diagrams by folderId
    const diagramsByFolder = new Map<string, DiagramSummary[]>();
    const rootDiagrams: DiagramSummary[] = [];

    for (const d of allDiagrams) {
      const mapped = mapDiagram(d);
      if (d.folderId) {
        if (!diagramsByFolder.has(d.folderId)) {
          diagramsByFolder.set(d.folderId, []);
        }
        diagramsByFolder.get(d.folderId)!.push(mapped);
      } else {
        rootDiagrams.push(mapped);
      }
    }

    // Build hierarchical folder nodes
    const nodeMap = new Map<string, WorkspaceFolderNode>();
    for (const f of allFolders) {
      nodeMap.set(f.id, {
        id: f.id,
        workspaceId: f.workspaceId,
        parentId: f.parentId,
        name: f.name,
        icon: f.icon,
        position: f.position,
        createdBy: f.createdBy,
        createdAt: f.createdAt.toISOString(),
        updatedAt: f.updatedAt.toISOString(),
        children: [],
        diagrams: diagramsByFolder.get(f.id) || [],
      });
    }

    const rootFolders: WorkspaceFolderNode[] = [];
    for (const f of allFolders) {
      const node = nodeMap.get(f.id)!;
      if (f.parentId && nodeMap.has(f.parentId)) {
        nodeMap.get(f.parentId)!.children.push(node);
      } else {
        rootFolders.push(node);
      }
    }

    return {
      folders: rootFolders,
      rootDiagrams,
    };
  }

  async createFolder(
    userId: string,
    workspaceId: string,
    dto: CreateFolderDto,
  ): Promise<FolderSummary> {
    const ws = await db.query.workspaces.findFirst({
      where: eq(workspaces.id, workspaceId),
    });
    if (!ws) {
      throw new NotFoundException('Workspace not found');
    }

    if (dto.parentId) {
      const parent = await db.query.folders.findFirst({
        where: and(
          eq(folders.id, dto.parentId),
          eq(folders.workspaceId, workspaceId),
        ),
      });
      if (!parent) {
        throw new NotFoundException('Parent folder not found in this workspace');
      }
    }

    const [created] = await db
      .insert(folders)
      .values({
        workspaceId,
        parentId: dto.parentId || null,
        name: dto.name,
        icon: dto.icon || null,
        createdBy: userId,
      })
      .returning();

    return {
      id: created.id,
      workspaceId: created.workspaceId,
      parentId: created.parentId,
      name: created.name,
      icon: created.icon,
      position: created.position,
      createdBy: created.createdBy,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    };
  }

  async updateFolder(
    folderId: string,
    userId: string,
    dto: UpdateFolderDto,
  ): Promise<FolderSummary> {
    const existing = await db.query.folders.findFirst({
      where: eq(folders.id, folderId),
    });
    if (!existing) {
      throw new NotFoundException('Folder not found');
    }

    const [updated] = await db
      .update(folders)
      .set({
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.icon !== undefined ? { icon: dto.icon } : {}),
        ...(dto.position !== undefined ? { position: dto.position } : {}),
        updatedAt: new Date(),
      })
      .where(eq(folders.id, folderId))
      .returning();

    return {
      id: updated.id,
      workspaceId: updated.workspaceId,
      parentId: updated.parentId,
      name: updated.name,
      icon: updated.icon,
      position: updated.position,
      createdBy: updated.createdBy,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  async moveFolder(
    folderId: string,
    userId: string,
    dto: MoveFolderDto,
  ): Promise<FolderSummary> {
    if (dto.parentId === folderId) {
      throw new BadRequestException('A folder cannot be moved into itself');
    }

    const existing = await db.query.folders.findFirst({
      where: eq(folders.id, folderId),
    });
    if (!existing) {
      throw new NotFoundException('Folder not found');
    }

    if (dto.parentId) {
      // Prevent circular nesting
      let currParentId: string | null = dto.parentId;
      while (currParentId) {
        if (currParentId === folderId) {
          throw new BadRequestException('Cannot move folder into one of its subfolders');
        }
        const targetParent: any = await db.query.folders.findFirst({
          where: eq(folders.id, currParentId),
        });
        currParentId = targetParent ? targetParent.parentId : null;
      }
    }

    const [updated] = await db
      .update(folders)
      .set({
        parentId: dto.parentId,
        updatedAt: new Date(),
      })
      .where(eq(folders.id, folderId))
      .returning();

    return {
      id: updated.id,
      workspaceId: updated.workspaceId,
      parentId: updated.parentId,
      name: updated.name,
      icon: updated.icon,
      position: updated.position,
      createdBy: updated.createdBy,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  async deleteFolder(folderId: string, userId: string): Promise<{ success: boolean }> {
    const existing = await db.query.folders.findFirst({
      where: eq(folders.id, folderId),
    });
    if (!existing) {
      throw new NotFoundException('Folder not found');
    }

    // Move child diagrams to null folderId (root) before deleting folder
    await db
      .update(diagrams)
      .set({ folderId: null, updatedAt: new Date() })
      .where(eq(diagrams.folderId, folderId));

    // Delete folder (nested folders will cascade delete via schema or re-parent)
    await db.delete(folders).where(eq(folders.id, folderId));
    return { success: true };
  }
}
