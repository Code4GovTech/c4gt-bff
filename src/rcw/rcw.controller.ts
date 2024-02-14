import { Body, Controller, Get, Param, Post, Req, Res } from '@nestjs/common';
import { RcwService } from './rcw.service';
import { async } from 'rxjs';
import { Request, Response } from 'express';
import { CreateCredDTO, CreateTemplateDTO } from './dto/requst.dto';

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
    // console.log('in verify');
    const resp = await this.rcwService.verifyCredential(id, 'verified.html');
    // console.log('res: ', resp);
    res.send(resp);
    // return await this.rcwService.verifyCredential(id);
  }

  // @Get('/generateDIDs')
  // async generateDIDs() {
  //   return this.rcwService.generateDIDs();
  // }

  @Post('/schema')
  async createNewSchema(@Body() schema: any) {
    return await this.rcwService.createNewSchema(schema);
  }

  @Post('/credential')
  async createNewCredential(@Body() credential: CreateCredDTO) {
    return await this.rcwService.generateNewCredential(credential);
  }

  @Get('/credential/:id')
  async getCredentialsById(@Param('id') credentialId: string) {
    return await this.rcwService.getCredentialsById(credentialId);
  }

  @Post('/templates')
  async createNewTemplate(@Body() createTemplateDto: CreateTemplateDTO) {
    return await this.rcwService.createNewTemplate(createTemplateDto);
  }

  @Get('/templates/schema/:id')
  async getTemplates(@Param('id') id: string) {
    return await this.rcwService.getTemplatesBySchemaId(id);
  }

  @Get('/templates/:id')
  async getTemplateByTemplateId(@Param('id') templateId: string) {
    return await this.rcwService.getTemplateByTemplateId(templateId);
  }
}
