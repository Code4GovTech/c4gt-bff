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
import { compileTemplate, createPDF } from './genpdf';
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

  constructor(
    private readonly httpService: HttpService,
    private readonly mailerService: MailerService,
    private readonly mailingService: MailingService,
  ) {
    this.failedCredentials = [];
    this.failedDIDs = [];
    this.failedEmails = [];
    this.failedMinioUploads = [];
    this.failedPDFs = [];
  }

  async processCSV(csvPath: string) {
    const files = ['sample.csv', 'lista.csv', 'listb.csv', 'listc.csv'];
    // const files = ['sample.csv'];
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
      await this.generatePDFs(candidatesWithCredentials);
    }
    // const failedPDFs = this.failedPDFs;
    // const newFiles = ['sample.csv'];
    // for (const file of newFiles) {
    //   const pdfsToGenerate = JSON.parse(
    //     fs.readFileSync(`./output/${file}.json`, 'utf-8'),
    //   );

    //   for (let i = 0; i < pdfsToGenerate.length; i++) {
    //     const candidate = pdfsToGenerate[i];
    //     try {
    //       await this.generatePDFs(candidate);
    //     } catch (err) {
    //       Logger.error('Error in generating PDF', err);
    //       this.failedPDFs.push(candidate.id);
    //     }
    //   }
    // }

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
        this.failedDIDs.push(response.data[0].alsoKnownAs[0]);
      }
    });

    return candidates;

    // const res = [];

    // for (let i = 0; i < candidates.length; i++) {
    //   const candidate = candidates[i];
    //   console.log('candidate ', candidate);
    //   try {
    //     const didResp: AxiosResponse = await this.httpService.axiosRef.post(
    //       `${process.env.IDENTITY_BASE_URL}/did/generate`,
    //       {
    //         content: [
    //           {
    //             alsoKnownAs: [candidate.email, candidate.name, candidate.id],
    //             services: [
    //               {
    //                 id: 'C4GT',
    //                 type: 'ProposalAcknowledgement2023',
    //                 serviceEndpoint: {
    //                   '@context': 'schema.identity.foundation/hub',
    //                   '@type': 'C4GTEndpoint',
    //                   instance: ['https://www.codeforgovtech.in/'],
    //                 },
    //               },
    //             ],
    //             method: 'C4GT',
    //           },
    //         ],
    //       },
    //     );

    //     const didData = didResp.data;
    //     const did = didData.data[0].id;
    //     candidate.did = did;
    //     res.push({ ...candidate, did: did });
    //     // candidates[i].did = did;
    //     idxIdMap[did] = idxIdMap[didData.data[0].alsoKnownAs[0]];
    //   } catch (err) {
    //     Logger.error('Error in generating DID for user: ', candidate.email);
    //     this.failedDIDs.push(candidate.email);
    //   }
    // }

    // return res;
  }

  async generateCredential(
    candidates: CandidateJSON[],
    idxIdMap: { [k: string]: number },
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
              type: [
                'VerifiableCredential',
                'ProofOfSubmission',
                'Acknowledgement',
                'C4GT23',
              ],
              issuer: 'did:C4GT:8a88baed-3d5b-448d-8dbf-6c184e59c7b7', //process.env.C4GT_DID,
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
            credentialSchemaId: process.env.ACK_SCHEMA_ID,
            tags: ['Acknowledgement', 'ProofOfSubmission', 'C4GT23'],
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

  genPdfFromWKHTML(data, filePath) {
    return new Promise((resolve, reject) => {
      wkhtmltopdf(
        data,
        {
          orientation: 'landscape',
          disableExternalLinks: false,
          disableInternalLinks: false,
          disableJavascript: false,
          encoding: 'UTF-8',
        },
        (err, stream) => {
          if (err) reject(err);
          else {
            stream.pipe(fs.createWriteStream(filePath));
            resolve(stream);
          }
        },
      );
    });
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

  // async sendFinalEmails(candidates: CandidateJSON[]) {
  //   // sending emails
  //   for (let i = 0; i < candidates.length; i++) {
  //     const candidate = candidates[i];
  //     const { minioURL, filePath, fileName } =
  //       fileCandidateMapping[candidate.id];
  //     try {
  //       console.log(minioURL);
  //       await this.mailingService.sendEmail(
  //         candidate.email,
  //         'Thank you for applying to C4GT 2023!',
  //         fs.readFileSync('./templates/email.html', 'utf8'),
  //         {
  //           // data: data,
  //           path: `http://${process.env.MINIO_ENDPOINT}:${process.env.MINIO_PORT}/${process.env.MINIO_BUCKETNAME}/${fileName}`,
  //           filename: `${fileName}`,
  //         },
  //       );
  //     } catch (err) {
  //       console.log('err: ', err);
  //       Logger.error(`Error in sending email for ${candidate.name} ${err}`);
  //       failedEmails.push(candidate);
  //       // throw new InternalServerErrorException('Error sending email');
  //     }
  //   }
  //   return;
  // }

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

  public async verifyCredential(credentialDID: string) {
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

        console.log('data: ', data);
        const qr = await this.renderAsQR(data.id);
        const html = compileTemplate(
          {
            name: data.credentialSubject.name,
            qr: qr,
          },
          'verified.html',
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
}
