import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { hash } from 'bcryptjs';
import { Model } from 'mongoose';
import { User } from '../auth/auth.module';
import { EntitlementService } from '../billing/entitlement.service';
import { Subscription } from '../billing/billing.schemas';

/**
 * Boot promote of the platform admin when ADMIN_BOOTSTRAP_PASSWORD is set.
 * Also ensures that account is the platform owner with TecnoWallet Business.
 * Never commit the password.
 */
@Injectable()
export class AdminBootstrapService implements OnModuleInit {
  private readonly logger = new Logger(AdminBootstrapService.name);

  constructor(
    @InjectModel(User.name) private readonly users: Model<User>,
    @InjectModel(Subscription.name)
    private readonly subscriptions: Model<Subscription>,
    private readonly entitlements: EntitlementService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit() {
    const email = (
      this.config.get<string>('ADMIN_BOOTSTRAP_EMAIL') ||
      'mercancias.visbal@gmail.com'
    )
      .trim()
      .toLowerCase();
    const name = (
      this.config.get<string>('ADMIN_BOOTSTRAP_NAME') || 'TecnoWallet Admin'
    ).trim();

    const password = this.config.get<string>('ADMIN_BOOTSTRAP_PASSWORD')?.trim();
    let user =
      (await this.users.findOne({ email }).select('+passwordHash').exec()) ??
      null;

    if (password && password.length >= 8) {
      const passwordHash = await hash(password, 12);
      if (user) {
        user.passwordHash = passwordHash;
        user.platformRole = 'admin';
        user.emailVerified = true;
        user.active = true;
        if (!user.name?.trim()) user.name = name;
        await user.save();
        this.logger.log(`Promoted admin user ${email}`);
      } else {
        user = await this.users.create({
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
    } else if (user && user.platformRole !== 'admin') {
      user.platformRole = 'admin';
      user.emailVerified = true;
      user.active = true;
      await user.save();
      this.logger.log(`Ensured platformRole=admin for ${email}`);
    }

    if (!user) {
      user = await this.users.findOne({ email }).exec();
    }
    if (!user) return;

    await this.ensureOwnerBusiness(user._id.toString(), email);
  }

  /** Owner account is the only seeded Business plan (manual, non-expiring). */
  private async ensureOwnerBusiness(userId: string, email: string) {
    const entitlementId = this.entitlements.businessEntitlementId();
    const now = new Date();
    await this.subscriptions.findOneAndUpdate(
      { userId },
      {
        $set: {
          appUserId: userId,
          status: 'active',
          entitlementId,
          productId: 'manual_business_owner',
          purchasedAt: now,
          willRenew: false,
          provider: 'manual',
          lastEventId: `owner_business_${email}`,
          environment:
            this.config.get<string>('NODE_ENV', 'development') === 'production'
              ? 'PRODUCTION'
              : 'SANDBOX',
        },
        $unset: { expiresAt: 1 },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    this.logger.log(`Ensured TecnoWallet Business for owner ${email}`);
  }
}
