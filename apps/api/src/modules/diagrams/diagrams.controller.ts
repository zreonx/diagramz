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
import { DiagramsService } from './diagrams.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequireWorkspaceRole } from '../../common/decorators/roles.decorator';
import { WorkspaceRolesGuard } from '../../common/guards/workspace-roles.guard';
import { Public } from '../../common/decorators/public.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  createDiagramSchema,
  updateDiagramSchema,
  createDiagramVersionSchema,
  updateShareSettingsSchema,
  addDiagramCollaboratorSchema,
  updateDiagramCollaboratorSchema,
  updateSharedDiagramSchema,
  CreateDiagramDto,
  UpdateDiagramDto,
  CreateDiagramVersionDto,
  UpdateShareSettingsDto,
  AddDiagramCollaboratorDto,
  UpdateDiagramCollaboratorDto,
  UpdateSharedDiagramDto,
  AuthSessionUser,
  DiagramSummary,
  DiagramDetail,
  DiagramVersionSummary,
  DiagramAccessOverview,
  DiagramCollaboratorSummary,
} from '@diagramz/shared';

@ApiTags('Diagrams')
@Controller()
export class DiagramsController {
  constructor(private diagramsService: DiagramsService) {}

  @Get('projects/:projectId/diagrams')
  @ApiBearerAuth()
  @UseGuards(WorkspaceRolesGuard)
  @RequireWorkspaceRole('viewer')
  @ApiOperation({ summary: 'List all diagrams in project' })
  async listDiagrams(@Param('projectId') projectId: string): Promise<DiagramSummary[]> {
    return this.diagramsService.listProjectDiagrams(projectId);
  }

  @Post('projects/:projectId/diagrams')
  @ApiBearerAuth()
  @UseGuards(WorkspaceRolesGuard)
  @RequireWorkspaceRole('editor')
  @ApiOperation({ summary: 'Create a new diagram in project' })
  @UsePipes(new ZodValidationPipe(createDiagramSchema))
  async createDiagram(
    @Param('projectId') projectId: string,
    @CurrentUser() user: AuthSessionUser,
    @Body() dto: CreateDiagramDto,
  ): Promise<DiagramDetail> {
    return this.diagramsService.createDiagram(projectId, user.id, dto);
  }

  @Get('diagrams/:id')
  @ApiBearerAuth()
  @UseGuards(WorkspaceRolesGuard)
  @RequireWorkspaceRole('viewer')
  @ApiOperation({ summary: 'Fetch diagram metadata and canvas JSON' })
  async getDiagram(
    @Param('id') id: string,
    @CurrentUser() user: AuthSessionUser,
  ): Promise<DiagramDetail> {
    return this.diagramsService.getDiagramDetail(id, user?.id);
  }

  @Patch('diagrams/:id')
  @ApiBearerAuth()
  @UseGuards(WorkspaceRolesGuard)
  @RequireWorkspaceRole('editor')
  @ApiOperation({ summary: 'Save canvas state, Mermaid code, and title' })
  @UsePipes(new ZodValidationPipe(updateDiagramSchema))
  async updateDiagram(
    @Param('id') id: string,
    @CurrentUser() user: AuthSessionUser,
    @Body() dto: UpdateDiagramDto,
  ): Promise<DiagramDetail> {
    return this.diagramsService.updateDiagram(id, user.id, dto);
  }

  @Patch('diagrams/:id/move')
  @ApiBearerAuth()
  @UseGuards(WorkspaceRolesGuard)
  @RequireWorkspaceRole('editor')
  @ApiOperation({ summary: 'Move diagram to folder or root' })
  async moveDiagram(
    @Param('id') id: string,
    @CurrentUser() user: AuthSessionUser,
    @Body('folderId') folderId: string | null,
  ): Promise<DiagramDetail> {
    return this.diagramsService.moveDiagram(id, user.id, folderId || null);
  }

  @Patch('diagrams/:id/star')
  @ApiBearerAuth()
  @UseGuards(WorkspaceRolesGuard)
  @RequireWorkspaceRole('viewer')
  @ApiOperation({ summary: 'Toggle starred status of diagram' })
  async toggleStar(
    @Param('id') id: string,
    @CurrentUser() user: AuthSessionUser,
  ): Promise<DiagramDetail> {
    return this.diagramsService.toggleStar(id, user.id);
  }

  @Delete('diagrams/:id')
  @ApiBearerAuth()
  @UseGuards(WorkspaceRolesGuard)
  @RequireWorkspaceRole('editor')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete diagram' })
  async deleteDiagram(
    @Param('id') id: string,
    @CurrentUser() user: AuthSessionUser,
  ): Promise<void> {
    await this.diagramsService.deleteDiagram(id, user.id);
  }

  @Post('diagrams/batch-delete')
  @ApiBearerAuth()
  @UseGuards(WorkspaceRolesGuard)
  @RequireWorkspaceRole('editor')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Batch delete multiple diagrams' })
  async batchDeleteDiagrams(
    @CurrentUser() user: AuthSessionUser,
    @Body('diagramIds') diagramIds: string[],
  ): Promise<{ deletedCount: number }> {
    return this.diagramsService.batchDeleteDiagrams(diagramIds, user.id);
  }

  @Post('diagrams/:id/versions')
  @ApiBearerAuth()
  @UseGuards(WorkspaceRolesGuard)
  @RequireWorkspaceRole('editor')
  @ApiOperation({ summary: 'Create checkpoint version' })
  @UsePipes(new ZodValidationPipe(createDiagramVersionSchema))
  async createVersion(
    @Param('id') id: string,
    @CurrentUser() user: AuthSessionUser,
    @Body() dto: CreateDiagramVersionDto,
  ): Promise<DiagramVersionSummary> {
    return this.diagramsService.createVersion(id, user.id, dto);
  }

  @Get('diagrams/:id/versions')
  @ApiBearerAuth()
  @UseGuards(WorkspaceRolesGuard)
  @RequireWorkspaceRole('viewer')
  @ApiOperation({ summary: 'List versions of diagram' })
  async listVersions(@Param('id') id: string): Promise<DiagramVersionSummary[]> {
    return this.diagramsService.listVersions(id);
  }

  @Get('diagrams/:id/access')
  @ApiBearerAuth()
  @UseGuards(WorkspaceRolesGuard)
  @RequireWorkspaceRole('viewer')
  @ApiOperation({ summary: 'Get diagram sharing access and collaborator list' })
  async getAccessOverview(@Param('id') id: string): Promise<DiagramAccessOverview> {
    return this.diagramsService.getDiagramAccessOverview(id);
  }

  @Post('diagrams/:id/share')
  @ApiBearerAuth()
  @UseGuards(WorkspaceRolesGuard)
  @RequireWorkspaceRole('editor')
  @ApiOperation({ summary: 'Enable or disable public link sharing and set link permissions' })
  @UsePipes(new ZodValidationPipe(updateShareSettingsSchema))
  async updateShareSettings(
    @Param('id') id: string,
    @Body() dto: UpdateShareSettingsDto,
  ): Promise<{ shareToken: string; isPublic: boolean; shareRole: 'viewer' | 'editor' }> {
    return this.diagramsService.updateShareSettings(id, dto);
  }

  @Post('diagrams/:id/collaborators')
  @ApiBearerAuth()
  @UseGuards(WorkspaceRolesGuard)
  @RequireWorkspaceRole('editor')
  @ApiOperation({ summary: 'Invite or add collaborator to diagram' })
  @UsePipes(new ZodValidationPipe(addDiagramCollaboratorSchema))
  async addCollaborator(
    @Param('id') id: string,
    @Body() dto: AddDiagramCollaboratorDto,
  ): Promise<DiagramCollaboratorSummary> {
    return this.diagramsService.addCollaborator(id, dto);
  }

  @Delete('diagrams/:id/collaborators/:collaboratorId')
  @ApiBearerAuth()
  @UseGuards(WorkspaceRolesGuard)
  @RequireWorkspaceRole('editor')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove collaborator from diagram' })
  async removeCollaborator(
    @Param('id') id: string,
    @Param('collaboratorId') collaboratorId: string,
  ): Promise<void> {
    await this.diagramsService.removeCollaborator(id, collaboratorId);
  }

  @Patch('diagrams/:id/collaborators/:collaboratorId')
  @ApiBearerAuth()
  @UseGuards(WorkspaceRolesGuard)
  @RequireWorkspaceRole('editor')
  @ApiOperation({ summary: 'Update collaborator role on diagram' })
  @UsePipes(new ZodValidationPipe(updateDiagramCollaboratorSchema))
  async updateCollaboratorRole(
    @Param('id') id: string,
    @Param('collaboratorId') collaboratorId: string,
    @Body() dto: UpdateDiagramCollaboratorDto,
  ): Promise<DiagramCollaboratorSummary> {
    return this.diagramsService.updateCollaboratorRole(id, collaboratorId, dto);
  }

  @Public()
  @Get('share/:shareToken')
  @ApiOperation({ summary: 'Public view or edit of diagram via share token' })
  async getPublicDiagram(@Param('shareToken') shareToken: string): Promise<DiagramDetail> {
    return this.diagramsService.getPublicDiagram(shareToken);
  }

  @Public()
  @Patch('share/:shareToken')
  @ApiOperation({ summary: 'Update diagram via share token if editor permission is granted' })
  @UsePipes(new ZodValidationPipe(updateSharedDiagramSchema))
  async updatePublicDiagram(
    @Param('shareToken') shareToken: string,
    @Body() dto: UpdateSharedDiagramDto,
  ): Promise<DiagramDetail> {
    return this.diagramsService.updatePublicDiagram(shareToken, dto);
  }
}
