import {
  pgTable,
  text,
  timestamp,
  uuid,
  boolean,
  jsonb,
  pgEnum,
  unique,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const workspaceRoleEnum = pgEnum('workspace_role', ['owner', 'admin', 'editor', 'viewer']);
export const collaboratorRoleEnum = pgEnum('collaborator_role', ['editor', 'viewer']);

// 1. Users
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash'),
  name: text('name').notNull(),
  avatarUrl: text('avatar_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// 2. Refresh Tokens (Rotation & Session Invalidation)
export const refreshTokens = pgTable('refresh_tokens', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  tokenHash: text('token_hash').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// 3. Workspaces
export const workspaces = pgTable('workspaces', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  ownerId: uuid('owner_id')
    .references(() => users.id, { onDelete: 'restrict' })
    .notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// 4. Workspace Members
export const workspaceMembers = pgTable(
  'workspace_members',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workspaceId: uuid('workspace_id')
      .references(() => workspaces.id, { onDelete: 'cascade' })
      .notNull(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    role: workspaceRoleEnum('role').default('editor').notNull(),
    joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    unique().on(t.workspaceId, t.userId),
    index('idx_workspace_members_user').on(t.userId),
  ],
);

// 5. Workspace Invitations
export const workspaceInvitations = pgTable('workspace_invitations', {
  id: uuid('id').defaultRandom().primaryKey(),
  workspaceId: uuid('workspace_id')
    .references(() => workspaces.id, { onDelete: 'cascade' })
    .notNull(),
  email: text('email').notNull(),
  role: workspaceRoleEnum('role').default('editor').notNull(),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// 6. Projects
export const projects = pgTable(
  'projects',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workspaceId: uuid('workspace_id')
      .references(() => workspaces.id, { onDelete: 'cascade' })
      .notNull(),
    name: text('name').notNull(),
    description: text('description'),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('idx_projects_workspace').on(t.workspaceId)],
);

// 7. Diagrams (Metadata & References Only)
export const diagrams = pgTable(
  'diagrams',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id')
      .references(() => projects.id, { onDelete: 'cascade' })
      .notNull(),
    title: text('title').notNull(),
    mermaidCode: text('mermaid_code'),
    thumbnailKey: text('thumbnail_key'),
    isPublic: boolean('is_public').default(false).notNull(),
    shareToken: text('share_token').unique(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('idx_diagrams_project').on(t.projectId)],
);

// 8. Diagram Canvases (Isolated to prevent heavy JSON query degradation)
export const diagramCanvases = pgTable('diagram_canvases', {
  diagramId: uuid('diagram_id')
    .references(() => diagrams.id, { onDelete: 'cascade' })
    .primaryKey(),
  canvasData: jsonb('canvas_data').notNull(), // Excalidraw elements & state
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// 9. Diagram Versions (Checkpoints)
export const diagramVersions = pgTable(
  'diagram_versions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    diagramId: uuid('diagram_id')
      .references(() => diagrams.id, { onDelete: 'cascade' })
      .notNull(),
    canvasData: jsonb('canvas_data').notNull(),
    mermaidCode: text('mermaid_code'),
    versionName: text('version_name'),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('idx_diagram_versions_diagram').on(t.diagramId)],
);

// 10. Audit Logs
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workspaceId: uuid('workspace_id')
      .references(() => workspaces.id, { onDelete: 'cascade' })
      .notNull(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    action: text('action').notNull(),
    resourceType: text('resource_type').notNull(),
    resourceId: text('resource_id').notNull(),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('idx_audit_logs_workspace').on(t.workspaceId)],
);

// Drizzle Relations
export const usersRelations = relations(users, ({ many }) => ({
  memberships: many(workspaceMembers),
  ownedWorkspaces: many(workspaces),
  refreshTokens: many(refreshTokens),
  createdProjects: many(projects),
  createdDiagrams: many(diagrams),
}));

export const workspacesRelations = relations(workspaces, ({ one, many }) => ({
  owner: one(users, {
    fields: [workspaces.ownerId],
    references: [users.id],
  }),
  members: many(workspaceMembers),
  invitations: many(workspaceInvitations),
  projects: many(projects),
  auditLogs: many(auditLogs),
}));

export const workspaceMembersRelations = relations(workspaceMembers, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [workspaceMembers.workspaceId],
    references: [workspaces.id],
  }),
  user: one(users, {
    fields: [workspaceMembers.userId],
    references: [users.id],
  }),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [projects.workspaceId],
    references: [workspaces.id],
  }),
  creator: one(users, {
    fields: [projects.createdBy],
    references: [users.id],
  }),
  diagrams: many(diagrams),
}));

export const diagramsRelations = relations(diagrams, ({ one, many }) => ({
  project: one(projects, {
    fields: [diagrams.projectId],
    references: [projects.id],
  }),
  creator: one(users, {
    fields: [diagrams.createdBy],
    references: [users.id],
  }),
  canvas: one(diagramCanvases, {
    fields: [diagrams.id],
    references: [diagramCanvases.diagramId],
  }),
  versions: many(diagramVersions),
}));

export const diagramCanvasesRelations = relations(diagramCanvases, ({ one }) => ({
  diagram: one(diagrams, {
    fields: [diagramCanvases.diagramId],
    references: [diagrams.id],
  }),
}));

export const diagramVersionsRelations = relations(diagramVersions, ({ one }) => ({
  diagram: one(diagrams, {
    fields: [diagramVersions.diagramId],
    references: [diagrams.id],
  }),
  creator: one(users, {
    fields: [diagramVersions.createdBy],
    references: [users.id],
  }),
}));
