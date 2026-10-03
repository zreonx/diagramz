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
  CreateDiagramDto,
  UpdateDiagramDto,
  CreateDiagramVersionDto,
  UpdateShareSettingsDto,
  AuthSessionUser,
  DiagramSummary,
  DiagramDetail,
  DiagramVersionSummary,
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
  async getDiagram(@Param('id') id: string): Promise<DiagramDetail> {
    return this.diagramsService.getDiagramDetail(id);
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

  @Post('diagrams/:id/share')
  @ApiBearerAuth()
  @UseGuards(WorkspaceRolesGuard)
  @RequireWorkspaceRole('editor')
  @ApiOperation({ summary: 'Enable or disable public link sharing' })
  @UsePipes(new ZodValidationPipe(updateShareSettingsSchema))
  async updateShareSettings(
    @Param('id') id: string,
    @Body() dto: UpdateShareSettingsDto,
  ): Promise<{ shareToken: string; isPublic: boolean }> {
    return this.diagramsService.updateShareSettings(id, dto);
  }

  @Public()
  @Get('share/:shareToken')
  @ApiOperation({ summary: 'Public view of diagram (read-only)' })
  async getPublicDiagram(@Param('shareToken') shareToken: string): Promise<DiagramDetail> {
    return this.diagramsService.getPublicDiagram(shareToken);
  }
}
