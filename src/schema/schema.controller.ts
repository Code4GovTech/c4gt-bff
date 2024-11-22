import { Body, Controller, Get, Post, Put, Param } from '@nestjs/common';
import { SchemaService } from './schema.service';
import { CreateSchemaDTO } from './schema.dto';

@Controller('schema')
export class SchemaController {
  constructor(private readonly schemaService: SchemaService) {}
  @Get(':id?')
  getCredentialSchema(@Param('id') id?: string) {
    return this.schemaService.getCredentialSchema(id);
  }

  @Post()
  async createCredentialSchema(
    @Body() createCredentialSchemaPayload: CreateSchemaDTO,
  ) {
    return await this.schemaService.createCredentialSchema(
      createCredentialSchemaPayload,
    );
  }

  @Put()
  editCredentialSchema() {
    this.schemaService.editCredentialSchema();
  }
}
