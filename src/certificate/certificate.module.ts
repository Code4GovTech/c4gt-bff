import { Module } from '@nestjs/common';
import { CertificateService } from './certificate.service';
import { CertificateController } from './certificate.controller';
import { PDFRendererService } from './pdf-renderer/pdf-renderer.service';
import { MinioClient } from './minio-client/minio-client.service';

@Module({
  providers: [CertificateService, PDFRendererService, MinioClient],
  controllers: [CertificateController],
})
export class CertificateModule {}
