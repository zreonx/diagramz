import type { WorkspaceRole } from './roles.js';

export interface UserSummary {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceSummary {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  role?: WorkspaceRole;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceMemberSummary {
  id: string;
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  joinedAt: string;
  user?: UserSummary;
}

export interface WorkspaceInvitationSummary {
  id: string;
  workspaceId: string;
  email: string;
  role: WorkspaceRole;
  token: string;
  expiresAt: string;
  createdAt: string;
}

export interface ProjectSummary {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DiagramSummary {
  id: string;
  projectId: string;
  title: string;
  mermaidCode: string | null;
  thumbnailKey: string | null;
  isPublic: boolean;
  shareToken: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DiagramDetail extends DiagramSummary {
  canvasData: unknown;
}

export interface DiagramVersionSummary {
  id: string;
  diagramId: string;
  canvasData: unknown;
  mermaidCode: string | null;
  versionName: string | null;
  createdBy: string | null;
  createdAt: string;
}

export interface AuditLogSummary {
  id: string;
  workspaceId: string;
  userId: string | null;
  action: string;
  resourceType: string;
  resourceId: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}
