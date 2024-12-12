import { PDFOptions, PuppeteerLaunchOptions } from 'puppeteer';

class CredentialMetaData{
    id: string;
    type: Array<string>;
    //2123-01-01T00:00:00Z
    expirationDate: string;
    tags: Array<string>;
}

export class CreateCertificateDTO{
    templateId?: string;
    schemaId?:string;
    handlebarTemplate?: string;
    candidateData: object;
    credentialMetadata: CredentialMetaData;
    saveToMinio?: boolean;
    puppeteerLaunchOption?: PuppeteerLaunchOptions;
    pdfRenderingOptions?: PDFOptions
}