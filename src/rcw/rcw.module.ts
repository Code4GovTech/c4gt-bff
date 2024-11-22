import { Module } from '@nestjs/common';
import { RcwService } from './rcw.service';
import { HttpModule } from '@nestjs/axios';
import { RcwController } from './rcw.controller';
import { ExecService } from './pdf.service';

@Module({
  imports: [HttpModule],
  providers: [RcwService, ExecService],
  controllers: [RcwController],
  exports: [RcwService],
})
export class RcwModule {}
