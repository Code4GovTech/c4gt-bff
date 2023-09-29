import { Module } from '@nestjs/common';
import { RcwService } from './rcw.service';
import { HttpModule } from '@nestjs/axios';
import { RcwController } from './rcw.controller';
import { MailingModule } from 'src/mailing/mailing.module';
import { ExecService } from './pdf.service';

@Module({
  imports: [HttpModule, MailingModule],
  providers: [RcwService, ExecService],
  controllers: [RcwController],
  exports: [RcwService],
})
export class RcwModule {}
