import { Inject, Injectable, Logger } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';

export type NotificationChannel = 'email' | 'sms' | 'whatsapp';

export interface Notification {
  channel: NotificationChannel;
  /** PERSONAL DATA (e-mail address / phone number): never logged. */
  to: string;
  subject?: string;
  text: string;
  /** Non-personal reference for logs, e.g. "commande:<uuid>". */
  reference: string;
}

/** Notification port. Adapters: SMTP (Mailpit locally) for e-mail; SMS / WhatsApp are stubs. */
export interface NotificationProvider {
  send(notification: Notification): Promise<void>;
}

export const NOTIFICATION_PROVIDER = Symbol.for('agricoop.NOTIFICATION_PROVIDER');

/** E-mail through SMTP; SMS and WhatsApp are logged (without the number) until a provider is chosen. */
@Injectable()
export class DefaultNotificationProvider implements NotificationProvider {
  private readonly logger = new Logger('Notifications');
  private readonly mailer: Transporter;

  constructor(
    @Inject('SMTP_URL') smtpUrl: string,
    @Inject('MAIL_FROM') private readonly from: string,
  ) {
    this.mailer = createTransport(smtpUrl);
  }

  async send(n: Notification): Promise<void> {
    if (n.channel === 'email') {
      await this.mailer.sendMail({ from: this.from, to: n.to, subject: n.subject, text: n.text });
      this.logger.log({ channel: 'email', reference: n.reference }, 'notification sent');
      return;
    }
    this.logger.log(
      { channel: n.channel, reference: n.reference },
      'notification stubbed (no provider)',
    );
  }
}

/** Test double: records notifications in memory. */
export class InMemoryNotificationProvider implements NotificationProvider {
  readonly sent: Notification[] = [];
  send(n: Notification): Promise<void> {
    this.sent.push(n);
    return Promise.resolve();
  }
}
