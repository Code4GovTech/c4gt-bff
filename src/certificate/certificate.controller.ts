import { Controller } from '@nestjs/common';
import { PDFRendererService } from './pdf-renderer/pdf-renderer.service';

@Controller('certificate')
export class CertificateController {
  constructor(private readonly pdfRenderer: PDFRendererService) {}
}
