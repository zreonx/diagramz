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

export interface WorkspaceInvitationDetails {
  id: string;
  workspaceId: string;
  workspaceName: string;
  workspaceSlug: string;
  email: string;
  role: WorkspaceRole;
  token: string;
  expiresAt: string;
  createdAt: string;
  inviterName?: string;
  inviterEmail?: string;
}

export interface AcceptInvitationResponse {
  workspace: WorkspaceSummary;
  role: WorkspaceRole;
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

export interface FolderSummary {
  id: string;
  workspaceId: string;
  parentId: string | null;
  name: string;
  icon: string | null;
  position: number;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceFolderNode extends FolderSummary {
  children: WorkspaceFolderNode[];
  diagrams: DiagramSummary[];
}

export interface WorkspaceTreeResponse {
  folders: WorkspaceFolderNode[];
  rootDiagrams: DiagramSummary[];
}

export interface DiagramSummary {
  id: string;
  projectId: string;
  folderId?: string | null;
  title: string;
  documentContent?: string | null;
  viewMode?: 'both' | 'doc' | 'canvas';
  isStarred?: boolean;
  deletedAt?: string | null;
  mermaidCode: string | null;
  thumbnailKey: string | null;
  isPublic: boolean;
  shareToken: string | null;
  shareRole?: 'viewer' | 'editor';
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DiagramDetail extends DiagramSummary {
  canvasData: unknown;
  canEdit?: boolean;
}

export interface DiagramCollaboratorSummary {
  id: string;
  diagramId: string;
  userId: string | null;
  email: string;
  role: 'viewer' | 'editor';
  user?: UserSummary;
  createdAt: string;
}

export interface DiagramAccessOverview {
  diagramId: string;
  isPublic: boolean;
  shareToken: string | null;
  shareRole: 'viewer' | 'editor';
  owner: UserSummary | null;
  workspaceMembers: {
    id: string;
    userId: string;
    name: string;
    email: string;
    avatarUrl: string | null;
    role: string;
  }[];
  collaborators: DiagramCollaboratorSummary[];
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
