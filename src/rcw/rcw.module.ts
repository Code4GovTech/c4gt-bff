import { Module } from '@nestjs/common';
import { RcwService } from './rcw.service';
import { HttpModule } from '@nestjs/axios';
import { RcwController } from './rcw.controller';

@Module({
  imports: [HttpModule],
  providers: [RcwService],
  controllers: [RcwController],
})
export class RcwModule {}
