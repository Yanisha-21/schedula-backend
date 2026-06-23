import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification, NotificationType } from './entities/notification.entity';
import { Patient } from '../patient/entities/patient.entity';
import { User } from '../users/entities/user.entity';

@Injectable()
export class NotificationService {
  constructor(
    @InjectRepository(Notification)
    private notificationRepo: Repository<Notification>,
    @InjectRepository(Patient)
    private patientRepo: Repository<Patient>,
  ) {}

  // ── INTERNAL: Create notification (called from appointment service) ──
  async createNotification(
    patient: Patient,
    title: string,
    message: string,
    type: NotificationType,
  ) {
    const notification = this.notificationRepo.create({ patient, title, message, type });
    return await this.notificationRepo.save(notification);
  }

  // ── GET ALL NOTIFICATIONS ──
  async getNotifications(user: User) {
    const patient = await this.patientRepo.findOne({ where: { user: { id: user.id } } });
    if (!patient) throw new NotFoundException('Patient profile not found');

    const notifications = await this.notificationRepo.find({
      where: { patient: { id: patient.id } },
      order: { createdAt: 'DESC' },
    });

    if (notifications.length === 0) throw new NotFoundException('No notifications found');

    return { success: true, data: notifications };
  }

  // ── MARK ONE AS READ ──
  async markAsRead(user: User, id: number) {
    const patient = await this.patientRepo.findOne({ where: { user: { id: user.id } } });
    if (!patient) throw new NotFoundException('Patient profile not found');

    const notification = await this.notificationRepo.findOne({
      where: { id },
      relations: { patient: true },
    });

    if (!notification) throw new NotFoundException('Notification not found');

    if (notification.patient.id !== patient.id) {
      throw new ForbiddenException('You are not authorized to access this notification');
    }

    if (notification.isRead) {
      return { success: true, message: 'Notification already marked as read' };
    }

    notification.isRead = true;
    await this.notificationRepo.save(notification);

    return { success: true, message: 'Notification marked as read' };
  }

  // ── MARK ALL AS READ ──
  async markAllAsRead(user: User) {
    const patient = await this.patientRepo.findOne({ where: { user: { id: user.id } } });
    if (!patient) throw new NotFoundException('Patient profile not found');

    const unread = await this.notificationRepo.find({
      where: { patient: { id: patient.id }, isRead: false },
    });

    if (unread.length === 0) {
      return { success: true, message: 'No unread notifications' };
    }

    await this.notificationRepo.update(
      { patient: { id: patient.id }, isRead: false },
      { isRead: true },
    );

    return { success: true, message: `${unread.length} notifications marked as read` };
  }

  // ── UNREAD COUNT ──
  async getUnreadCount(user: User) {
    const patient = await this.patientRepo.findOne({ where: { user: { id: user.id } } });
    if (!patient) throw new NotFoundException('Patient profile not found');

    const count = await this.notificationRepo.count({
      where: { patient: { id: patient.id }, isRead: false },
    });

    return { success: true, unreadCount: count };
  }
}