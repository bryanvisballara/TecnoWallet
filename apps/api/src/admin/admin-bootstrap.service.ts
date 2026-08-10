import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { hash } from 'bcryptjs';
import { Model } from 'mongoose';
import { User } from '../auth/auth.module';

/**
 * Boot promote of the platform admin when ADMIN_BOOTSTRAP_PASSWORD is set.
 * Never commit the password.
 */
@Injectable()
export class AdminBootstrapService implements OnModuleInit {
  private readonly logger = new Logger(AdminBootstrapService.name);

  constructor(
    @InjectModel(User.name) private readonly users: Model<User>,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit() {
    const password = this.config.get<string>('ADMIN_BOOTSTRAP_PASSWORD')?.trim();
    if (!password || password.length < 8) return;

    const email = (
      this.config.get<string>('ADMIN_BOOTSTRAP_EMAIL') ||
      'mercancias.visbal@gmail.com'
    )
      .trim()
      .toLowerCase();
    const name = (
      this.config.get<string>('ADMIN_BOOTSTRAP_NAME') || 'TecnoWallet Admin'
    ).trim();

    const passwordHash = await hash(password, 12);
    const existing = await this.users
      .findOne({ email })
      .select('+passwordHash')
      .exec();

    if (existing) {
      existing.passwordHash = passwordHash;
      existing.platformRole = 'admin';
      existing.emailVerified = true;
      existing.active = true;
      if (!existing.name?.trim()) existing.name = name;
      await existing.save();
      this.logger.log(`Promoted admin user ${email}`);
      return;
    }

    await this.users.create({
      email,
      name,
      passwordHash,
      platformRole: 'admin',
      emailVerified: true,
      active: true,
      sessionVersion: 0,
    });
    this.logger.log(`Created admin user ${email}`);
  }
}
