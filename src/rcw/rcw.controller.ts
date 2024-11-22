import { Body, Controller, Get, Param, Post, Req, Res } from '@nestjs/common';
import { RcwService } from './rcw.service';
import { Request, Response } from 'express';
import { CreateCredDTO, CreateTemplateDTO } from './dto/credentialRequests.dto';

@Controller('rcw')
export class RcwController {
  constructor(private readonly rcwService: RcwService) {}

  @Get()
  async makeItRun() {
    return await this.rcwService.processCSV('data/SaturdayBatch.csv');
  }

  @Get('/verify/:id')
  async verify(
    @Param('id') id: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const resp = await this.rcwService.verifyCredential(id, 'verified.html');
    res.send(resp);
  }

  @Post('/credential')
  async createNewCredential(@Body() credential: CreateCredDTO) {
    return await this.rcwService.generateNewCredential(credential);
  }

  @Get('/credential/:id')
  async getCredentialsById(@Param('id') credentialId: string) {
    return await this.rcwService.getCredentialsById(credentialId);
  }
}
