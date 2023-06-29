import { HttpService } from '@nestjs/axios';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { RcwService } from 'src/rcw/rcw.service';
import * as fs from 'fs';
import { AxiosResponse } from 'axios';
import { compileTemplate } from 'src/rcw/genpdf';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const QRCode = require('qrcode');

@Injectable()
export class InaugurationService {
  constructor(
    private readonly httpService: HttpService,
    private readonly rcwService: RcwService,
  ) {}
  async generateTokens(people: any[]) {
    // const tokens = {};
    const idxIdMap = {};
    const ts = Date.now();
    people.forEach((person, idx: number) => {
      person.ts = ts;
      person.token = jwt.sign({ ...person, ts }, process.env.SECRET, {
        expiresIn: '24h',
      });
      idxIdMap[person.email] = idx;
    });

    //generate DIDs
    const dids = await this.rcwService.generateDIDs(people, idxIdMap);
    const creds = await this.rcwService.generateCredential(
      dids,
      idxIdMap,
      process.env.INAUG_CRED_SCHEMA_ID,
      [
        'VerifiableCredential',
        'Acknowledgement',
        'C4GT23',
        'InauguralApproval',
      ],
      ['Acknowledgement', 'InauguralApproval', 'C4GT23'],
    );

    const objToWrite = {
      creds: {},
      done: [],
      length: people.length,
    };

    creds.forEach((cred) => {
      objToWrite.creds[cred.email] = cred;
    });

    fs.writeFileSync(`inaug/${ts}.json`, JSON.stringify(objToWrite, null, 2));
    return creds;
  }

  verifyToken(token: string) {
    const decoded = jwt.verify(token, process.env.SECRET);
    if (!decoded) {
      throw new InternalServerErrorException('Invalid token');
    }

    // update the done thing
    const data = JSON.parse(
      fs.readFileSync(`inaug/${(decoded as any).ts}.json`, 'utf-8'),
    );

    const done = data.done;
    let isPresent = false;
    done.forEach((person) => {
      if (person.email === (decoded as any).email) {
        isPresent = true;
      }
    });

    if (!isPresent) done.push(data.creds[(decoded as any).email]);

    // rewrite to file
    fs.writeFileSync(
      `./inaug/${(decoded as any).ts}.json`,
      JSON.stringify(data, null, 2),
    );

    return data.creds[(decoded as any).email];
  }

  getProgress(token: string) {
    const decoded = jwt.verify(token, process.env.SECRET);
    if (!decoded) {
      throw new InternalServerErrorException('Invalid token');
    }
    const ts = (decoded as any).ts;
    const data = JSON.parse(fs.readFileSync(`inaug/${ts}.json`, 'utf-8'));
    return { done: data.done, length: data.length };
  }

  async verifyCredential(did: string) {
    return await this.rcwService.verifyCredential(did, 'inaug_verified.html');
  }

  async genCert(candidate: any) {
    const decoded = jwt.verify(candidate.token, process.env.SECRET);
    const data = JSON.parse(
      fs.readFileSync(`inaug/${(decoded as any).ts}.json`, 'utf-8'),
    );
    if (data.done.length !== data.length) {
      return null;
    }

    const type = [
      'VerifiableCredential',
      'Acknowledgement',
      'C4GT23',
      'ProofOfSubmission',
    ];
    const tags = ['Acknowledgement', 'ProofOfSubmission', 'C4GT23'];
    let resp: AxiosResponse;
    try {
      const didResp: AxiosResponse = await this.httpService.axiosRef.post(
        `${process.env.IDENTITY_BASE_URL}/did/generate`,
        {
          content: [
            {
              alsoKnownAs: ['LaunchApprovers'],
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
      const did = didResp.data[0].id;
      console.log('didResp.data: ', didResp.data[0].id);
      resp = await this.httpService.axiosRef.post(
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
              id: did,
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
          credentialSchemaId: process.env.INAUGURATION_CRED_SCHEMA_ID,
          tags,
        },
      );
    } catch (err) {
      console.log('err: ', err);
      throw new InternalServerErrorException('Error generating credential');
    }
    const cred = resp.data;
    const verificationURL = `${process.env.FRONTEND_BASE_URL}/inauguration/view/${cred.credential.id}`;
    return verificationURL;
    // try {
    //   const verificationURL = `${process.env.FRONTEND_BASE_URL}/inauguration/verify/${cred.credential.id}`;
    //   const QRData = await QRCode.toDataURL(verificationURL);
    //   const html = compileTemplate(
    //     {
    //       name: cred.credential.credentialSubject.name,
    //       qr: QRData,
    //     },
    //     'inaug.html',
    //   );
    //   return html;
    // } catch (err) {
    //   console.log('err: ', err);
    //   throw new InternalServerErrorException('Error generating QR');
    // }
  }

  async viewCert(id: string) {
    let cred: any;
    try {
      const resp: AxiosResponse = await this.httpService.axiosRef.get(
        `${process.env.CREDENTIAL_BASE_URL}/credentials/${id}`,
      );
      cred = resp.data;
    } catch (err) {
      console.log('err: ', err);
      throw new InternalServerErrorException('Error fetching credential');
    }

    try {
      const verificationURL = `${process.env.FRONTEND_BASE_URL}/inauguration/verify/${cred.id}`;
      const QRData = await QRCode.toDataURL(verificationURL);
      const html = compileTemplate(
        {
          name: cred.credentialSubject.name,
          qr: QRData,
        },
        'inaug.html',
      );
      return html;
    } catch (err) {
      console.log('err: ', err);
      throw new InternalServerErrorException('Error generating QR');
    }
  }

  resetDone(token: string) {
    const decoded = jwt.verify(token, process.env.SECRET);
    if (!decoded) {
      throw new InternalServerErrorException('Invalid token');
    }
    const ts = (decoded as any).ts;
    const data = JSON.parse(fs.readFileSync(`inaug/${ts}.json`, 'utf-8'));
    data.done = [];
    fs.writeFileSync(
      `./inaug/${(decoded as any).ts}.json`,
      JSON.stringify(data, null, 2),
    );
    return { done: data.done, length: data.length };
  }
}
