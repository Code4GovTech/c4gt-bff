import { Controller, Get, Param, Req, Res } from '@nestjs/common';
import { RcwService } from './rcw.service';
import { async } from 'rxjs';
import { Request, Response } from 'express';

@Controller('rcw')
export class RcwController {
  constructor(private readonly rcwService: RcwService) {}

  @Get()
  async makeItRun() {
    return this.rcwService.processCSV('data/sample.csv');
  }

  @Get('/verify/:id')
  async verify(
    @Param('id') id: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    res.send(await this.rcwService.verifyCredential(id));
    // return await this.rcwService.verifyCredential(id);
  }

  // @Get('/generateDIDs')
  // async generateDIDs() {
  //   return this.rcwService.generateDIDs();
  // }
}
