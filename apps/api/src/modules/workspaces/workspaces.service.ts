import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as crypto from 'crypto';
import { eq, and } from 'drizzle-orm';
import { db } from '../../database/drizzle.client';
import {
  workspaces,
  workspaceMembers,
  workspaceInvitations,
  users,
} from '../../database/schema';
import {
  CreateWorkspaceDto,
  UpdateWorkspaceDto,
  InviteMemberDto,
  UpdateMemberRoleDto,
  WorkspaceSummary,
  WorkspaceMemberSummary,
  WorkspaceInvitationSummary,
  WorkspaceInvitationDetails,
  AcceptInvitationResponse,
  WorkspaceRole,
} from '@diagramz/shared';
import { AuditLogEvent } from '../audit/audit.event';
import { EmailService } from '../email/email.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class WorkspacesService {
  constructor(
    private eventEmitter: EventEmitter2,
    private emailService: EmailService,
    private notificationsService: NotificationsService,
  ) {}

  async getUserWorkspaces(userId: string): Promise<WorkspaceSummary[]> {
    const memberships = await db.query.workspaceMembers.findMany({
      where: eq(workspaceMembers.userId, userId),
      with: {
        workspace: true,
      },
    });

    return memberships.map((m) => ({
      id: m.workspace.id,
      name: m.workspace.name,
      slug: m.workspace.slug,
      ownerId: m.workspace.ownerId,
      role: m.role as WorkspaceRole,
      createdAt: m.workspace.createdAt.toISOString(),
      updatedAt: m.workspace.updatedAt.toISOString(),
    }));
  }

  async createWorkspace(userId: string, dto: CreateWorkspaceDto): Promise<WorkspaceSummary> {
    const existing = await db.query.workspaces.findFirst({
      where: eq(workspaces.slug, dto.slug.toLowerCase()),
    });

    if (existing) {
      throw new ConflictException('A workspace with this slug already exists');
    }

    const created = await db.transaction(async (tx) => {
      const [workspace] = await tx
        .insert(workspaces)
        .values({
          name: dto.name,
          slug: dto.slug.toLowerCase(),
          ownerId: userId,
        })
        .returning();

      await tx.insert(workspaceMembers).values({
        workspaceId: workspace.id,
        userId,
        role: 'owner',
      });

      return workspace;
    });

    this.eventEmitter.emit(
      'audit.log',
      new AuditLogEvent(created.id, userId, 'create', 'workspace', created.id, {
        name: created.name,
        slug: created.slug,
      }),
    );

    return {
      id: created.id,
      name: created.name,
      slug: created.slug,
      ownerId: created.ownerId,
      role: 'owner',
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    };
  }

  async getWorkspaceBySlug(userId: string, slug: string): Promise<WorkspaceSummary> {
    const workspace = await db.query.workspaces.findFirst({
      where: eq(workspaces.slug, slug.toLowerCase()),
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    const membership = await db.query.workspaceMembers.findFirst({
      where: and(
        eq(workspaceMembers.workspaceId, workspace.id),
        eq(workspaceMembers.userId, userId),
      ),
    });

    if (!membership) {
      throw new ForbiddenException('You do not have access to this workspace');
    }

    return {
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      ownerId: workspace.ownerId,
      role: membership.role as WorkspaceRole,
      createdAt: workspace.createdAt.toISOString(),
      updatedAt: workspace.updatedAt.toISOString(),
    };
  }

  async updateWorkspace(
    workspaceId: string,
    userId: string,
    dto: UpdateWorkspaceDto,
  ): Promise<WorkspaceSummary> {
    if (dto.slug) {
      const existing = await db.query.workspaces.findFirst({
        where: eq(workspaces.slug, dto.slug.toLowerCase()),
      });
      if (existing && existing.id !== workspaceId) {
        throw new ConflictException('Slug already taken');
      }
    }

    const [updated] = await db
      .update(workspaces)
      .set({
        ...(dto.name ? { name: dto.name } : {}),
        ...(dto.slug ? { slug: dto.slug.toLowerCase() } : {}),
        updatedAt: new Date(),
      })
      .where(eq(workspaces.id, workspaceId))
      .returning();

    if (!updated) {
      throw new NotFoundException('Workspace not found');
    }

    this.eventEmitter.emit(
      'audit.log',
      new AuditLogEvent(workspaceId, userId, 'update', 'workspace', workspaceId, dto),
    );

    return {
      id: updated.id,
      name: updated.name,
      slug: updated.slug,
      ownerId: updated.ownerId,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }

  async deleteWorkspace(workspaceId: string, userId: string): Promise<void> {
    const ws = await db.query.workspaces.findFirst({
      where: eq(workspaces.id, workspaceId),
    });

    if (!ws) {
      throw new NotFoundException('Workspace not found');
    }

    if (ws.ownerId !== userId) {
      throw new ForbiddenException('Only the workspace owner can delete the workspace');
    }

    await db.delete(workspaces).where(eq(workspaces.id, workspaceId));

    this.eventEmitter.emit(
      'audit.log',
      new AuditLogEvent(workspaceId, userId, 'delete', 'workspace', workspaceId),
    );
  }

  async getMembers(workspaceId: string): Promise<WorkspaceMemberSummary[]> {
    const members = await db.query.workspaceMembers.findMany({
      where: eq(workspaceMembers.workspaceId, workspaceId),
      with: {
        user: true,
      },
    });

    return members.map((m) => ({
      id: m.id,
      workspaceId: m.workspaceId,
      userId: m.userId,
      role: m.role as WorkspaceRole,
      joinedAt: m.joinedAt.toISOString(),
      user: {
        id: m.user.id,
        email: m.user.email,
        name: m.user.name,
        avatarUrl: m.user.avatarUrl,
        createdAt: m.user.createdAt.toISOString(),
        updatedAt: m.user.updatedAt.toISOString(),
      },
    }));
  }

  async inviteMember(
    workspaceId: string,
    inviterId: string,
    dto: InviteMemberDto,
  ): Promise<WorkspaceInvitationSummary> {
    const normalizedEmail = dto.email.toLowerCase();

    // Check if already a member
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, normalizedEmail),
    });

    if (existingUser) {
      const existingMember = await db.query.workspaceMembers.findFirst({
        where: and(
          eq(workspaceMembers.workspaceId, workspaceId),
          eq(workspaceMembers.userId, existingUser.id),
        ),
      });

      if (existingMember) {
        throw new ConflictException('User is already a member of this workspace');
      }
    }

    // If an invitation already exists for this email in this workspace, delete it first to issue a fresh token
    await db
      .delete(workspaceInvitations)
      .where(
        and(
          eq(workspaceInvitations.workspaceId, workspaceId),
          eq(workspaceInvitations.email, normalizedEmail),
        ),
      );

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const [invitation] = await db
      .insert(workspaceInvitations)
      .values({
        workspaceId,
        email: normalizedEmail,
        role: dto.role,
        token,
        expiresAt,
      })
      .returning();

    this.eventEmitter.emit(
      'audit.log',
      new AuditLogEvent(workspaceId, inviterId, 'invite', 'member', invitation.id, {
        email: normalizedEmail,
        role: dto.role,
      }),
    );

    // Dispatch invitation email via Resend
    const ws = await db.query.workspaces.findFirst({
      where: eq(workspaces.id, workspaceId),
    });
    const inviter = await db.query.users.findFirst({
      where: eq(users.id, inviterId),
    });

    if (ws) {
      this.emailService
        .sendWorkspaceInvitation({
          to: normalizedEmail,
          workspaceName: ws.name,
          role: dto.role,
          token,
          inviterName: inviter?.name,
          inviterEmail: inviter?.email,
        })
        .catch(() => {});
    }

    if (existingUser && existingUser.id !== inviterId) {
      this.notificationsService
        .createNotification({
          userId: existingUser.id,
          type: 'team_invite',
          title: 'Workspace Invitation',
          message: `${inviter?.name || 'A teammate'} invited you to join "${ws?.name || 'a workspace'}" as ${dto.role}`,
          link: `/invite/${token}`,
          metadata: {
            workspaceId,
            workspaceName: ws?.name,
            inviterId,
            inviterName: inviter?.name,
            role: dto.role,
            token,
          },
        })
        .catch(() => {});
    }

    return {
      id: invitation.id,
      workspaceId: invitation.workspaceId,
      email: invitation.email,
      role: invitation.role as WorkspaceRole,
      token: invitation.token,
      expiresAt: invitation.expiresAt.toISOString(),
      createdAt: invitation.createdAt.toISOString(),
    };
  }

  async updateMemberRole(
    workspaceId: string,
    adminId: string,
    memberId: string,
    dto: UpdateMemberRoleDto,
  ): Promise<WorkspaceMemberSummary> {
    const member = await db.query.workspaceMembers.findFirst({
      where: and(
        eq(workspaceMembers.id, memberId),
        eq(workspaceMembers.workspaceId, workspaceId),
      ),
      with: { user: true },
    });

    if (!member) {
      throw new NotFoundException('Member not found');
    }

    const ws = await db.query.workspaces.findFirst({
      where: eq(workspaces.id, workspaceId),
    });

    // Cannot modify workspace owner role
    if (ws && member.userId === ws.ownerId) {
      throw new ForbiddenException('Cannot modify the workspace owner role');
    }

    // Only owner can assign owner role
    if (dto.role === 'owner' && ws?.ownerId !== adminId) {
      throw new ForbiddenException('Only the current owner can transfer workspace ownership');
    }

    const [updated] = await db
      .update(workspaceMembers)
      .set({ role: dto.role })
      .where(eq(workspaceMembers.id, memberId))
      .returning();

    this.eventEmitter.emit(
      'audit.log',
      new AuditLogEvent(workspaceId, adminId, 'update_role', 'member', memberId, {
        targetUserId: member.userId,
        newRole: dto.role,
      }),
    );

    return {
      id: updated.id,
      workspaceId: updated.workspaceId,
      userId: updated.userId,
      role: updated.role as WorkspaceRole,
      joinedAt: updated.joinedAt.toISOString(),
      user: {
        id: member.user.id,
        email: member.user.email,
        name: member.user.name,
        avatarUrl: member.user.avatarUrl,
        createdAt: member.user.createdAt.toISOString(),
        updatedAt: member.user.updatedAt.toISOString(),
      },
    };
  }

  async removeMember(
    workspaceId: string,
    adminId: string,
    memberId: string,
  ): Promise<void> {
    const member = await db.query.workspaceMembers.findFirst({
      where: and(
        eq(workspaceMembers.id, memberId),
        eq(workspaceMembers.workspaceId, workspaceId),
      ),
    });

    if (!member) {
      throw new NotFoundException('Member not found');
    }

    const ws = await db.query.workspaces.findFirst({
      where: eq(workspaces.id, workspaceId),
    });

    if (ws && member.userId === ws.ownerId) {
      throw new BadRequestException('The workspace owner cannot be removed');
    }

    await db.delete(workspaceMembers).where(eq(workspaceMembers.id, memberId));

    this.eventEmitter.emit(
      'audit.log',
      new AuditLogEvent(workspaceId, adminId, 'remove', 'member', memberId, {
        targetUserId: member.userId,
      }),
    );
  }

  async getInvitationByToken(token: string): Promise<WorkspaceInvitationDetails> {
    const invitation = await db.query.workspaceInvitations.findFirst({
      where: eq(workspaceInvitations.token, token),
      with: {
        workspace: {
          with: {
            owner: true,
          },
        },
      },
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found or has expired');
    }

    if (new Date(invitation.expiresAt) < new Date()) {
      throw new BadRequestException('This invitation has expired. Please ask for a new invite.');
    }

    return {
      id: invitation.id,
      workspaceId: invitation.workspaceId,
      workspaceName: invitation.workspace.name,
      workspaceSlug: invitation.workspace.slug,
      email: invitation.email,
      role: invitation.role as WorkspaceRole,
      token: invitation.token,
      expiresAt: invitation.expiresAt.toISOString(),
      createdAt: invitation.createdAt.toISOString(),
      inviterName: invitation.workspace.owner?.name,
      inviterEmail: invitation.workspace.owner?.email,
    };
  }

  async acceptInvitation(
    token: string,
    userId: string,
    userEmail: string,
  ): Promise<AcceptInvitationResponse> {
    const invitation = await db.query.workspaceInvitations.findFirst({
      where: eq(workspaceInvitations.token, token),
      with: {
        workspace: true,
      },
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found or has already been accepted');
    }

    if (new Date(invitation.expiresAt) < new Date()) {
      throw new BadRequestException('This invitation has expired');
    }

    // Check if user is already a member
    const existingMember = await db.query.workspaceMembers.findFirst({
      where: and(
        eq(workspaceMembers.workspaceId, invitation.workspaceId),
        eq(workspaceMembers.userId, userId),
      ),
    });

    if (existingMember) {
      await db.delete(workspaceInvitations).where(eq(workspaceInvitations.id, invitation.id));
      return {
        workspace: {
          id: invitation.workspace.id,
          name: invitation.workspace.name,
          slug: invitation.workspace.slug,
          ownerId: invitation.workspace.ownerId,
          role: existingMember.role as WorkspaceRole,
          createdAt: invitation.workspace.createdAt.toISOString(),
          updatedAt: invitation.workspace.updatedAt.toISOString(),
        },
        role: existingMember.role as WorkspaceRole,
      };
    }

    await db.insert(workspaceMembers).values({
      workspaceId: invitation.workspaceId,
      userId,
      role: invitation.role,
    });

    await db.delete(workspaceInvitations).where(eq(workspaceInvitations.id, invitation.id));

    this.eventEmitter.emit(
      'audit.log',
      new AuditLogEvent(invitation.workspaceId, userId, 'join', 'member', userId, {
        role: invitation.role,
        email: userEmail,
      }),
    );

    return {
      workspace: {
        id: invitation.workspace.id,
        name: invitation.workspace.name,
        slug: invitation.workspace.slug,
        ownerId: invitation.workspace.ownerId,
        role: invitation.role as WorkspaceRole,
        createdAt: invitation.workspace.createdAt.toISOString(),
        updatedAt: invitation.workspace.updatedAt.toISOString(),
      },
      role: invitation.role as WorkspaceRole,
    };
  }

  async getInvitations(workspaceId: string): Promise<WorkspaceInvitationSummary[]> {
    const invites = await db.query.workspaceInvitations.findMany({
      where: eq(workspaceInvitations.workspaceId, workspaceId),
    });

    return invites.map((inv) => ({
      id: inv.id,
      workspaceId: inv.workspaceId,
      email: inv.email,
      role: inv.role as WorkspaceRole,
      token: inv.token,
      expiresAt: inv.expiresAt.toISOString(),
      createdAt: inv.createdAt.toISOString(),
    }));
  }

  async revokeInvitation(workspaceId: string, adminId: string, invitationId: string): Promise<void> {
    const inv = await db.query.workspaceInvitations.findFirst({
      where: and(
        eq(workspaceInvitations.id, invitationId),
        eq(workspaceInvitations.workspaceId, workspaceId),
      ),
    });

    if (!inv) {
      throw new NotFoundException('Invitation not found');
    }

    await db.delete(workspaceInvitations).where(eq(workspaceInvitations.id, invitationId));

    this.eventEmitter.emit(
      'audit.log',
      new AuditLogEvent(workspaceId, adminId, 'revoke_invite', 'invitation', invitationId, {
        email: inv.email,
      }),
    );
  }
}
