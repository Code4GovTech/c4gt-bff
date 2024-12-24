import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RcwModule } from './rcw/rcw.module';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { SchemaController } from './schema/schema.controller';
import { SchemaModule } from './schema/schema.module';
import { TemplateModule } from './template/template.module';
import { CertificateModule } from './certificate/certificate.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { IdentityModule } from './identity/identity.module';
import configuration from './config/configuration';

@Module({
  imports: [
    RcwModule,
    ConfigModule.forRoot({
      load: [configuration],
      isGlobal: true,
    }),
    HttpModule,
    SchemaModule,
    TemplateModule,
    CertificateModule,
    PrismaModule,
    IdentityModule,
  ],
  controllers: [AppController, SchemaController],
  providers: [AppService],
})
export class AppModule {}
