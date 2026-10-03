import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { WORKSPACE_ROLE_KEY } from '../decorators/roles.decorator';
import { WorkspaceRole, hasMinimumRole, AuthSessionUser } from '@diagramz/shared';
import { db } from '../../database/drizzle.client';
import { workspaceMembers, projects, diagrams } from '../../database/schema';
import { eq, and } from 'drizzle-orm';

@Injectable()
export class WorkspaceRolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRole = this.reflector.getAllAndOverride<WorkspaceRole | undefined>(
      WORKSPACE_ROLE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRole) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthSessionUser | undefined;

    if (!user) {
      throw new ForbiddenException('User is not authenticated');
    }

    const workspaceId = await this.resolveWorkspaceId(request);

    if (!workspaceId) {
      throw new ForbiddenException('Could not determine workspace context for this operation');
    }

    const membership = await db.query.workspaceMembers.findFirst({
      where: and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.userId, user.id),
      ),
    });

    if (!membership) {
      throw new ForbiddenException('You do not have access to this workspace');
    }

    if (!hasMinimumRole(membership.role as WorkspaceRole, requiredRole)) {
      throw new ForbiddenException(
        `Insufficient permissions. Required role: ${requiredRole}, Current role: ${membership.role}`,
      );
    }

    // Attach workspace membership info to request
    request.workspaceMember = membership;
    request.workspaceId = workspaceId;

    return true;
  }

  private async resolveWorkspaceId(request: any): Promise<string | null> {
    // 1. Direct workspaceId in params or body or headers
    if (request.params?.workspaceId) return request.params.workspaceId;
    if (request.headers?.['x-workspace-id']) return request.headers['x-workspace-id'] as string;

    // 2. Direct workspace route like /workspaces/:id
    const routePath = request.route?.path || '';
    if (routePath.includes('/workspaces/:id') && request.params?.id) {
      return request.params.id;
    }

    // 3. Via projectId in params or body
    const projectId = request.params?.projectId || request.body?.projectId;
    if (projectId) {
      const proj = await db.query.projects.findFirst({
        where: eq(projects.id, projectId),
        columns: { workspaceId: true },
      });
      if (proj) return proj.workspaceId;
    }

    // 4. Via diagramId in params (/diagrams/:id)
    const diagramId = request.params?.diagramId || (routePath.includes('/diagrams/:id') ? request.params?.id : null);
    if (diagramId) {
      const diagram = await db.query.diagrams.findFirst({
        where: eq(diagrams.id, diagramId),
        columns: { projectId: true },
      });
      if (diagram) {
        const proj = await db.query.projects.findFirst({
          where: eq(projects.id, diagram.projectId),
          columns: { workspaceId: true },
        });
        if (proj) return proj.workspaceId;
      }
    }

    if (request.body?.workspaceId) {
      return request.body.workspaceId;
    }

    return null;
  }
}
