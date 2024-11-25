import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import QRCode from 'qrcode';
import { TemplateService } from 'src/template/template.service';
import { PDFRendererService } from './pdf-renderer/pdf-renderer.service';
import { MinioClient } from './minio-client/minio-client.service';
import { HttpService } from '@nestjs/axios';
import { CreateCertificateDTO } from './certificate.dto';

interface CertificateConfig {
  baseUrl: string;
  defaultCredentialContext: Array<string>;
  defaultSigningId: string;
  defaultCertificateLifetime: number;
}

interface RCWCredentialServiceConfig {
  baseUrl: string;
}

@Injectable()
export class CertificateService {
  private config;
  private rcwCredentialingServiceConfig;
  constructor(
    private readonly configService: ConfigService,
    private readonly templateService: TemplateService,
    private readonly pdfService: PDFRendererService,
    private readonly minioService: MinioClient,
    private readonly httpService: HttpService,
  ) {
    this.config = this.configService.get<CertificateConfig>('certificates');
    this.rcwCredentialingServiceConfig = this.configService.get<RCWCredentialServiceConfig>('credentialService');
  }
  private async renderVerificationUrlAsQR(credentialId: string) {
    try {
      const verificationURL = `${this.config.baseUrl}/rcw/verify/${credentialId}`;
      console.log(verificationURL);
      const QRData = await QRCode.toDataURL(verificationURL);
      return QRData;
    } catch (err) {
      console.error(err);
      return err;
    }
  }

  private getCertificateExpiry(expiry: string){
    let expirationDate;
    if (expiry && !isNaN(new Date(expiry).getTime())) {
      expirationDate = new Date(expiry).toISOString();
    } else {
      expirationDate = new Date(Date.now() + this.config.defaultCertificateLifetime).toISOString();
    }

    return expirationDate;
  }

  async renderCertificate(createCertificatePayload: CreateCertificateDTO): Promise<Buffer|string> {
    // Create Credential
    const createCredentialResponse = await this.httpService.axiosRef.post(
      `${this.rcwCredentialingServiceConfig.baseUrl}/credentials/issue`,
      {
        credential: {
          '@context': this.rcwCredentialingServiceConfig.defaultCredentialContext,
          id: createCertificatePayload.credentialMetadata.id ?? 'C4GT',
          type: createCertificatePayload.credentialMetadata.type,
          issuer: this.rcwCredentialingServiceConfig.defaultSigningId, 
          issuanceDate: new Date().toISOString(),
          expirationDate: this.getCertificateExpiry(createCertificatePayload.credentialMetadata.expirationDate),
          credentialSubject: {
            ...createCertificatePayload.candidateData,
          },
          // options: {
          //   created: '2020-04-02T18:48:36Z',
          //   credentialStatus: {
          //     type: 'RevocationList2020Status',
          //   },
          // },
        },
        credentialSchemaId: createCertificatePayload.schemaId,
        tags: createCertificatePayload.credentialMetadata.tags ?? [],
      },
    );
    // Render Them As PDFs
    const template = await this.templateService.getTemplateByTemplateId(createCertificatePayload.templateId);
    const compiledTemplate = this.pdfService.compileRenderingTemplate(createCertificatePayload.candidateData, template);
    const renderedPdf = await this.pdfService.renderPDF(compiledTemplate);
    // Optionally Store in Minio
    if (createCertificatePayload.saveToMinio) {
      this.minioService.upload(createCredentialResponse.data.credential.id, renderedPdf);
      //TODO: return minio link here
    }
    return renderedPdf;
  }
}
