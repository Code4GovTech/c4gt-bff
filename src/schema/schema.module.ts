import { Module } from '@nestjs/common';
import { SchemaService } from './schema.service';
import { HttpModule } from '@nestjs/axios';
import { SchemaController } from './schema.controller';

@Module({
  imports: [HttpModule],
  controllers: [SchemaController],
  providers: [SchemaService],
  exports: [SchemaService]
})
export class SchemaModule {
  
}
