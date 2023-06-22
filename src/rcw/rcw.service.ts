import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import * as csvToJson from 'csvtojson';
import { CandidateJSON } from './rcw.interface';
import { AxiosResponse } from 'axios';
import * as fs from 'fs';
import { arrayBuffer } from 'stream/consumers';
// import * as base64 from 'base64topdf';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const base64 = require('base64topdf');
@Injectable()
export class RcwService {
  constructor(private readonly httpService: HttpService) {}

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
    const credentials = await this.generateCredential(
      candidatesWithDIDs,
      idxIdMap,
    );

    const data = await this.getCredentialPDF(
      credentials[0],
      process.env.PDF_TEMPLATE_ID,
    );
    console.log(data);
    new Blob([data], { type: 'application/pdf' });
    // const base64Str = Buffer.from(data).toString('base64');
    // base64.base64Decode(base64Str, 'test.pdf');
    return credentials;

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
        console.log('cred did: ', response.data.credential.id);
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

  async getCredentialPDF(credential: any, templateId: string) {
    // fetch the template
    const templateResponse: AxiosResponse = await this.httpService.axiosRef.get(
      `${process.env.SCHEMA_BASE_URL}/rendering-template/${templateId}`,
    );
    const template = templateResponse.data.template;
    // console.log('template: ', template);
    try {
      // const response: AxiosResponse = await this.httpService.axiosRef.post(
      //   `${process.env.CREDENTIAL_BASE_URL}/credentials/render`,
      //   {
      //     credential,
      //     template,
      //     //:'<html lang=\'en\'>   <head>     <meta charset=\'UTF-8\' />     <meta http-equiv=\'X-UA-Compatible\' content=\'IE=edge\' />     <meta name=\'viewport\' content=\'width=device-width, initial-scale=1.0\' />     <title>Certificate</title>   </head>   <body>   <div style="width:800px; height:600px; padding:20px; text-align:center; border: 10px solid #787878"> <div style="width:750px; height:550px; padding:20px; text-align:center; border: 5px solid #787878"> <span style="font-size:50px; font-weight:bold">Certificate of Completion</span> <br><br> <span style="font-size:25px"><i>This is to certify that</i></span> <br><br> <span style="font-size:30px"><b>{{name}}</b></span><br/><br/> <span style="font-size:25px"><i>has completed the course</i></span> <br/><br/> <span style="font-size:30px">{{programme}}</span> <br/><br/> <span style="font-size:20px">with score of <b>{{grade}}%</b></span> <br/><br/><br/><br/> <span style="font-size:25px"></span><br> <div> <img src={{qr}} > </div> </div>  </div>  </body></html>',
      //     output: 'STRING',
      //   },
      //   {
      //     headers: {
      //       'Content-Type': 'application/json',
      //       // Accept: 'application/pdf',
      //     },
      //   },
      // );

      const response = await this.httpService.axiosRef.post(
        `${process.env.CREDENTIAL_BASE_URL}/credentials/render`,
        {
          credential: {
            id: 'did:C4GT:3fd0f24d-c01a-4449-952e-6bfb51d63579',
            type: [
              'VerifiableCredential',
              'ProofOfSubmission',
              'Acknowledgement',
              'C4GT23',
            ],
            proof: {
              type: 'Ed25519Signature2020',
              created: '2023-06-22T10:42:36.927Z',
              proofValue:
                'eyJhbGciOiJFZERTQSJ9.IntcInZjXCI6e1wiQGNvbnRleHRcIjpbXCJodHRwczovL3d3dy53My5vcmcvMjAxOC9jcmVkZW50aWFscy92MVwiLFwiaHR0cHM6Ly93d3cudzMub3JnLzIwMTgvY3JlZGVudGlhbHMvZXhhbXBsZXMvdjFcIl0sXCJ0eXBlXCI6W1wiVmVyaWZpYWJsZUNyZWRlbnRpYWxcIixcIlByb29mT2ZTdWJtaXNzaW9uXCIsXCJBY2tub3dsZWRnZW1lbnRcIixcIkM0R1QyM1wiXSxcImNyZWRlbnRpYWxTdWJqZWN0XCI6e1wibmFtZVwiOlwieWFzaFwiLFwiZW1haWxcIjpcInlhc2gud2ZjMjAyMkBzYW1hZ3JhZ292ZXJuYW5jZS5pblwifX0sXCJvcHRpb25zXCI6e1wiY3JlYXRlZFwiOlwiMjAyMC0wNC0wMlQxODo0ODozNlpcIixcImNyZWRlbnRpYWxTdGF0dXNcIjp7XCJ0eXBlXCI6XCJSZXZvY2F0aW9uTGlzdDIwMjBTdGF0dXNcIn19LFwic3ViXCI6XCJkaWQ6QzRHVDpmY2IyYWY1NS1jZWVhLTRiYTgtOTIzYS03OTMyMGNjY2E0MjdcIixcImp0aVwiOlwiQzRHVFwiLFwibmJmXCI6MTY4NzQzMDU1NixcImV4cFwiOjQ4MjgyMDQ4MDAsXCJpc3NcIjpcImRpZDpDNEdUOjYzNmE2Zjg5LTljN2ItNDgxZC1hNWI4LTkzOWI2M2ZmODA2YVwifSI.1ugMHPdjv-a-J3ginunqjbDykolIRigB0aNQ34CvVb9oVz78FF2drV5MzZH_kBLig_jNK8PE8wj85ebIRmySCw',
              proofPurpose: 'assertionMethod',
              verificationMethod:
                'did:C4GT:636a6f89-9c7b-481d-a5b8-939b63ff806a',
            },
            issuer: 'did:C4GT:636a6f89-9c7b-481d-a5b8-939b63ff806a',
            '@context': [
              'https://www.w3.org/2018/credentials/v1',
              'https://www.w3.org/2018/credentials/examples/v1',
            ],
            issuanceDate: '2023-06-22T10:42:36.781Z',
            expirationDate: '2123-01-01T00:00:00.000Z',
            credentialSubject: {
              id: 'did:C4GT:fcb2af55-ceea-4ba8-923a-79320ccca427',
              name: 'yash',
              email: 'yash.wfc2022@samagragovernance.in',
            },
          },
          template:
            '<html lang=\'en\'>   <head>     <meta charset=\'UTF-8\' />     <meta http-equiv=\'X-UA-Compatible\' content=\'IE=edge\' />     <meta name=\'viewport\' content=\'width=device-width, initial-scale=1.0\' />     <title>Certificate</title>   </head>   <body>   <div style="width:800px; height:600px; padding:20px; text-align:center; border: 10px solid #787878"> <div style="width:750px; height:550px; padding:20px; text-align:center; border: 5px solid #787878"> <span style="font-size:50px; font-weight:bold">Certificate of Completion</span> <br><br> <span style="font-size:25px"><i>This is to certify that</i></span> <br><br> <span style="font-size:30px"><b>{{name}}</b></span><br/><br/> <span style="font-size:25px"><i>has completed the course</i></span> <br/><br/> <span style="font-size:30px">{{programme}}</span> <br/><br/> <span style="font-size:20px">with score of <b>{{grade}}%</b></span> <br/><br/><br/><br/> <span style="font-size:25px"></span><br> <div> <img src={{qr}} > </div> </div>  </div>  </body></html>',
          output: 'PDF',
        },
        {
          responseType: 'arraybuffer',
        },
      );

      // console.log('response', response);

      return response.data; // as any).arrayBuffer();
    } catch (err) {
      console.log(err);
      Logger.error(`Error in generating PDF`, err.message);
    }
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
