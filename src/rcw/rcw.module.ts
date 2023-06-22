import { Module } from '@nestjs/common';
import { RcwService } from './rcw.service';
import { HttpModule } from '@nestjs/axios';
import { RcwController } from './rcw.controller';
import { MailingModule } from 'src/mailing/mailing.module';

@Module({
  imports: [HttpModule, MailingModule],
  providers: [RcwService],
  controllers: [RcwController],
})
export class RcwModule {}
