import {
  BadRequestException,
  Body,
  CanActivate,
  Controller,
  createParamDecorator,
  Delete,
  ExecutionContext,
  ForbiddenException,
  Get,
  Injectable,
  Module,
  NotFoundException,
  Post,
  ServiceUnavailableException,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import {
  InjectModel,
  MongooseModule,
  Prop,
  Schema,
  SchemaFactory,
} from '@nestjs/mongoose';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsEmail, IsString, Length, Matches, MinLength } from 'class-validator';
import { compare, hash } from 'bcryptjs';
import { OAuth2Client } from 'google-auth-library';
import { createHash, randomInt, randomUUID } from 'node:crypto';
import { Model, Schema as MongooseSchema, Types } from 'mongoose';

import { otpEmailHtml, otpEmailSubject } from './otp-email';

export interface AuthPrincipal {
  userId: string;
  email: string;
  platformRole: 'user' | 'admin';
}

export const PLATFORM_ROLES = ['user', 'admin'] as const;
export type PlatformRole = (typeof PLATFORM_ROLES)[number];

@Schema({ timestamps: true })
export class User {
  _id!: Types.ObjectId;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email!: string;

  @Prop({ required: false, select: false })
  passwordHash?: string;

  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ unique: true, sparse: true, trim: true })
  googleId?: string;

  /** Password accounts require email OTP; Google accounts are trusted. */
  @Prop({ default: true })
  emailVerified!: boolean;

  @Prop({ select: false })
  emailVerificationCodeHash?: string;

  @Prop()
  emailVerificationExpiresAt?: Date;

  /** OTP to confirm account deletion (separate from signup verification). */
  @Prop({ select: false })
  accountDeletionCodeHash?: string;

  @Prop()
  accountDeletionExpiresAt?: Date;

  @Prop({ index: true, trim: true })
  affiliateId?: string;

  @Prop({ index: true, trim: true, uppercase: true })
  affiliateCode?: string;

  @Prop({ default: true })
  active!: boolean;

  /**
   * Bumped on each full sign-in so only one device keeps a valid access token.
   * Embedded in access JWTs as `sv` and checked by AccessTokenGuard.
   */
  @Prop({ default: 0 })
  sessionVersion!: number;

  /** Platform staff role. Workspace Membership.role is unrelated. */
  @Prop({
    required: true,
    type: String,
    enum: PLATFORM_ROLES,
    default: 'user',
    index: true,
  })
  platformRole!: PlatformRole;
}
export const UserSchema = SchemaFactory.createForClass(User);

@Schema({ timestamps: true })
export class RefreshSession {
  @Prop({ required: true, index: true, type: MongooseSchema.Types.ObjectId })
  userId!: Types.ObjectId;

  @Prop({ required: true, unique: true })
  tokenId!: string;

  @Prop({ required: true })
  tokenHash!: string;

  @Prop({ required: true, expires: 0 })
  expiresAt!: Date;

  @Prop()
  revokedAt?: Date;
}
export const RefreshSessionSchema =
  SchemaFactory.createForClass(RefreshSession);

@Schema({ timestamps: true })
export class Workspace {
  _id!: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ required: true, type: String, enum: ['personal', 'shared'] })
  type!: 'personal' | 'shared';

  @Prop({ required: true, index: true, type: MongooseSchema.Types.ObjectId })
  ownerId!: Types.ObjectId;

  @Prop({ default: 'COP', uppercase: true })
  baseCurrency!: string;

  /** UI accent for the book switcher (stored in Mongo, not local). */
  @Prop({ trim: true, default: '#F5C518' })
  color?: string;

  @Prop({ trim: true, default: 'house.fill' })
  icon?: string;

  /** Short public code for join-by-ID requests (e.g. TW8F3K2M1Q). */
  @Prop({ trim: true, uppercase: true, sparse: true })
  shareCode?: string;

  /** Atomic Free-plan ownership slot; Plus-created books omit it. */
  @Prop({ min: 1, max: 1 })
  freeSlot?: number;

  @Prop({ index: true })
  deletedAt?: Date;
}
export const WorkspaceSchema = SchemaFactory.createForClass(Workspace);
WorkspaceSchema.index(
  { shareCode: 1 },
  {
    unique: true,
    partialFilterExpression: { shareCode: { $type: 'string' } },
    name: 'unique_workspace_share_code',
  },
);
WorkspaceSchema.index(
  { ownerId: 1, freeSlot: 1 },
  {
    unique: true,
    partialFilterExpression: {
      freeSlot: { $type: 'number' },
    },
  },
);

@Schema({ timestamps: true })
export class Membership {
  @Prop({ required: true, index: true, type: MongooseSchema.Types.ObjectId })
  workspaceId!: Types.ObjectId;

  @Prop({ required: true, index: true, type: MongooseSchema.Types.ObjectId })
  userId!: Types.ObjectId;

  @Prop({ required: true, enum: ['owner', 'admin', 'member', 'viewer'] })
  role!: string;
}
export const MembershipSchema = SchemaFactory.createForClass(Membership);
MembershipSchema.index({ workspaceId: 1, userId: 1 }, { unique: true });

class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  @MinLength(2)
  name!: string;
}

class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  password!: string;
}

class RefreshDto {
  @IsString()
  refreshToken!: string;
}

class GoogleLoginDto {
  @IsString()
  @MinLength(20)
  idToken!: string;
}

class VerifyEmailDto {
  @IsEmail()
  email!: string;

  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/)
  code!: string;
}

class ResendVerificationDto {
  @IsEmail()
  email!: string;
}

class ConfirmDeleteAccountDto {
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/)
  code!: string;
}

const IS_PUBLIC = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC, true);

const IS_ADMIN = 'isAdmin';
export const AdminOnly = () => SetMetadata(IS_ADMIN, true);

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthPrincipal => {
    const request = context
      .switchToHttp()
      .getRequest<{ user: AuthPrincipal }>();
    return request.user;
  },
);

@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly reflector: Reflector,
    @InjectModel(User.name) private readonly users: Model<User>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
        context.getHandler(),
        context.getClass(),
      ])
    ) {
      return true;
    }
    const request = context.switchToHttp().getRequest<{
      headers: { authorization?: string };
      user?: AuthPrincipal;
    }>();
    const token = request.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (!token) throw new UnauthorizedException('Missing bearer token');
    try {
      const payload = await this.jwt.verifyAsync<{
        sub: string;
        email: string;
        kind: string;
        sv?: number;
        platformRole?: PlatformRole;
      }>(token, { secret: this.config.getOrThrow('JWT_ACCESS_SECRET') });
      if (payload.kind !== 'access') throw new Error('Wrong token kind');

      const user = await this.users
        .findById(payload.sub)
        .select('active sessionVersion email platformRole')
        .lean();
      if (!user?.active) {
        throw new UnauthorizedException({
          message: 'User is inactive',
          reason: 'SESSION_SUPERSEDED',
        });
      }
      const currentVersion = user.sessionVersion ?? 0;
      if (typeof payload.sv !== 'number' || payload.sv !== currentVersion) {
        throw new UnauthorizedException({
          message: 'Sesión cerrada: iniciaste sesión en otro dispositivo',
          reason: 'SESSION_SUPERSEDED',
        });
      }

      request.user = {
        userId: payload.sub,
        email: user.email,
        platformRole: user.platformRole === 'admin' ? 'admin' : 'user',
      };
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }
}

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiresAdmin = this.reflector.getAllAndOverride<boolean>(IS_ADMIN, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiresAdmin) return true;
    const request = context.switchToHttp().getRequest<{ user?: AuthPrincipal }>();
    if (request.user?.platformRole !== 'admin') {
      throw new ForbiddenException('Admin access required');
    }
    return true;
  }
}

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private readonly users: Model<User>,
    @InjectModel(RefreshSession.name)
    private readonly refreshSessions: Model<RefreshSession>,
    @InjectModel(Workspace.name) private readonly workspaces: Model<Workspace>,
    @InjectModel(Membership.name)
    private readonly memberships: Model<Membership>,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const email = dto.email.toLowerCase();
    const existing = await this.users
      .findOne({ email })
      .select('+passwordHash +emailVerificationCodeHash');
    if (existing?.emailVerified) {
      throw new UnauthorizedException('Email is already registered');
    }

    const passwordHash = await hash(dto.password, 12);
    let user = existing;
    if (!user) {
      user = await this.users.create({
        email,
        passwordHash,
        name: dto.name.trim(),
        emailVerified: false,
      });
      const workspace = await this.workspaces.create({
        name: 'Hogar',
        type: 'personal',
        ownerId: user._id,
        baseCurrency: 'COP',
        color: '#F5C518',
        icon: 'house.fill',
        freeSlot: 1,
      });
      await this.memberships.create({
        workspaceId: workspace._id,
        userId: user._id,
        role: 'owner',
      });
    } else {
      user.passwordHash = passwordHash;
      user.name = dto.name.trim();
      user.emailVerified = false;
      await user.save();
    }

    const { code, delivered } = await this.issueEmailVerification(user);
    if (!delivered && !this.shouldExposeDevCode()) {
      throw new ServiceUnavailableException(
        'No se pudo enviar el correo de verificación. Inténtalo de nuevo.',
      );
    }
    return {
      requiresVerification: true as const,
      email: user.email,
      delivered,
      ...(this.shouldExposeDevCode() ? { devCode: code } : {}),
    };
  }

  async verifyEmail(dto: VerifyEmailDto) {
    const email = dto.email.toLowerCase();
    const user = await this.users
      .findOne({ email, active: true })
      .select('+emailVerificationCodeHash +passwordHash');
    if (!user) {
      throw new UnauthorizedException('Invalid verification code');
    }
    if (user.emailVerified) {
      return this.issueTokens(user, { replaceSession: true });
    }
    if (
      !user.emailVerificationCodeHash ||
      !user.emailVerificationExpiresAt ||
      user.emailVerificationExpiresAt.getTime() < Date.now()
    ) {
      throw new BadRequestException(
        'Verification code expired. Request a new one.',
      );
    }
    if (this.digest(dto.code) !== user.emailVerificationCodeHash) {
      throw new UnauthorizedException('Invalid verification code');
    }
    await this.users.updateOne(
      { _id: user._id },
      {
        $set: { emailVerified: true },
        $unset: {
          emailVerificationCodeHash: 1,
          emailVerificationExpiresAt: 1,
        },
      },
    );
    user.emailVerified = true;
    return this.issueTokens(user, { replaceSession: true });
  }

  async resendVerification(dto: ResendVerificationDto) {
    const email = dto.email.toLowerCase();
    const user = await this.users.findOne({ email, active: true });
    if (!user) {
      return { accepted: true as const };
    }
    if (user.emailVerified) {
      throw new BadRequestException('Email is already verified');
    }
    const { code, delivered } = await this.issueEmailVerification(user);
    return {
      accepted: true as const,
      delivered,
      ...(this.shouldExposeDevCode() ? { devCode: code } : {}),
    };
  }

  async login(dto: LoginDto) {
    const user = await this.users
      .findOne({ email: dto.email.toLowerCase(), active: true })
      .select('+passwordHash');
    if (
      !user ||
      !user.passwordHash ||
      !(await compare(dto.password, user.passwordHash))
    ) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (!user.emailVerified) {
      throw new UnauthorizedException(
        'Verify your email before signing in. Check your inbox for the 6-digit code.',
      );
    }
    return this.issueTokens(user, { replaceSession: true });
  }

  async loginWithGoogle(dto: GoogleLoginDto) {
    const audiences = [
      this.config.get<string>('GOOGLE_CLIENT_ID_WEB'),
      this.config.get<string>('GOOGLE_CLIENT_ID_IOS'),
    ].filter((value): value is string => Boolean(value?.trim()));
    if (!audiences.length) {
      throw new UnauthorizedException('Google Sign-In is not configured');
    }

    let email = '';
    let googleId = '';
    let name = 'Usuario';
    try {
      const client = new OAuth2Client(audiences[0]);
      const ticket = await client.verifyIdToken({
        idToken: dto.idToken,
        audience: audiences,
      });
      const payload = ticket.getPayload();
      if (!payload?.email || !payload.email_verified || !payload.sub) {
        throw new Error('Unverified Google account');
      }
      email = payload.email.toLowerCase();
      googleId = payload.sub;
      name =
        payload.name?.trim() ||
        payload.given_name?.trim() ||
        email.split('@')[0] ||
        'Usuario';
    } catch {
      throw new UnauthorizedException('Invalid Google ID token');
    }

    let user = await this.users.findOne({
      $or: [{ googleId }, { email }],
      active: true,
    });
    if (!user) {
      user = await this.users.create({
        email,
        name,
        googleId,
        emailVerified: true,
      });
      const workspace = await this.workspaces.create({
        name: 'Hogar',
        type: 'personal',
        ownerId: user._id,
        baseCurrency: 'COP',
        color: '#F5C518',
        icon: 'house.fill',
        freeSlot: 1,
      });
      await this.memberships.create({
        workspaceId: workspace._id,
        userId: user._id,
        role: 'owner',
      });
    } else {
      user.googleId = user.googleId ?? googleId;
      user.emailVerified = true;
      if (!user.name?.trim()) user.name = name;
      await user.save();
    }

    return this.issueTokens(user, { replaceSession: true });
  }

  async refresh(rawToken: string) {
    let payload: { sub: string; email: string; jti: string; kind: string };
    try {
      payload = await this.jwt.verifyAsync(rawToken, {
        secret: this.config.getOrThrow('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (payload.kind !== 'refresh') {
      throw new UnauthorizedException('Invalid refresh token');
    }
    const session = await this.refreshSessions.findOne({
      userId: payload.sub,
      tokenId: payload.jti,
      tokenHash: this.digest(rawToken),
      revokedAt: { $exists: false },
      expiresAt: { $gt: new Date() },
    });
    if (!session) {
      throw new UnauthorizedException({
        message: 'Sesión cerrada: iniciaste sesión en otro dispositivo',
        reason: 'SESSION_SUPERSEDED',
      });
    }
    const user = await this.users.findById(payload.sub);
    if (!user?.active) throw new UnauthorizedException('User is inactive');
    // Same device only: renew without bumping sessionVersion / kicking others.
    const tokens = await this.issueTokens(user, { replaceSession: false });
    session.revokedAt = new Date();
    await session.save();
    return tokens;
  }

  async logout(rawToken: string) {
    await this.refreshSessions.updateOne(
      { tokenHash: this.digest(rawToken), revokedAt: { $exists: false } },
      { $set: { revokedAt: new Date() } },
    );
    return { success: true };
  }

  /** Send a 6-digit code to the user's email before account deletion. */
  async requestAccountDeletion(userId: string) {
    const user = await this.users.findById(userId);
    if (!user || !user.active) {
      throw new NotFoundException('Account not found');
    }
    const code = String(randomInt(100000, 1000000));
    await this.users.updateOne(
      { _id: user._id },
      {
        $set: {
          accountDeletionCodeHash: this.digest(code),
          accountDeletionExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
        },
      },
    );
    const delivered = await this.sendOtpEmail(user.email, code, 'delete');
    if (!delivered && !this.shouldExposeDevCode()) {
      throw new ServiceUnavailableException(
        'No se pudo enviar el correo de confirmación. Inténtalo de nuevo.',
      );
    }
    return {
      requiresCode: true as const,
      email: user.email,
      delivered,
      ...(this.shouldExposeDevCode() ? { devCode: code } : {}),
    };
  }

  /** Soft-delete the account after verifying the email OTP. */
  async confirmAccountDeletion(userId: string, code: string) {
    const user = await this.users
      .findById(userId)
      .select('+accountDeletionCodeHash');
    if (!user || !user.active) {
      throw new NotFoundException('Account not found');
    }
    if (
      !user.accountDeletionCodeHash ||
      !user.accountDeletionExpiresAt ||
      user.accountDeletionExpiresAt.getTime() < Date.now()
    ) {
      throw new UnauthorizedException(
        'El código expiró. Solicita uno nuevo para eliminar la cuenta.',
      );
    }
    if (this.digest(code) !== user.accountDeletionCodeHash) {
      throw new UnauthorizedException('Código incorrecto');
    }

    const now = new Date();
    await this.refreshSessions.updateMany(
      { userId: user._id, revokedAt: { $exists: false } },
      { $set: { revokedAt: now } },
    );

    // Free the email/googleId so the same person can register again later.
    await this.users.updateOne(
      { _id: user._id },
      {
        $set: {
          active: false,
          email: `deleted+${user._id.toString()}@deleted.tecnowallet.invalid`,
          name: 'Cuenta eliminada',
        },
        $unset: {
          googleId: 1,
          passwordHash: 1,
          emailVerificationCodeHash: 1,
          emailVerificationExpiresAt: 1,
          accountDeletionCodeHash: 1,
          accountDeletionExpiresAt: 1,
        },
      },
    );

    await this.workspaces.updateMany(
      { ownerId: user._id, deletedAt: { $exists: false } },
      { $set: { deletedAt: now } },
    );

    return { deleted: true };
  }

  async me(userId: string) {
    const user = await this.users.findById(userId).lean();
    if (!user?.active) throw new NotFoundException('User not found');
    return {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      platformRole: user.platformRole === 'admin' ? 'admin' : 'user',
    };
  }

  private async issueTokens(
    user: User,
    options: { replaceSession: boolean },
  ) {
    let sessionVersion = user.sessionVersion ?? 0;
    if (options.replaceSession) {
      const now = new Date();
      await this.refreshSessions.updateMany(
        { userId: user._id, revokedAt: { $exists: false } },
        { $set: { revokedAt: now } },
      );
      const updated = await this.users
        .findByIdAndUpdate(
          user._id,
          { $inc: { sessionVersion: 1 } },
          { new: true },
        )
        .select('sessionVersion platformRole email name');
      sessionVersion = updated?.sessionVersion ?? sessionVersion + 1;
      user.sessionVersion = sessionVersion;
      if (updated?.platformRole) user.platformRole = updated.platformRole;
    }

    const platformRole: PlatformRole =
      user.platformRole === 'admin' ? 'admin' : 'user';
    const tokenId = randomUUID();
    const accessToken = await this.jwt.signAsync(
      {
        sub: user._id.toString(),
        email: user.email,
        kind: 'access',
        sv: sessionVersion,
        platformRole,
      },
      {
        secret: this.config.getOrThrow('JWT_ACCESS_SECRET'),
        expiresIn: this.config.get('JWT_ACCESS_TTL', '30d'),
      },
    );
    const refreshToken = await this.jwt.signAsync(
      {
        sub: user._id.toString(),
        email: user.email,
        kind: 'refresh',
        jti: tokenId,
      },
      {
        secret: this.config.getOrThrow('JWT_REFRESH_SECRET'),
        expiresIn: this.config.get('JWT_REFRESH_TTL', '3650d'),
      },
    );
    const decoded: unknown = this.jwt.decode(refreshToken);
    if (
      typeof decoded !== 'object' ||
      decoded === null ||
      !('exp' in decoded) ||
      typeof decoded.exp !== 'number'
    ) {
      throw new UnauthorizedException('Could not determine token expiry');
    }
    await this.refreshSessions.create({
      userId: user._id,
      tokenId,
      tokenHash: this.digest(refreshToken),
      expiresAt: new Date(decoded.exp * 1000),
    });
    return {
      accessToken,
      refreshToken,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        platformRole,
      },
    };
  }

  private digest(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private shouldExposeDevCode() {
    const env = this.config.get<string>('NODE_ENV', 'development');
    return env === 'test' || env === 'development';
  }

  private async issueEmailVerification(user: User) {
    const code = String(randomInt(100000, 1000000));
    await this.users.updateOne(
      { _id: user._id },
      {
        $set: {
          emailVerificationCodeHash: this.digest(code),
          emailVerificationExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
        },
      },
    );
    const delivered = await this.sendOtpEmail(user.email, code, 'verify');
    return { code, delivered };
  }

  private async sendOtpEmail(
    to: string,
    code: string,
    purpose: 'verify' | 'delete',
  ) {
    const apiKey = this.config.get<string>('BREVO_API_KEY');
    if (!apiKey?.trim()) {
      if (this.config.get('NODE_ENV', 'development') === 'production') {
        throw new ServiceUnavailableException(
          'Email provider unavailable for verification',
        );
      }
      return false;
    }
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'api-key': apiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sender: {
          email: this.config.get<string>(
            'BREVO_SENDER_EMAIL',
            'contact@tecnowallet.app',
          ),
          name: this.config.get<string>('BREVO_SENDER_NAME', 'TecnoWallet'),
        },
        to: [{ email: to }],
        subject: otpEmailSubject(purpose, code),
        htmlContent: otpEmailHtml(purpose, code),
      }),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new ServiceUnavailableException(
        `Verification email could not be sent${detail ? `: ${detail.slice(0, 200)}` : ''}`,
      );
    }
    return true;
  }
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Public()
  @Post('verify-email')
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.auth.verifyEmail(dto);
  }

  @Public()
  @Post('resend-verification')
  resendVerification(@Body() dto: ResendVerificationDto) {
    return this.auth.resendVerification(dto);
  }

  @Public()
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Public()
  @Post('google')
  google(@Body() dto: GoogleLoginDto) {
    return this.auth.loginWithGoogle(dto);
  }

  @Public()
  @Post('refresh')
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @ApiBearerAuth()
  @Get('me')
  me(@CurrentUser() user: AuthPrincipal) {
    return this.auth.me(user.userId);
  }

  @ApiBearerAuth()
  @Post('logout')
  logout(@Body() dto: RefreshDto) {
    return this.auth.logout(dto.refreshToken);
  }

  @ApiBearerAuth()
  @Post('account/deletion-code')
  requestAccountDeletion(@CurrentUser() user: AuthPrincipal) {
    return this.auth.requestAccountDeletion(user.userId);
  }

  @ApiBearerAuth()
  @Post('account/delete')
  confirmAccountDeletion(
    @CurrentUser() user: AuthPrincipal,
    @Body() dto: ConfirmDeleteAccountDto,
  ) {
    return this.auth.confirmAccountDeletion(user.userId, dto.code);
  }

  /** @deprecated Prefer POST /auth/account/delete with OTP code. */
  @ApiBearerAuth()
  @Delete('account')
  deleteAccountLegacy(
    @CurrentUser() user: AuthPrincipal,
    @Body() dto: ConfirmDeleteAccountDto,
  ) {
    return this.auth.confirmAccountDeletion(user.userId, dto.code);
  }
}

@Module({
  imports: [
    JwtModule.register({}),
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: RefreshSession.name, schema: RefreshSessionSchema },
      { name: Workspace.name, schema: WorkspaceSchema },
      { name: Membership.name, schema: MembershipSchema },
    ]),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AccessTokenGuard,
    AdminGuard,
    { provide: APP_GUARD, useExisting: AccessTokenGuard },
    { provide: APP_GUARD, useExisting: AdminGuard },
  ],
  exports: [MongooseModule, AuthService, AdminGuard],
})
export class AuthModule {}
