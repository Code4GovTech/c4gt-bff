import { Controller, Get, Post, Patch, Delete } from '@nestjs/common';
import { PDFRendererService } from './pdf-renderer/pdf-renderer.service';
import { MinioClient } from './minio-client/minio-client.service';

@Controller('certificate')
export class CertificateController {
  constructor(private readonly pdfRenderer: PDFRendererService, private readonly minioClient: MinioClient) {

  }
}
