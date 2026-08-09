import {
  Body,
  CanActivate,
  Controller,
  createParamDecorator,
  ExecutionContext,
  Injectable,
  Module,
  Post,
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
import { IsEmail, IsString, MinLength } from 'class-validator';
import { compare, hash } from 'bcryptjs';
import { OAuth2Client } from 'google-auth-library';
import { createHash, randomUUID } from 'node:crypto';
import { Model, Schema as MongooseSchema, Types } from 'mongoose';

export interface AuthPrincipal {
  userId: string;
  email: string;
}

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

  @Prop({ default: true })
  active!: boolean;
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

  @Prop({ default: 'USD', uppercase: true })
  baseCurrency!: string;
}
export const WorkspaceSchema = SchemaFactory.createForClass(Workspace);

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

const IS_PUBLIC = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC, true);

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
      }>(token, { secret: this.config.getOrThrow('JWT_ACCESS_SECRET') });
      if (payload.kind !== 'access') throw new Error('Wrong token kind');
      request.user = { userId: payload.sub, email: payload.email };
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
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
    const existing = await this.users.exists({
      email: dto.email.toLowerCase(),
    });
    if (existing)
      throw new UnauthorizedException('Email is already registered');
    const user = await this.users.create({
      email: dto.email.toLowerCase(),
      passwordHash: await hash(dto.password, 12),
      name: dto.name,
    });
    const workspace = await this.workspaces.create({
      name: `${dto.name}'s Wallet`,
      type: 'personal',
      ownerId: user._id,
    });
    await this.memberships.create({
      workspaceId: workspace._id,
      userId: user._id,
      role: 'owner',
    });
    return this.issueTokens(user);
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
    return this.issueTokens(user);
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
      });
      const workspace = await this.workspaces.create({
        name: `${name}'s Wallet`,
        type: 'personal',
        ownerId: user._id,
      });
      await this.memberships.create({
        workspaceId: workspace._id,
        userId: user._id,
        role: 'owner',
      });
    } else if (!user.googleId) {
      user.googleId = googleId;
      if (!user.name?.trim()) user.name = name;
      await user.save();
    }

    return this.issueTokens(user);
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
    if (!session) throw new UnauthorizedException('Refresh token was revoked');
    session.revokedAt = new Date();
    await session.save();
    const user = await this.users.findById(payload.sub);
    if (!user?.active) throw new UnauthorizedException('User is inactive');
    return this.issueTokens(user);
  }

  async logout(rawToken: string) {
    await this.refreshSessions.updateOne(
      { tokenHash: this.digest(rawToken), revokedAt: { $exists: false } },
      { $set: { revokedAt: new Date() } },
    );
    return { success: true };
  }

  private async issueTokens(user: User) {
    const tokenId = randomUUID();
    const accessToken = await this.jwt.signAsync(
      { sub: user._id.toString(), email: user.email, kind: 'access' },
      {
        secret: this.config.getOrThrow('JWT_ACCESS_SECRET'),
        expiresIn: this.config.get('JWT_ACCESS_TTL', '15m'),
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
        expiresIn: this.config.get('JWT_REFRESH_TTL', '30d'),
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
      user: { id: user._id, email: user.email, name: user.name },
    };
  }

  private digest(token: string): string {
    return createHash('sha256').update(token).digest('hex');
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
  @Post('logout')
  logout(@Body() dto: RefreshDto) {
    return this.auth.logout(dto.refreshToken);
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
    { provide: APP_GUARD, useExisting: AccessTokenGuard },
  ],
  exports: [MongooseModule, AuthService],
})
export class AuthModule {}
