import { SetMetadata } from '@nestjs/common';
import { WorkspaceRole } from '@diagramz/shared';

export const WORKSPACE_ROLE_KEY = 'workspace_role';
export const RequireWorkspaceRole = (role: WorkspaceRole) =>
  SetMetadata(WORKSPACE_ROLE_KEY, role);
