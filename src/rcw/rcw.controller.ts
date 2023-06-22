import { Controller, Get } from '@nestjs/common';
import { RcwService } from './rcw.service';

@Controller('rcw')
export class RcwController {
  constructor(private readonly rcwService: RcwService) {}

  @Get()
  async makeItRun() {
    return this.rcwService.processCSV('data/sample.csv');
  }
}
