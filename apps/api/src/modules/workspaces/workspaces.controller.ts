import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  UsePipes,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { WorkspacesService } from './workspaces.service';
import { AuditService } from '../audit/audit.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequireWorkspaceRole } from '../../common/decorators/roles.decorator';
import { WorkspaceRolesGuard } from '../../common/guards/workspace-roles.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  createWorkspaceSchema,
  updateWorkspaceSchema,
  inviteMemberSchema,
  updateMemberRoleSchema,
  CreateWorkspaceDto,
  UpdateWorkspaceDto,
  InviteMemberDto,
  UpdateMemberRoleDto,
  AuthSessionUser,
  WorkspaceSummary,
  WorkspaceMemberSummary,
  WorkspaceInvitationSummary,
  AuditLogSummary,
} from '@diagramz/shared';

@ApiTags('Workspaces')
@ApiBearerAuth()
@Controller('workspaces')
export class WorkspacesController {
  constructor(
    private workspacesService: WorkspacesService,
    private auditService: AuditService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List all workspaces current user belongs to' })
  async listWorkspaces(@CurrentUser() user: AuthSessionUser): Promise<WorkspaceSummary[]> {
    return this.workspacesService.getUserWorkspaces(user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new workspace' })
  @UsePipes(new ZodValidationPipe(createWorkspaceSchema))
  async createWorkspace(
    @CurrentUser() user: AuthSessionUser,
    @Body() dto: CreateWorkspaceDto,
  ): Promise<WorkspaceSummary> {
    return this.workspacesService.createWorkspace(user.id, dto);
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Get workspace details by slug' })
  async getWorkspaceBySlug(
    @CurrentUser() user: AuthSessionUser,
    @Param('slug') slug: string,
  ): Promise<WorkspaceSummary> {
    return this.workspacesService.getWorkspaceBySlug(user.id, slug);
  }

  @Patch(':id')
  @UseGuards(WorkspaceRolesGuard)
  @RequireWorkspaceRole('admin')
  @ApiOperation({ summary: 'Update workspace details (Admin or Owner)' })
  @UsePipes(new ZodValidationPipe(updateWorkspaceSchema))
  async updateWorkspace(
    @Param('id') id: string,
    @CurrentUser() user: AuthSessionUser,
    @Body() dto: UpdateWorkspaceDto,
  ): Promise<WorkspaceSummary> {
    return this.workspacesService.updateWorkspace(id, user.id, dto);
  }

  @Delete(':id')
  @UseGuards(WorkspaceRolesGuard)
  @RequireWorkspaceRole('owner')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete workspace (Owner only)' })
  async deleteWorkspace(
    @Param('id') id: string,
    @CurrentUser() user: AuthSessionUser,
  ): Promise<void> {
    await this.workspacesService.deleteWorkspace(id, user.id);
  }

  @Get(':id/members')
  @UseGuards(WorkspaceRolesGuard)
  @RequireWorkspaceRole('viewer')
  @ApiOperation({ summary: 'List workspace members' })
  async getMembers(@Param('id') id: string): Promise<WorkspaceMemberSummary[]> {
    return this.workspacesService.getMembers(id);
  }

  @Post(':id/invitations')
  @UseGuards(WorkspaceRolesGuard)
  @RequireWorkspaceRole('admin')
  @ApiOperation({ summary: 'Create invitation for workspace' })
  @UsePipes(new ZodValidationPipe(inviteMemberSchema))
  async inviteMember(
    @Param('id') id: string,
    @CurrentUser() user: AuthSessionUser,
    @Body() dto: InviteMemberDto,
  ): Promise<WorkspaceInvitationSummary> {
    return this.workspacesService.inviteMember(id, user.id, dto);
  }

  @Patch(':id/members/:memberId')
  @UseGuards(WorkspaceRolesGuard)
  @RequireWorkspaceRole('admin')
  @ApiOperation({ summary: 'Update member role (Admin or Owner)' })
  @UsePipes(new ZodValidationPipe(updateMemberRoleSchema))
  async updateMemberRole(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @CurrentUser() user: AuthSessionUser,
    @Body() dto: UpdateMemberRoleDto,
  ): Promise<WorkspaceMemberSummary> {
    return this.workspacesService.updateMemberRole(id, user.id, memberId, dto);
  }

  @Delete(':id/members/:memberId')
  @UseGuards(WorkspaceRolesGuard)
  @RequireWorkspaceRole('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove member from workspace' })
  async removeMember(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @CurrentUser() user: AuthSessionUser,
  ): Promise<void> {
    await this.workspacesService.removeMember(id, user.id, memberId);
  }

  @Get(':id/audit-logs')
  @UseGuards(WorkspaceRolesGuard)
  @RequireWorkspaceRole('admin')
  @ApiOperation({ summary: 'Get workspace audit trail (Admin/Owner)' })
  async getAuditLogs(@Param('id') id: string): Promise<AuditLogSummary[]> {
    return this.auditService.getWorkspaceLogs(id);
  }
}
