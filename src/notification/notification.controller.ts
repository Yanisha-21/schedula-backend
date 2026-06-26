import { Controller, Get, Patch, Param, ParseIntPipe, UseGuards, Req } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  // GET /notifications
  @UseGuards(JwtAuthGuard)
  @Get()
  getNotifications(@Req() req) {
    return this.notificationService.getNotifications(req.user);
  }

  // GET /notifications/unread-count
  @UseGuards(JwtAuthGuard)
  @Get('unread-count')
  getUnreadCount(@Req() req) {
    return this.notificationService.getUnreadCount(req.user);
  }

  // PATCH /notifications/read-all
  @UseGuards(JwtAuthGuard)
  @Patch('read-all')
  markAllAsRead(@Req() req) {
    return this.notificationService.markAllAsRead(req.user);
  }

  // PATCH /notifications/:id/read
  @UseGuards(JwtAuthGuard)
  @Patch(':id/read')
  markAsRead(@Req() req, @Param('id', ParseIntPipe) id: number) {
    return this.notificationService.markAsRead(req.user, id);
  }
}