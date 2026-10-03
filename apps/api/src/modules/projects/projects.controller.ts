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
import { ProjectsService } from './projects.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequireWorkspaceRole } from '../../common/decorators/roles.decorator';
import { WorkspaceRolesGuard } from '../../common/guards/workspace-roles.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  createProjectSchema,
  updateProjectSchema,
  CreateProjectDto,
  UpdateProjectDto,
  AuthSessionUser,
  ProjectSummary,
} from '@diagramz/shared';

@ApiTags('Projects')
@ApiBearerAuth()
@Controller()
export class ProjectsController {
  constructor(private projectsService: ProjectsService) {}

  @Get('workspaces/:workspaceId/projects')
  @UseGuards(WorkspaceRolesGuard)
  @RequireWorkspaceRole('viewer')
  @ApiOperation({ summary: 'List all projects in workspace' })
  async listProjects(@Param('workspaceId') workspaceId: string): Promise<ProjectSummary[]> {
    return this.projectsService.listWorkspaceProjects(workspaceId);
  }

  @Post('workspaces/:workspaceId/projects')
  @UseGuards(WorkspaceRolesGuard)
  @RequireWorkspaceRole('editor')
  @ApiOperation({ summary: 'Create a new project in workspace (Editor or above)' })
  @UsePipes(new ZodValidationPipe(createProjectSchema))
  async createProject(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: AuthSessionUser,
    @Body() dto: CreateProjectDto,
  ): Promise<ProjectSummary> {
    return this.projectsService.createProject(workspaceId, user.id, dto);
  }

  @Get('projects/:id')
  @UseGuards(WorkspaceRolesGuard)
  @RequireWorkspaceRole('viewer')
  @ApiOperation({ summary: 'Get project details' })
  async getProject(@Param('id') id: string): Promise<ProjectSummary> {
    return this.projectsService.getProject(id);
  }

  @Patch('projects/:id')
  @UseGuards(WorkspaceRolesGuard)
  @RequireWorkspaceRole('editor')
  @ApiOperation({ summary: 'Update project (Editor or above)' })
  @UsePipes(new ZodValidationPipe(updateProjectSchema))
  async updateProject(
    @Param('id') id: string,
    @CurrentUser() user: AuthSessionUser,
    @Body() dto: UpdateProjectDto,
  ): Promise<ProjectSummary> {
    return this.projectsService.updateProject(id, user.id, dto);
  }

  @Delete('projects/:id')
  @UseGuards(WorkspaceRolesGuard)
  @RequireWorkspaceRole('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete project (Admin or Owner)' })
  async deleteProject(
    @Param('id') id: string,
    @CurrentUser() user: AuthSessionUser,
  ): Promise<void> {
    await this.projectsService.deleteProject(id, user.id);
  }
}
