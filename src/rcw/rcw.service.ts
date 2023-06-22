import { HttpService } from '@nestjs/axios';
import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import * as csvToJson from 'csvtojson';
import { CandidateJSON } from './rcw.interface';
import { AxiosResponse } from 'axios';
import * as wkhtmltopdf from 'wkhtmltopdf';
import * as fs from 'fs';
import { arrayBuffer } from 'stream/consumers';
import { Blob } from 'buffer';
import { MailerService } from '@nestjs-modules/mailer';
import { MailingService } from 'src/mailing/mailing.service';
// import { Blob } from 'buffer';
// import * as base64 from 'base64topdf';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const base64 = require('base64topdf');
@Injectable()
export class RcwService {
  constructor(
    private readonly httpService: HttpService,
    private readonly mailerService: MailerService,
    private readonly mailingService: MailingService,
  ) {}

  async processCSV(csvPath: string): Promise<CandidateJSON[]> {
    const csvFilePath = csvPath;
    const jsonArray = await csvToJson().fromFile(csvFilePath);
    const idxIdMap = {};
    jsonArray.forEach((candidate: CandidateJSON, idx: number) => {
      idxIdMap[candidate.email] = idx;
    });
    const candidatesWithDIDs = await this.generateDIDs(
      jsonArray as CandidateJSON[],
      idxIdMap,
    );
    const candidatesWithCredentials = await this.generateCredential(
      candidatesWithDIDs,
      idxIdMap,
    );

    await this.generatePDFs(candidatesWithCredentials);
    return candidatesWithCredentials;

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
        const did = response.data[0].id;
        candidates[idxIdMap[response.data[0].alsoKnownAs[0]]].did = did;
        idxIdMap[did] = idxIdMap[response.data[0].alsoKnownAs[0]];
      } catch (err) {
        Logger.error(`Error in mapping did of user`);
      }
    });

    return candidates;
  }

  async generateCredential(
    candidates: CandidateJSON[],
    idxIdMap: { [k: string]: number },
  ) {
    const responses = await Promise.all(
      candidates.map((candidate: CandidateJSON, idx: number) => {
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
              issuer: process.env.C4GT_DID,
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
    const templateResponse: AxiosResponse = await this.httpService.axiosRef.get(
      `${process.env.SCHEMA_BASE_URL}/rendering-template/${templateId}`,
    );
    const template = templateResponse.data.template;
    // console.log('template: ', template);
    try {
      const response = await this.httpService.axiosRef.post(
        `${process.env.CREDENTIAL_BASE_URL}/credentials/render`,
        {
          credential: credential,
          // template:
          // '<html lang=\'en\'>   <head>     <meta charset=\'UTF-8\' />     <meta http-equiv=\'X-UA-Compatible\' content=\'IE=edge\' />     <meta name=\'viewport\' content=\'width=device-width, initial-scale=1.0\' />     <title>Certificate</title>   </head>   <body>   <div style="width:800px; height:600px; padding:20px; text-align:center; border: 10px solid #787878"> <div style="width:750px; height:550px; padding:20px; text-align:center; border: 5px solid #787878"> <span style="font-size:50px; font-weight:bold">Certificate of Completion</span> <br><br> <span style="font-size:25px"><i>This is to certify that</i></span> <br><br> <span style="font-size:30px"><b>{{name}}</b></span><br/><br/> <span style="font-size:25px"><i>has completed the course</i></span> <br/><br/> <span style="font-size:30px">{{programme}}</span> <br/><br/> <span style="font-size:20px">with score of <b>{{grade}}%</b></span> <br/><br/><br/><br/> <span style="font-size:25px"></span><br> <div> <img src={{qr}} > </div> </div>  </div>  </body></html>',
          template: template,
          output: 'HTML',
        },
        {
          responseType: 'arraybuffer',
        },
      );

      console.log(response.data);
      return response.data; // as any).arrayBuffer();
    } catch (err) {
      console.log(err);
      Logger.error(`Error in generating PDF`, err.message);
    }
  }

  async generatePDFs(candidates: CandidateJSON[]) {
    candidates.forEach(async (candidate: CandidateJSON) => {
      try {
        const data = await this.getCredentialPDFData(
          candidate.credential,
          process.env.PDF_TEMPLATE_ID,
        );
        console.log('data: ', data);
        const file = wkhtmltopdf(data, {
          pageSize: 'A4',
          disableExternalLinks: true,
          disableInternalLinks: true,
          disableJavascript: true,
          encoding: 'UTF-8',
        }).pipe(
          fs.createWriteStream(`./pdfs/${candidate.id}-${candidate.name}.pdf`),
        );
        console.log('file: ', file);

        await this.mailingService.sendEmail(
          candidate.email,
          'C4GT Submission Acknowledgement',
          'Hello',
          {
            data: data,
            path: `./pdfs/${candidate.id}-${candidate.name}.pdf`,
            filename: `${candidate.id}-${candidate.name}.pdf`,
          },
        );
      } catch (err) {
        console.log('err: ', err);
        Logger.error(`Error in generating PDF for ${candidate.name} ${err}`);
        throw new InternalServerErrorException('Error in generating PDF');
      }
    });
  }

  async sendEmails(candidates: CandidateJSON[]) {
    // await Promise.all(
    //   candidates.map(
    //     (candidate: CandidateJSON) => {
    //       return this.
    //     }
    // );
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
