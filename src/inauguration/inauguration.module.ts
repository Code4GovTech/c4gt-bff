import { Module } from '@nestjs/common';
import { InaugurationController } from './inauguration.controller';
import { InaugurationService } from './inauguration.service';
import { RcwModule } from 'src/rcw/rcw.module';
import { RcwService } from 'src/rcw/rcw.service';
import { HttpModule } from '@nestjs/axios';
import { MailingService } from 'src/mailing/mailing.service';

@Module({
  imports: [HttpModule, RcwModule],
  providers: [InaugurationService],
  controllers: [InaugurationController],
})
export class InaugurationModule {}
