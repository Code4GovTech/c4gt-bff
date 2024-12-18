import { Controller, Get, Post, Delete, Put, Param, Body, Query } from '@nestjs/common';
import { CreateTemplateDTO, SetVerificationTemplateDTO } from './template.dto';
import { TemplateService } from './template.service';

@Controller('template')
export class TemplateController {
  constructor(private readonly templateService: TemplateService) {}
  @Get(':id?')
  async getCredentialRenderingTemplate(@Param('id') id?: string, @Query('schemaId') schemaId?: string) {
    return await this.templateService.getTemplates(id, schemaId);
  }

  @Post()
  async createCredentialRenderingTemplate(@Body() createCredentialRenderingTemplatePayload: CreateTemplateDTO) {
    return await this.templateService.createTemplate(createCredentialRenderingTemplatePayload);
  }

  @Post(':id/set')
  async mapVerificationTemplate(@Param('id') id: string, @Body() setVerificationTemplatePayload: SetVerificationTemplateDTO) {
    return await this.templateService.setVerificationTemplate(id, setVerificationTemplatePayload);
  }

  @Put()
  editCredentialRenderingTemplate() {
    return;
  }

  @Delete()
  deleteCredentialRenderingTemplate() {
    return;
  }
}
