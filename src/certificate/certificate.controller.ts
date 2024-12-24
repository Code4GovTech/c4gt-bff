import { Controller, Get, Post, Patch, Delete, Param, Query } from '@nestjs/common';
import { CreateCertificateDTO } from './certificate.dto';
import { CertificateService } from './certificate.service';

@Controller('certificate')
export class CertificateController {
  constructor(private readonly certificateService: CertificateService) {}

  @Get(':id?')
  getCertificates(
    @Param('id') id?: string,
    @Query('templateId') templateId?: string,
    @Query('schemaId') schemaId?: string,
  ) {}

  @Post('preview')
  async renderCertificatePreview(createCertificatePayload: CreateCertificateDTO) {
    createCertificatePayload.saveToMinio = false;
    return await this.certificateService.renderCertificate(createCertificatePayload);
  }
  
}
