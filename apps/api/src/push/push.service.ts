import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { readFileSync } from 'node:fs';
import { connect as http2Connect, type ClientHttp2Session } from 'node:http2';
import { Model, Types } from 'mongoose';
import { sign } from 'jsonwebtoken';
import { Membership, User, Workspace } from '../auth/auth.module';
import { Calendar, CalendarMembership } from '../collaboration/collaboration.schemas';
import { DevicePushToken } from './push.schemas';

export type PushPayload = {
  title: string;
  body: string;
  data?: Record<string, string>;
  badge?: number;
  sound?: string;
};

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private apnsJwt: { token: string; expiresAt: number } | null = null;
  private apnsKeyPem: string | null = null;

  constructor(
    @InjectModel(DevicePushToken.name)
    private readonly tokens: Model<DevicePushToken>,
    @InjectModel(Membership.name)
    private readonly memberships: Model<Membership>,
    @InjectModel(Workspace.name)
    private readonly workspaces: Model<Workspace>,
    @InjectModel(User.name)
    private readonly users: Model<User>,
    @InjectModel(CalendarMembership.name)
    private readonly calendarMemberships: Model<CalendarMembership>,
    @InjectModel(Calendar.name)
    private readonly calendars: Model<Calendar>,
    private readonly config: ConfigService,
  ) {}

  async registerToken(
    userId: string,
    input: { token: string; platform: 'ios' | 'android' | 'expo' },
  ) {
    const token = input.token.trim();
    if (!token) return { registered: false };
    await this.tokens.findOneAndUpdate(
      { token },
      {
        $set: {
          userId: new Types.ObjectId(userId),
          platform: input.platform,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    return { registered: true };
  }

  async unregisterToken(userId: string, token?: string) {
    if (token?.trim()) {
      await this.tokens.deleteOne({
        userId: new Types.ObjectId(userId),
        token: token.trim(),
      });
    } else {
      await this.tokens.deleteMany({ userId: new Types.ObjectId(userId) });
    }
    return { unregistered: true };
  }

  /** Fire-and-forget safe wrapper. */
  notifyWorkspaceMembers(
    workspaceId: string,
    actorUserId: string,
    payload: PushPayload,
  ): void {
    void this.sendToWorkspaceMembers(workspaceId, actorUserId, payload).catch(
      (error: unknown) => {
        this.logger.warn(
          `Workspace push failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      },
    );
  }

  notifyCalendarMembers(
    calendarId: string,
    actorUserId: string,
    payload: PushPayload,
  ): void {
    void this.sendToCalendarMembers(calendarId, actorUserId, payload).catch(
      (error: unknown) => {
        this.logger.warn(
          `Calendar push failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      },
    );
  }

  notifyUsers(userIds: string[], actorUserId: string, payload: PushPayload): void {
    const recipients = userIds.filter((id) => id && id !== actorUserId);
    void this.sendToUsers(recipients, payload).catch((error: unknown) => {
      this.logger.warn(
        `User push failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    });
  }

  async sendToWorkspaceMembers(
    workspaceId: string,
    actorUserId: string,
    payload: PushPayload,
  ) {
    const members = await this.memberships
      .find({ workspaceId: new Types.ObjectId(workspaceId) })
      .select('userId')
      .lean();
    const ids = members
      .map((member) => member.userId.toString())
      .filter((id) => id !== actorUserId);
    return this.sendToUsers(ids, payload);
  }

  async sendToCalendarMembers(
    calendarId: string,
    actorUserId: string,
    payload: PushPayload,
  ) {
    const members = await this.calendarMemberships
      .find({ calendarId: new Types.ObjectId(calendarId) })
      .select('userId')
      .lean();
    const ids = members
      .map((member) => member.userId.toString())
      .filter((id) => id !== actorUserId);
    return this.sendToUsers(ids, payload);
  }

  async workspaceName(workspaceId: string): Promise<string> {
    const workspace = await this.workspaces
      .findById(workspaceId)
      .select('name')
      .lean();
    return workspace?.name?.trim() || 'Libro';
  }

  async calendarName(calendarId: string): Promise<string> {
    const calendar = await this.calendars
      .findById(calendarId)
      .select('name')
      .lean();
    return calendar?.name?.trim() || 'Calendario';
  }

  async userDisplayName(userId: string): Promise<string> {
    const user = await this.users.findById(userId).select('name email').lean();
    return (
      user?.name?.trim() ||
      user?.email?.split('@')[0] ||
      'Un colaborador'
    );
  }

  async sendToUsers(userIds: string[], payload: PushPayload) {
    const unique = Array.from(new Set(userIds.filter(Boolean)));
    if (!unique.length) return { sent: 0 };
    const rows = await this.tokens
      .find({ userId: { $in: unique.map((id) => new Types.ObjectId(id)) } })
      .lean();
    if (!rows.length) return { sent: 0 };

    let sent = 0;
    for (const row of rows) {
      try {
        if (
          row.platform === 'expo' ||
          row.token.startsWith('ExponentPushToken')
        ) {
          await this.sendExpo(row.token, payload);
        } else if (row.platform === 'ios') {
          await this.sendApns(row.token, payload);
        } else {
          // Android native FCM not wired yet — skip quietly.
          continue;
        }
        sent += 1;
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : String(error);
        this.logger.warn(`Push to ${row.platform} token failed: ${message}`);
        if (/BadDeviceToken|Unregistered|DeviceNotRegistered/i.test(message)) {
          await this.tokens.deleteOne({ _id: row._id }).catch(() => undefined);
        }
      }
    }
    return { sent };
  }

  private async sendExpo(token: string, payload: PushPayload) {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        to: token,
        title: payload.title,
        body: payload.body,
        sound: payload.sound || 'default',
        badge: payload.badge,
        data: payload.data ?? {},
        priority: 'high',
      }),
    });
    if (!response.ok) {
      throw new Error(`Expo push HTTP ${response.status}`);
    }
    const body = (await response.json()) as {
      data?: { status?: string; message?: string };
    };
    if (body.data?.status === 'error') {
      throw new Error(body.data.message || 'Expo push error');
    }
  }

  private loadApnsKey(): string | null {
    if (this.apnsKeyPem) return this.apnsKeyPem;
    const base64 = this.config.get<string>('APNS_KEY_BASE64')?.trim();
    if (base64) {
      this.apnsKeyPem = Buffer.from(base64, 'base64').toString('utf8');
      return this.apnsKeyPem;
    }
    const path = this.config.get<string>('APNS_KEY_PATH')?.trim();
    if (path) {
      this.apnsKeyPem = readFileSync(path, 'utf8');
      return this.apnsKeyPem;
    }
    return null;
  }

  private getApnsJwt(): string | null {
    const key = this.loadApnsKey();
    const keyId = this.config.get<string>('APNS_KEY_ID')?.trim();
    const teamId = this.config.get<string>('APNS_TEAM_ID')?.trim();
    if (!key || !keyId || !teamId) return null;

    const now = Math.floor(Date.now() / 1000);
    if (this.apnsJwt && this.apnsJwt.expiresAt > now + 60) {
      return this.apnsJwt.token;
    }
    const token = sign({}, key, {
      algorithm: 'ES256',
      keyid: keyId,
      issuer: teamId,
      expiresIn: '50m',
    });
    this.apnsJwt = { token, expiresAt: now + 45 * 60 };
    return token;
  }

  private async sendApns(deviceToken: string, payload: PushPayload) {
    const jwt = this.getApnsJwt();
    const bundleId =
      this.config.get<string>('APNS_BUNDLE_ID')?.trim() ||
      'com.tecnowallet.mobile';
    if (!jwt) {
      throw new Error('APNS credentials are not configured');
    }

    const production =
      this.config.get<string | boolean>('APNS_PRODUCTION', false) === true ||
      this.config.get<string>('APNS_PRODUCTION') === 'true';
    const host = production
      ? 'api.push.apple.com'
      : 'api.sandbox.push.apple.com';
    const token = deviceToken.replace(/\s+/g, '');

    const body = JSON.stringify({
      aps: {
        alert: {
          title: payload.title,
          body: payload.body,
        },
        sound: payload.sound || 'default',
        badge: payload.badge ?? 1,
      },
      ...(payload.data ?? {}),
    });

    await new Promise<void>((resolve, reject) => {
      let client: ClientHttp2Session | undefined;
      try {
        client = http2Connect(`https://${host}`);
        client.on('error', reject);
        const req = client.request({
          ':method': 'POST',
          ':path': `/3/device/${token}`,
          authorization: `bearer ${jwt}`,
          'apns-topic': bundleId,
          'apns-push-type': 'alert',
          'apns-priority': '10',
          'content-type': 'application/json',
        });
        let status = 0;
        let responseBody = '';
        req.setEncoding('utf8');
        req.on('response', (headers) => {
          status = Number(headers[':status'] ?? 0);
        });
        req.on('data', (chunk) => {
          responseBody += chunk;
        });
        req.on('end', () => {
          client?.close();
          if (status >= 200 && status < 300) {
            resolve();
            return;
          }
          reject(
            new Error(
              `APNS ${status}${responseBody ? `: ${responseBody}` : ''}`,
            ),
          );
        });
        req.on('error', (error) => {
          client?.close();
          reject(error);
        });
        req.end(body);
      } catch (error) {
        client?.close();
        reject(error);
      }
    });
  }
}
