import { MailerService } from '@nestjs-modules/mailer';

export class MailingService {
  constructor(private readonly mailerService: MailerService) {}
}
