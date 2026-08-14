import {
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class BrevoMailer {
  constructor(private readonly config: ConfigService) {}

  async sendHtml(input: {
    to: string;
    subject: string;
    htmlContent: string;
    attachments?: Array<{ name: string; content: string }>;
  }): Promise<{ delivered: boolean }> {
    const apiKey = this.config.get<string>('BREVO_API_KEY');
    if (!apiKey?.trim()) {
      if (this.config.get('NODE_ENV', 'development') === 'production') {
        throw new ServiceUnavailableException('Email provider unavailable');
      }
      return { delivered: false };
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
        to: [{ email: input.to }],
        subject: input.subject,
        htmlContent: input.htmlContent,
        ...(input.attachments?.length
          ? {
              attachment: input.attachments.map((file) => ({
                name: file.name,
                content: file.content,
              })),
            }
          : {}),
      }),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new ServiceUnavailableException(
        `Invite email could not be sent${detail ? `: ${detail.slice(0, 200)}` : ''}`,
      );
    }
    return { delivered: true };
  }
}
