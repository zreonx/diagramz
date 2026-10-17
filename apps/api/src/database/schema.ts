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
  integer,
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

// 6.1 Folders (Hierarchical folder tree per workspace)
export const folders = pgTable(
  'folders',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workspaceId: uuid('workspace_id')
      .references(() => workspaces.id, { onDelete: 'cascade' })
      .notNull(),
    parentId: uuid('parent_id'),
    name: text('name').notNull(),
    icon: text('icon'),
    position: integer('position').default(0).notNull(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('idx_folders_workspace').on(t.workspaceId),
    index('idx_folders_parent').on(t.parentId),
  ],
);

// 7. Diagrams & Documents (Eraser-style dual Canvas + Doc)
export const diagrams = pgTable(
  'diagrams',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id')
      .references(() => projects.id, { onDelete: 'cascade' })
      .notNull(),
    folderId: uuid('folder_id').references(() => folders.id, { onDelete: 'set null' }),
    title: text('title').notNull(),
    documentContent: text('document_content'),
    viewMode: text('view_mode').default('both').notNull(),
    isStarred: boolean('is_starred').default(false).notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    mermaidCode: text('mermaid_code'),
    thumbnailKey: text('thumbnail_key'),
    isPublic: boolean('is_public').default(false).notNull(),
    shareToken: text('share_token').unique(),
    shareRole: collaboratorRoleEnum('share_role').default('viewer').notNull(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('idx_diagrams_project').on(t.projectId),
    index('idx_diagrams_folder').on(t.folderId),
  ],
);

// 8. Diagram Canvases (Isolated to prevent heavy JSON query degradation)
export const diagramCanvases = pgTable('diagram_canvases', {
  diagramId: uuid('diagram_id')
    .references(() => diagrams.id, { onDelete: 'cascade' })
    .primaryKey(),
  canvasData: jsonb('canvas_data').notNull(), // zcanvaskit document (nodes, edges, strokes, viewport)
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

// 9.1 Diagram Direct Collaborators
export const diagramCollaborators = pgTable(
  'diagram_collaborators',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    diagramId: uuid('diagram_id')
      .references(() => diagrams.id, { onDelete: 'cascade' })
      .notNull(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    role: collaboratorRoleEnum('role').default('viewer').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    unique().on(t.diagramId, t.email),
    index('idx_diagram_collaborators_diagram').on(t.diagramId),
    index('idx_diagram_collaborators_user').on(t.userId),
    index('idx_diagram_collaborators_email').on(t.email),
  ],
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

// 11. Notifications
export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    type: text('type').notNull(),
    title: text('title').notNull(),
    message: text('message').notNull(),
    link: text('link'),
    isRead: boolean('is_read').default(false).notNull(),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('idx_notifications_user_read').on(t.userId, t.isRead),
    index('idx_notifications_user_created').on(t.userId, t.createdAt),
  ],
);

// 12. User Notification Preferences
export const userNotificationPreferences = pgTable('user_notification_preferences', {
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .primaryKey(),
  diagramShared: boolean('diagram_shared').default(true).notNull(),
  teamInvite: boolean('team_invite').default(true).notNull(),
  commentAdded: boolean('comment_added').default(false).notNull(),
  weeklyDigest: boolean('weekly_digest').default(false).notNull(),
  productUpdates: boolean('product_updates').default(true).notNull(),
  securityAlerts: boolean('security_alerts').default(true).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Drizzle Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  memberships: many(workspaceMembers),
  ownedWorkspaces: many(workspaces),
  refreshTokens: many(refreshTokens),
  createdProjects: many(projects),
  createdDiagrams: many(diagrams),
  diagramCollaborations: many(diagramCollaborators),
  notifications: many(notifications),
  notificationPreferences: one(userNotificationPreferences),
}));

export const workspacesRelations = relations(workspaces, ({ one, many }) => ({
  owner: one(users, {
    fields: [workspaces.ownerId],
    references: [users.id],
  }),
  members: many(workspaceMembers),
  invitations: many(workspaceInvitations),
  projects: many(projects),
  folders: many(folders),
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

export const workspaceInvitationsRelations = relations(workspaceInvitations, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [workspaceInvitations.workspaceId],
    references: [workspaces.id],
  }),
}));

export const foldersRelations = relations(folders, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [folders.workspaceId],
    references: [workspaces.id],
  }),
  parent: one(folders, {
    fields: [folders.parentId],
    references: [folders.id],
    relationName: 'folder_subfolders',
  }),
  children: many(folders, {
    relationName: 'folder_subfolders',
  }),
  diagrams: many(diagrams),
  creator: one(users, {
    fields: [folders.createdBy],
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
  folder: one(folders, {
    fields: [diagrams.folderId],
    references: [folders.id],
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
  collaborators: many(diagramCollaborators),
}));

export const diagramCollaboratorsRelations = relations(diagramCollaborators, ({ one }) => ({
  diagram: one(diagrams, {
    fields: [diagramCollaborators.diagramId],
    references: [diagrams.id],
  }),
  user: one(users, {
    fields: [diagramCollaborators.userId],
    references: [users.id],
  }),
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

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
}));

export const userNotificationPreferencesRelations = relations(userNotificationPreferences, ({ one }) => ({
  user: one(users, {
    fields: [userNotificationPreferences.userId],
    references: [users.id],
  }),
}));
