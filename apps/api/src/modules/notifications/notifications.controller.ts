import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Put,
  Param,
  Query,
  Body,
  UsePipes,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  AuthSessionUser,
  NotificationItem,
  NotificationListResponse,
  NotificationPreferences,
  UpdateNotificationPreferencesDto,
  updateNotificationPreferencesSchema,
} from '@diagramz/shared';

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Get current user notifications and unread count' })
  async getNotifications(
    @CurrentUser() user: AuthSessionUser,
    @Query('unreadOnly') unreadOnly?: string,
    @Query('limit') limit?: string,
  ): Promise<NotificationListResponse> {
    return this.notificationsService.getUserNotifications(user.id, {
      unreadOnly: unreadOnly === 'true',
      limit: limit ? parseInt(limit, 10) : 50,
    });
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get current user unread notification count' })
  async getUnreadCount(@CurrentUser() user: AuthSessionUser): Promise<{ unreadCount: number }> {
    return this.notificationsService.getUnreadCount(user.id);
  }

  @Get('preferences')
  @ApiOperation({ summary: 'Get current user notification preferences' })
  async getPreferences(@CurrentUser() user: AuthSessionUser): Promise<NotificationPreferences> {
    return this.notificationsService.getPreferences(user.id);
  }

  @Put('preferences')
  @ApiOperation({ summary: 'Update current user notification preferences' })
  @UsePipes(new ZodValidationPipe(updateNotificationPreferencesSchema))
  async updatePreferences(
    @CurrentUser() user: AuthSessionUser,
    @Body() dto: UpdateNotificationPreferencesDto,
  ): Promise<NotificationPreferences> {
    return this.notificationsService.updatePreferences(user.id, dto);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a notification as read' })
  async markAsRead(
    @CurrentUser() user: AuthSessionUser,
    @Param('id') id: string,
  ): Promise<NotificationItem> {
    return this.notificationsService.markAsRead(user.id, id);
  }

  @Post('mark-all-read')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  async markAllAsRead(@CurrentUser() user: AuthSessionUser): Promise<{ count: number }> {
    return this.notificationsService.markAllAsRead(user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a single notification' })
  async deleteNotification(
    @CurrentUser() user: AuthSessionUser,
    @Param('id') id: string,
  ): Promise<void> {
    await this.notificationsService.deleteNotification(user.id, id);
  }

  @Delete()
  @ApiOperation({ summary: 'Clear all notifications for user' })
  async clearAll(@CurrentUser() user: AuthSessionUser): Promise<{ count: number }> {
    return this.notificationsService.clearAll(user.id);
  }
}
