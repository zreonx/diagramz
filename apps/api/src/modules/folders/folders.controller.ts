import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UsePipes,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { FoldersService } from './folders.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  createFolderSchema,
  updateFolderSchema,
  moveFolderSchema,
  CreateFolderDto,
  UpdateFolderDto,
  MoveFolderDto,
  AuthSessionUser,
  FolderSummary,
  WorkspaceTreeResponse,
} from '@diagramz/shared';

@ApiTags('Folders')
@ApiBearerAuth()
@Controller()
export class FoldersController {
  constructor(private foldersService: FoldersService) {}

  @Get('workspaces/:workspaceId/tree')
  @ApiOperation({ summary: 'Get full folder & document hierarchy tree for workspace' })
  async getWorkspaceTree(
    @Param('workspaceId') workspaceId: string,
  ): Promise<WorkspaceTreeResponse> {
    return this.foldersService.getWorkspaceTree(workspaceId);
  }

  @Post('workspaces/:workspaceId/folders')
  @ApiOperation({ summary: 'Create a new folder or subfolder in workspace' })
  @UsePipes(new ZodValidationPipe(createFolderSchema))
  async createFolder(
    @CurrentUser() user: AuthSessionUser,
    @Param('workspaceId') workspaceId: string,
    @Body() dto: CreateFolderDto,
  ): Promise<FolderSummary> {
    return this.foldersService.createFolder(user.id, workspaceId, dto);
  }

  @Patch('folders/:id')
  @ApiOperation({ summary: 'Update folder properties (name, icon, position)' })
  @UsePipes(new ZodValidationPipe(updateFolderSchema))
  async updateFolder(
    @CurrentUser() user: AuthSessionUser,
    @Param('id') folderId: string,
    @Body() dto: UpdateFolderDto,
  ): Promise<FolderSummary> {
    return this.foldersService.updateFolder(folderId, user.id, dto);
  }

  @Patch('folders/:id/move')
  @ApiOperation({ summary: 'Move folder to another parent folder' })
  @UsePipes(new ZodValidationPipe(moveFolderSchema))
  async moveFolder(
    @CurrentUser() user: AuthSessionUser,
    @Param('id') folderId: string,
    @Body() dto: MoveFolderDto,
  ): Promise<FolderSummary> {
    return this.foldersService.moveFolder(folderId, user.id, dto);
  }

  @Delete('folders/:id')
  @ApiOperation({ summary: 'Delete a folder and relocate contents to root' })
  async deleteFolder(
    @CurrentUser() user: AuthSessionUser,
    @Param('id') folderId: string,
  ): Promise<{ success: boolean }> {
    return this.foldersService.deleteFolder(folderId, user.id);
  }
}
