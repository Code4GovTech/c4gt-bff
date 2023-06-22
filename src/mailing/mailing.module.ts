import { Module } from '@nestjs/common';
import { MailingService } from './mailing.service';
import { MailerModule } from '@nestjs-modules/mailer';

@Module({
  imports: [MailerModule],
  providers: [MailingService],
  exports: [MailingService],
})
export class MailingModule {}
