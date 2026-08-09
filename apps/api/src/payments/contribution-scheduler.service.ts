import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PaymentOrchestrationService } from './payment-orchestration.service';

@Injectable()
export class ContributionSchedulerService {
  private readonly logger = new Logger(ContributionSchedulerService.name);

  constructor(private readonly orchestration: PaymentOrchestrationService) {}

  /** Runs local daily/biweekly funded contribution schedules. */
  @Cron(CronExpression.EVERY_HOUR)
  async tick() {
    try {
      const result = await this.orchestration.runDueLocalSchedules();
      if (result.ran > 0) {
        this.logger.log(
          `Local contribution schedules ran=${result.ran} due=${result.due}`,
        );
      }
    } catch (error) {
      this.logger.warn(
        `Contribution scheduler failed: ${
          error instanceof Error ? error.message : 'unknown'
        }`,
      );
    }
  }
}
