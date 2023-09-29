import { HttpService } from '@nestjs/axios';
import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import * as csvToJson from 'csvtojson';
import { CandidateJSON } from './rcw.interface';
import { Axios, AxiosResponse } from 'axios';
import * as wkhtmltopdf from 'wkhtmltopdf';
import { MailerService } from '@nestjs-modules/mailer';
import { MailingService } from 'src/mailing/mailing.service';
import { Client } from 'minio';
import * as fs from 'fs';
import {
  compileHBS,
  compileTemplate,
  createPDF,
  createPDFFromTemplate,
} from './genpdf';
import {
  CreateCredDTO,
  CreateCredSchemaDTO,
  CreateTemplateDTO,
} from './dto/requst.dto';
import { ExecService } from './pdf.service';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const QRCode = require('qrcode');

// import pLimit from 'p-limit';
// const limit = pLimit(5);

// import { emailText } from 'src/mails.config';

@Injectable()
export class RcwService {
  private failedDIDs = [];
  private failedCredentials = [];
  private failedPDFs = [];
  private failedEmails = [];
  private failedMinioUploads = [];
  private logger: Logger = new Logger('RCWService');

  constructor(
    private readonly httpService: HttpService,
    private readonly mailerService: MailerService,
    private readonly mailingService: MailingService,
    private readonly executorService: ExecService,
  ) {
    this.failedCredentials = [];
    this.failedDIDs = [];
    this.failedEmails = [];
    this.failedMinioUploads = [];
    this.failedPDFs = [];
  }

  async processCSV(csvPath: string) {
    // const files = ['sample.csv', 'lista.csv', 'listb.csv', 'listc.csv'];
    const files = ['sample.csv'];
    for (const file of files) {
      // setTimeout(async () => {
      //   // wait it out
      // }, 100);
      console.log('Processing file: ', file);
      const csvFilePath = './data/final/' + file;
      const jsonArray = await csvToJson().fromFile(csvFilePath);
      const idxIdMap = {};
      jsonArray.forEach((candidate: CandidateJSON, idx: number) => {
        idxIdMap[candidate.email] = idx;
      });

      let candidatesWithDIDs, candidatesWithCredentials;
      try {
        // console.log('jsonArray: ', jsonArray);
        candidatesWithDIDs = await this.generateDIDs(
          jsonArray as CandidateJSON[],
          idxIdMap,
        );
      } catch (err) {
        Logger.error('Error in generating DIDs', err);
        throw new InternalServerErrorException(err);
      }

      try {
        // console.log(candidatesWithDIDs);
        // fs.writeFileSync(
        //   `./output/dids-${Date.now()}.json`,
        //   JSON.stringify(candidatesWithDIDs),
        // );
        candidatesWithCredentials = await this.generateCredential(
          candidatesWithDIDs,
          idxIdMap,
          process.env.ACK_CRED_SCHEMA_ID,
          [
            'VerifiableCredential',
            'Acknowledgement',
            'C4GT23',
            'ProofOfSubmission',
          ],
          ['Acknowledgement', 'ProofOfSubmission', 'C4GT23'],
        );
      } catch (err) {
        console.log('err: ', err);
        Logger.error('Error in generating credentials', err);
        throw new InternalServerErrorException(err);
      }

      console.log(
        'candidatesWithCredentials: ',
        candidatesWithCredentials.length,
      );
      fs.writeFileSync(
        `./output/${file}.json`,
        JSON.stringify(candidatesWithCredentials),
      );
      // await this.generatePDFs(candidatesWithCredentials);
    }
    const failedPDFs = this.failedPDFs;
    const newFiles = ['sample.csv'];
    for (const file of newFiles) {
      const pdfsToGenerate = JSON.parse(
        fs.readFileSync(`./output/${file}.json`, 'utf-8'),
      );

      for (let i = 0; i < pdfsToGenerate.length; i++) {
        const candidate = pdfsToGenerate[i];
        try {
          await this.generatePDFs(candidate);
        } catch (err) {
          Logger.error('Error in generating PDF', err);
          this.failedPDFs.push(candidate.id);
        }
      }
    }

    fs.writeFileSync(
      `./output/failedPDFs.json`,
      JSON.stringify(this.failedPDFs),
    );
    return 'Done';
    // return candidatesWithDIDs;

    // render and send emails
  }

  async generateDIDs(
    candidates: CandidateJSON[],
    idxIdMap: { [k: string]: number },
  ) {
    const responses = await Promise.all(
      candidates.map((candidate: CandidateJSON, idx: number) => {
        // generate DID
        return this.httpService.axiosRef.post(
          `${process.env.IDENTITY_BASE_URL}/did/generate`,
          {
            content: [
              {
                alsoKnownAs: [candidate.email, candidate.name, candidate.id],
                services: [
                  {
                    id: 'C4GT',
                    type: 'ProposalAcknowledgement2023',
                    serviceEndpoint: {
                      '@context': 'schema.identity.foundation/hub',
                      '@type': 'C4GTEndpoint',
                      instance: ['https://www.codeforgovtech.in/'],
                    },
                  },
                ],
                method: 'C4GT',
              },
            ],
          },
        );
      }),
    );

    // const failedUserIds = [];
    responses.forEach((response: AxiosResponse) => {
      try {
        // console.log(response.data);
        const did = response.data[0].id;
        candidates[idxIdMap[response.data[0].alsoKnownAs[0]]].did = did;
        idxIdMap[did] = idxIdMap[response.data[0].alsoKnownAs[0]];
      } catch (err) {
        Logger.error(`Error in mapping did of user`);
        console.log('error: ', err);
        this.failedDIDs.push(response.data[0].alsoKnownAs[0]);
      }
    });

    return candidates;
  }

  async generateCredential(
    candidates: CandidateJSON[],
    idxIdMap: { [k: string]: number },
    credSchemaId: string = process.env.ACK_SCHEMA_ID,
    type: string[] = ['VerifiableCredential', 'Acknowledgement', 'C4GT23'],
    tags: string[] = ['C4GT23'],
  ) {
    const responses = await Promise.all(
      candidates.map((candidate: CandidateJSON, idx: number) => {
        // console.log('candidateDID: ', candidate.did);
        return this.httpService.axiosRef.post(
          `${process.env.CREDENTIAL_BASE_URL}/credentials/issue`,
          {
            credential: {
              '@context': [
                'https://www.w3.org/2018/credentials/v1',
                'https://www.w3.org/2018/credentials/examples/v1',
              ],
              id: 'C4GT',
              type,
              issuer: process.env.C4GT_DID, //'did:C4GT:8a88baed-3d5b-448d-8dbf-6c184e59c7b7',
              issuanceDate: new Date().toISOString(),
              expirationDate: new Date('2123-01-01T00:00:00Z').toISOString(),
              credentialSubject: {
                id: candidate.did,
                name: candidate.name,
                email: candidate.email,
              },
              options: {
                created: '2020-04-02T18:48:36Z',
                credentialStatus: {
                  type: 'RevocationList2020Status',
                },
              },
            },
            credentialSchemaId: credSchemaId,
            tags,
          },
        );
      }),
    );

    responses.forEach((response: AxiosResponse) => {
      try {
        // console.log('cred did: ', response.data.credential.id);
        candidates[
          idxIdMap[response.data.credential.credentialSubject.id]
        ].credentialDID = response.data.credential.id;
        candidates[
          idxIdMap[response.data.credential.credentialSubject.id]
        ].credential = response.data.credential;
      } catch (err) {
        Logger.error(`Error in mapping credentialDID of user`, err.message);
      }
    });

    return candidates;
  }

  async getCredentialPDFData(credential: any, templateId: string) {
    // fetch the template
    // const templateResponse: AxiosResponse = await this.httpService.axiosRef.get(
    //   `${process.env.SCHEMA_BASE_URL}/rendering-template/${templateId}`,
    // );
    // const template = templateResponse.data.template;
    // console.log('template: ', template);
    try {
      const response = await this.httpService.axiosRef.post(
        `${process.env.CREDENTIAL_BASE_URL}/credentials/render`,
        {
          credential: credential,
          template: fs.readFileSync('./templates/final.html', 'utf8'),
          output: 'HTML',
        },
      );

      console.log(response.data);
      return response.data;
    } catch (err) {
      console.log(err);
      Logger.error(`Error in generating PDF`, err.message);
    }
  }

  async renderAsQR(cred) {
    try {
      const verificationURL = `${process.env.FRONTEND_BASE_URL}/rcw/verify/${cred.id}`;
      const QRData = await QRCode.toDataURL(verificationURL);
      return QRData;
    } catch (err) {
      console.error(err);
      return err;
    }
  }
  async generatePDFs2(candidates: CandidateJSON[]) {
    const failedPDFCreations = [];
    const failedUploads = [];
    const failedEmails = [];
    const fileCandidateMapping = [];

    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i];
      const fileName = `${candidate.id}_${candidate.name}.pdf`;
      const filePath = `./pdfs/${fileName}`;
      // GENERATE QR
      const qr = await this.renderAsQR(candidates[i].credential);
      console.time('pdfCreation');
      try {
        await createPDF({ name: candidate.name, qr: qr }, filePath);
        // const template = Handlebars.compile(
        //   fs.readFileSync('./templates/final.html', 'utf8'),
        // );
        // const data = template({ name: candidate.name, qr: qr });
        // await this.genPdfFromWKHTML(data, filePath);
      } catch (er) {
        console.log('eror in pdf generation: ', er);
        failedPDFCreations.push(candidate);
        continue;
      }
      console.timeEnd('pdfCreation');
      const minioURL = `http://${process.env.MINIO_ENDPOINT}:${process.env.MINIO_PORT}/${process.env.MINIO_BUCKETNAME}/${fileName}`;

      console.time('uploadToMinio');
      try {
        await this.uploadToMinio(`${fileName}`, `${filePath}`);
        fileCandidateMapping[candidate.id] = { minioURL, filePath, fileName };
      } catch (err) {
        console.error('error uploading to minio: ', err);
        failedUploads.push(candidate);
        // throw new InternalServerErrorException('Error uploading to minio');
      }
      console.timeEnd('uploadToMinio');
    }
    // sending emails
    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i];
      const { minioURL, filePath, fileName } =
        fileCandidateMapping[candidate.id];
      try {
        console.log(minioURL);
        await this.mailingService.sendEmail(
          candidate.email,
          'Thank you for applying to C4GT 2023!',
          fs.readFileSync('./templates/email.html', 'utf8'),
          {
            // data: data,
            path: `http://${process.env.MINIO_ENDPOINT}:${process.env.MINIO_PORT}/${process.env.MINIO_BUCKETNAME}/${fileName}`,
            filename: `${fileName}`,
          },
        );
      } catch (err) {
        console.log('err: ', err);
        Logger.error(`Error in sending email for ${candidate.name} ${err}`);
        failedEmails.push(candidate);
        // throw new InternalServerErrorException('Error sending email');
      }
    }
  }

  async generatePDFs(candidates: CandidateJSON[]) {
    const failedPDFCreations = [];
    const failedUploads = [];
    const failedEmails = [];
    const fileCandidateMapping = [];

    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i];
      const fileName = `${candidate.id}_${candidate.name}.pdf`;
      const filePath = `./pdfs/${fileName}`;
      // GENERATE QR
      const qr = await this.renderAsQR(candidates[i].credential);
      console.time('pdfCreation');
      try {
        await createPDF({ name: candidate.name, qr: qr }, filePath);
        // const template = Handlebars.compile(
        //   fs.readFileSync('./templates/final.html', 'utf8'),
        // );
        // const data = template({ name: candidate.name, qr: qr });
        // await this.genPdfFromWKHTML(data, filePath);
      } catch (er) {
        console.log('eror in pdf generation: ', er);
        failedPDFCreations.push(candidate);
        continue;
      }
      console.timeEnd('pdfCreation');
      const minioURL = `http://${process.env.MINIO_ENDPOINT}:${process.env.MINIO_PORT}/${process.env.MINIO_BUCKETNAME}/${fileName}`;

      console.time('uploadToMinio');
      try {
        await this.uploadToMinio(`${fileName}`, `${filePath}`);
        fileCandidateMapping[candidate.id] = { minioURL, filePath, fileName };
      } catch (err) {
        console.error('error uploading to minio: ', err);
        failedUploads.push(candidate);
        // throw new InternalServerErrorException('Error uploading to minio');
      }
      console.timeEnd('uploadToMinio');
    }

    // sending emails
    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i];
      const { minioURL, filePath, fileName } =
        fileCandidateMapping[candidate.id];
      console.time('sendEmail');
      try {
        console.log(minioURL);
        await this.mailingService.sendEmail(
          candidate.email,
          'Thank you for applying to C4GT 2023!',
          fs.readFileSync('./templates/email.html', 'utf8'),
          {
            // data: data,
            path: `http://${process.env.MINIO_ENDPOINT}:${process.env.MINIO_PORT}/${process.env.MINIO_BUCKETNAME}/${fileName}`,
            filename: `${fileName}`,
          },
        );
      } catch (err) {
        console.log('err: ', err);
        Logger.error(`Error in sending email for ${candidate.name} ${err}`);
        failedEmails.push(candidate);
        // throw new InternalServerErrorException('Error sending email');
      }
      console.timeEnd('sendEmail');
    }
  }

  public async verifyCredential(
    credentialDID: string,
    verifiedTemplaeFile: string,
  ) {
    // verify on the server
    try {
      const resp: AxiosResponse = await this.httpService.axiosRef.get(
        `${process.env.CREDENTIAL_BASE_URL}/credentials/${credentialDID}/verify`,
      );

      const verificatonData = resp.data;

      if (verificatonData.status === 'ISSUED') {
        const credResp = await this.httpService.axiosRef.get(
          `${process.env.CREDENTIAL_BASE_URL}/credentials/${credentialDID}`,
        );
        const data = credResp.data;

        const schemaResp = await this.httpService.axiosRef.get(
          `${process.env.CREDENTIAL_BASE_URL}/credentials/schema/${data.id}`,
        );

        const schemaId = schemaResp.data.credential_schema;

        // fetch template via schemaId

        const templates = await this.getTemplatesBySchemaId(schemaId);

        let template;
        for (let i = 0; i < templates.length; i++) {
          const temp = templates[i];
          if (temp.type.trim() === 'verified') {
            template = temp.template;
            break;
          }
        }

        console.log('template: ', template);

        console.log('data: ', data);
        const qr = await this.renderAsQR(data.id);
        const html = compileHBS(
          {
            ...data.credentialSubject,
            qr: qr,
          },
          template ?? verifiedTemplaeFile,
        );
        return html;
        // return {
        //   status: 'ISSUED',
        //   credential: data,
        //   html: `'${html}`,
        // };
      } else {
        return 'Invalid credential';
      }
    } catch (err) {
      console.log('err: ', err);
      throw new InternalServerErrorException(err);
    }
  }

  public async verifyCredentialOld(
    credentialDID: string,
    verifiedTemplaeFile: string,
  ) {
    // verify on the server
    try {
      const resp: AxiosResponse = await this.httpService.axiosRef.get(
        `${process.env.CREDENTIAL_BASE_URL}/credentials/${credentialDID}/verify`,
      );

      const verificatonData = resp.data;

      if (verificatonData.status === 'ISSUED') {
        const credResp = await this.httpService.axiosRef.get(
          `${process.env.CREDENTIAL_BASE_URL}/credentials/${credentialDID}`,
        );
        const data = credResp.data;

        /*const schemaResp = await this.httpService.axiosRef.get(
          `${process.env.CREDENTIAL_BASE_URL}/credentials/schema/${data.id}`,
        );

        const schemaId = schemaResp.data.credential_schema;

        // fetch template via schemaId

        const templates = await this.getTemplatesBySchemaId(schemaId);

        let template;
        for (let i = 0; i < templates.length; i++) {
          const temp = templates[i];
          if (temp.type.trim() === 'verified') {
            template = temp.template;
            break;
          }
        }

        console.log('template: ', template);
*/
        console.log('data: ', data);
        const qr = await this.renderAsQR(data.id);
        const html = compileTemplate(
          {
            ...data.credentialSubject,
            qr: qr,
          },
          verifiedTemplaeFile,
        );
        return html;
        // return {
        //   status: 'ISSUED',
        //   credential: data,
        //   html: `'${html}`,
        // };
      } else {
        return 'Invalid credential';
      }
    } catch (err) {
      console.log('err: ', err);
      throw new InternalServerErrorException(err);
    }
  }

  private async uploadToMinio(fileName, file) {
    const metaData = {
      'Content-Type': 'application/pdf',
    };

    const minioClient = new Client({
      endPoint: process.env.MINIO_ENDPOINT,
      port: parseInt(process.env.MINIO_PORT),
      useSSL: false,
      accessKey: process.env.MINIO_ACCESS_KEY,
      secretKey: process.env.MINIO_SECRET_KEY,
    });

    return new Promise((resolve, reject) => {
      minioClient.fPutObject(
        process.env.MINIO_BUCKETNAME,
        fileName,
        file,
        metaData,
        function (err, objInfo) {
          if (err) {
            reject(err);
          }
          console.log('Success', objInfo);
          resolve(
            `http://${process.env.MINIO_ENDPOINT}:${process.env.MINIO_PORT}/${process.env.MINIO_BUCKETNAME}/${fileName}`,
          );
        },
      );
    });
  }

  // async getCredentialsByUser(
  //   candidateEmail: string,
  //   idxIdMap: { [k: string]: number },
  // ) {
  //   const candidate = candidates[idxIdMap[candidateEmail]];
  //   const response: AxiosResponse = await this.httpService.axiosRef.post(
  //     `${process.env.CREDENTIAL_BASE_URL}/credentials/search`,
  //     {
  //       subject: {
  //         id: candidate.did,
  //       },
  //     },
  //   );

  //   return response.data;
  // }

  async createNewSchema(schema: CreateCredSchemaDTO) {
    const createdSchemaResp: AxiosResponse =
      await this.httpService.axiosRef.post(
        `${process.env.SCHEMA_BASE_URL}/credential-schema`,
        {
          schema: {
            '@context': [
              'https://www.w3.org/2018/credentials/v1',
              'https://www.w3.org/2018/credentials/examples/v1',
              'https://playground.chapi.io/examples/alumni/alumni-v1.json',
              'https://w3id.org/security/suites/ed25519-2020/v1',
            ],
            type: 'https://w3c-ccg.github.io/vc-json-schemas/',
            version: '1.0',
            id: '',
            name: schema.id,
            author: process.env.C4GT_DID, // this is harcoded to C4GT DID since this is C4GT BFF
            authored: new Date().toISOString(),
            schema: {
              $id: schema.id,
              $schema: 'https://json-schema.org/draft/2019-09/schema',
              description: schema.description,
              type: 'object',
              properties: {
                ...schema.properties,
              },
              required: schema.required,
              additionalProperties: false,
            },
            proof: {},
          },
          tags: schema.tags,
          status: 'PUBLISHED',
        },
      );

    return createdSchemaResp.data;
  }

  async generateNewCredential(createCredDTO: CreateCredDTO) {
    const { type, subject, schema, tags, templateId } = createCredDTO;
    // GENERATE CREDENTIAL
    const createCredentialResp: AxiosResponse =
      await this.httpService.axiosRef.post(
        `${process.env.CREDENTIAL_BASE_URL}/credentials/issue`,
        {
          credential: {
            '@context': [
              'https://www.w3.org/2018/credentials/v1',
              'https://www.w3.org/2018/credentials/examples/v1',
            ],
            id: 'C4GT',
            type,
            issuer: process.env.C4GT_DID, //'did:C4GT:8a88baed-3d5b-448d-8dbf-6c184e59c7b7',
            issuanceDate: new Date().toISOString(),
            expirationDate: new Date('2123-01-01T00:00:00Z').toISOString(),
            credentialSubject: {
              ...subject,
            },
            options: {
              created: '2020-04-02T18:48:36Z',
              credentialStatus: {
                type: 'RevocationList2020Status',
              },
            },
          },
          credentialSchemaId: schema,
          tags: tags ?? [],
        },
      );

    const credential = createCredentialResp.data.credential;

    const verificationURL = `${process.env.FRONTEND_BASE_URL}/rcw/verify/${credential?.id}`;
    // fetch the template using template ID given in DTO

    if (!templateId) {
      this.logger.warn('TemplateId not given hence skipping PDF creation.');
      return { verificationURL };
    }
    let template;
    try {
      const templateResp = await this.getTemplateByTemplateId(templateId);
      template = templateResp.template;
    } catch (err) {
      this.logger.error('Error fetching template: ', err);
      throw new InternalServerErrorException('Error fetching template');
    }

    // RENDER PDF AND UPLOAD TO MINIO
    if (!template) {
      this.logger.warn('Template not found hence skipping PDF creation.');
      return { verificationURL };
    }
    const fileName = `${credential.credentialSubject.username}_${credential.credentialSubject.badge}.pdf`;
    const filePath = `./pdfs/${fileName}`;
    try {
      const qr = await this.renderAsQR(credential);
      const pdfData = await createPDFFromTemplate(
        {
          ...credential.credentialSubject,
          qr,
        },
        template,
        filePath,
      );
    } catch (err) {
      this.logger.error('Error generating PDF: ', err);
      throw new InternalServerErrorException('Error generating PDF');
    }

    // CONVERT PDF BEFORE UPLOADING
    let outputPath = `./pdfs/_${fileName}`
    await this.executorService.pdfConvertorCommand(filePath, outputPath)

    // UPLOAD PDF to MINIO

    try {
      await this.uploadToMinio(`${fileName}`, `${outputPath}`);
    } catch (err) {
      this.logger.error('Error uploading file to minio: ', err);
      throw new InternalServerErrorException('Error uploading file to minio');
    }
    const minioURL = `http://${process.env.MINIO_ENDPOINT}:${process.env.MINIO_PORT}/${process.env.MINIO_BUCKETNAME}/${fileName}`;

    // delete the pdf file to freee up storage
    try {
      await fs.promises.unlink(filePath);
      await fs.promises.unlink(outputPath);
      console.log('File deleted successfully');
    } catch (err) {
      console.error('Error deleting file:', err);
    }
    return { verificationURL, minioURL };
  }

  async createNewTemplate(createTemplateDto: CreateTemplateDTO) {
    const temp = await this.httpService.axiosRef.post(
      `${process.env.SCHEMA_BASE_URL}/rendering-template`,
      {
        ...createTemplateDto,
      },
    );

    return temp.data;
  }

  async getTemplatesBySchemaId(schemaId: string) {
    const res = await this.httpService.axiosRef.get(
      `${process.env.SCHEMA_BASE_URL}/rendering-template?schemaId=${schemaId}`,
    );

    return res.data;
  }

  async getTemplateByTemplateId(templateId: string) {
    const res = await this.httpService.axiosRef.get(
      `${process.env.SCHEMA_BASE_URL}/rendering-template/${templateId}`,
    );

    return res.data;
  }

  async getCredentialsById(id: string) {
    const res = await this.httpService.axiosRef.get(
      `${process.env.CREDENTIAL_BASE_URL}/credentials/${id}`,
    );

    return res.data;
  }
}
