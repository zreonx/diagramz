import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { eq, desc } from 'drizzle-orm';
import { db } from '../../database/drizzle.client';
import { projects } from '../../database/schema';
import {
  CreateProjectDto,
  UpdateProjectDto,
  ProjectSummary,
} from '@diagramz/shared';
import { AuditLogEvent } from '../audit/audit.event';

@Injectable()
export class ProjectsService {
  constructor(private eventEmitter: EventEmitter2) {}

  async listWorkspaceProjects(workspaceId: string): Promise<ProjectSummary[]> {
    const list = await db.query.projects.findMany({
      where: eq(projects.workspaceId, workspaceId),
      orderBy: [desc(projects.updatedAt)],
    });

    return list.map((p) => ({
      id: p.id,
      workspaceId: p.workspaceId,
      name: p.name,
      description: p.description,
      createdBy: p.createdBy,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    }));
  }

  async createProject(
    workspaceId: string,
    userId: string,
    dto: CreateProjectDto,
  ): Promise<ProjectSummary> {
    const [project] = await db
      .insert(projects)
      .values({
        workspaceId,
        name: dto.name,
        description: dto.description || null,
        createdBy: userId,
      })
      .returning();

    this.eventEmitter.emit(
      'audit.log',
      new AuditLogEvent(workspaceId, userId, 'create', 'project', project.id, {
        name: project.name,
      }),
    );

    return {
      id: project.id,
      workspaceId: project.workspaceId,
      name: project.name,
      description: project.description,
      createdBy: project.createdBy,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
    };
  }

  async getProject(projectId: string): Promise<ProjectSummary> {
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return {
      id: project.id,
      workspaceId: project.workspaceId,
      name: project.name,
      description: project.description,
      createdBy: project.createdBy,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
    };
  }

  async updateProject(
    projectId: string,
    userId: string,
    dto: UpdateProjectDto,
  ): Promise<ProjectSummary> {
    const [updated] = await db
      .update(projects)
      .set({
        ...(dto.name ? { name: dto.name } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        updatedAt: new Date(),
      })
      .where(eq(projects.id, projectId))
      .returning();

    if (!updated) {
      throw new NotFoundException('Project not found');
    }

    this.eventEmitter.emit(
      'audit.log',
      new AuditLogEvent(updated.workspaceId, userId, 'update', 'project', projectId, dto),
    );

    return {
      id: updated.id,
      workspaceId: updated.workspaceId,
      name: updated.name,
      description: updated.description,
      createdBy: updated.createdBy,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  async deleteProject(projectId: string, userId: string): Promise<void> {
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    await db.delete(projects).where(eq(projects.id, projectId));

    this.eventEmitter.emit(
      'audit.log',
      new AuditLogEvent(project.workspaceId, userId, 'delete', 'project', projectId),
    );
  }
}
