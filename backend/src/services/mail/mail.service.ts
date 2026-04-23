import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';
import type { SendMailOptions, SendMailResult } from './mail.types';

@Injectable()
export class MailService {
  private readonly transporter: Transporter<
    SMTPTransport.SentMessageInfo,
    SMTPTransport.Options
  >;
  private readonly fromAddress: string;
  private readonly logger = new Logger(MailService.name);

  constructor(private configService: ConfigService) {
    this.fromAddress = this.configService.getOrThrow<string>('SMTP_FROM');

    this.transporter = createTransport({
      host: this.configService.getOrThrow<string>('SMTP_HOST'),
      port: Number(this.configService.getOrThrow<string>('SMTP_PORT')),
      secure: this.configService.getOrThrow<string>('SMTP_SECURE') === 'true',
      auth: {
        user: this.configService.getOrThrow<string>('SMTP_USER'),
        pass: this.configService.getOrThrow<string>('SMTP_PASS'),
      },
    });
  }

  async sendMail(options: SendMailOptions): Promise<SendMailResult> {
    const info = await this.transporter.sendMail({
      from: this.fromAddress,
      to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });

    this.logger.log(`Email sent: ${info.messageId} to ${String(options.to)}`);

    return {
      messageId: info.messageId,
      accepted: info.accepted as string[],
      rejected: info.rejected as string[],
    };
  }

  async verifyConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      this.logger.log('SMTP connection verified');
      return true;
    } catch {
      this.logger.error('SMTP connection failed');
      return false;
    }
  }
}
