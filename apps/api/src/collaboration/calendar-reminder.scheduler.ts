import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CalendarService } from './collaboration.service';

@Injectable()
export class CalendarReminderSchedulerService {
  private readonly logger = new Logger(CalendarReminderSchedulerService.name);
  private running = false;

  constructor(private readonly calendars: CalendarService) {}

  /** Fan-out due calendar reminders to every member via remote APNS. */
  @Cron(CronExpression.EVERY_MINUTE)
  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      const result = await this.calendars.dispatchDueReminders();
      if (result.sent > 0) {
        this.logger.log(
          `Calendar reminders sent=${result.sent} scanned=${result.scanned}`,
        );
      }
    } catch (error) {
      this.logger.warn(
        `Calendar reminder scheduler failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    } finally {
      this.running = false;
    }
  }
}
