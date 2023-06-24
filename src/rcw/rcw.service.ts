import { HttpService } from '@nestjs/axios';
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import * as csvToJson from 'csvtojson';
import { CandidateJSON } from './rcw.interface';
import { AxiosResponse } from 'axios';
import * as wkhtmltopdf from 'wkhtmltopdf';
// import * as fs from 'fs';
import { arrayBuffer } from 'stream/consumers';
import { Blob } from 'buffer';
import { MailerService } from '@nestjs-modules/mailer';
import { MailingService } from 'src/mailing/mailing.service';
import { Client } from 'minio';
import Handlebars from 'handlebars';
// import { Blob } from 'buffer';
// import * as base64 from 'base64topdf';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const base64 = require('base64topdf');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { promisify } = require('util');
import * as fs from 'fs';
import * as handlebars from 'handlebars';
import { createPDF } from './genpdf';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const QRCode = require('qrcode');

const emailText = `<p>Dear Participant,</p><br>
<p>We hope you are well. We really appreciate the efforts that you put in to make your submission. We know how much hard work and dedication it takes to create something cool and impactful. Please find a participation certificate attached as a token of appreciation.</p><br>
<p>Sadly, we couldn’t shortlist your submission for the next round of the competition, but don’t worry, we have some great news for you.</p> <br>
<p>We are super excited to tell you that we are launching the C4GT Community Program bringing all highly skilled coders like you under one roof.</p><br>
<p><b><i>What is the C4GT Community Program?</i></b></p>
<p>Through the C4GT Community Program you can contribute to multiple projects, build your skills & get exclusive rewards & goodies.</p>
<p><b><i>How will the Community Program work?</i></b></p>
<p><b>Explore Projects</b>  - Explore projects as per your skills, interest in the domain & more.</p>
<p><b>Get Coding</b> - Interact with mentors for clarity if required & solve the project</p>
<p><b>Points & Rewards</b> - On each PR merged, you will get points. These points will give you badges & C4GT goodies. Read more about the point system </p>
<p><b><i>How can you participate?</i></b></p>
<p><b>Explore Issues Listed</b>  - Keep an eye on our project page as more issues will be released every week.</p>
<p><b>Ask questions & engage with mentors</b> - Ask away your queries on the #c4gtcommunitychannel </p>
<p>For more details on the Community Program please refer the following links: </p>
<a href="https://github.com/Code4GovTech/C4GT/wiki/C4GT-Community-Program">GitHub Wiki</a><br>
<a href="https://www.codeforgovtech.in/community-projects">C4GT Community Projects List</a><br>
<p>The C4GT community program gives you a chance to be part of an ecosystem of Digital Public Goods (DPGs) where you can work with awesome DPG organizations and support them with their engineering, product and design challenges while connecting with a lively community of contributors.</p><br>
<p>You can join this community by hopping on our discord server by clicking on the following link:</p><br>
http://bit.ly/-C4GT<br>
<p>To read more about the Community Program explore: </p> <br>
<p>C4GT Community Program GitHub Wiki - https://bit.ly/C4GTCommunityProgramGitHub </p> <br>
<p>Community Program Projects - https://www.codeforgovtech.in/community-projects </p> <br>
<p><i>What is in it for you? </i></p><br>
<p>This is an awesome chance for you to connect with other like-minded people, learn new skills and best of all <b>WIN BIG!!! Stand a chance to win exciting goodies bragging rights and community privileges on each PR that gets merged/reviewed!</b></p><br>
<p>We hope that you will grab this opportunity and join us in building a fun and diverse community of changemakers. We can’t wait to see you join us! We wish you all the best for your future projects.</p><br><br>
<p>Cheers</p>
<p>The C4GT 2023 Team</p>
`;
@Injectable()
export class RcwService {
  private writeFileAsync;
  private wkhtmltopdfAsync;
  constructor(
    private readonly httpService: HttpService,
    private readonly mailerService: MailerService,
    private readonly mailingService: MailingService,
  ) {
    this.writeFileAsync = promisify(fs.writeFile);
    this.wkhtmltopdfAsync = promisify(wkhtmltopdf);
  }

  async processCSV(csvPath: string): Promise<CandidateJSON[]> {
    const csvFilePath = csvPath;
    const jsonArray = await csvToJson().fromFile(csvFilePath);
    const idxIdMap = {};
    jsonArray.forEach((candidate: CandidateJSON, idx: number) => {
      idxIdMap[candidate.email] = idx;
    });
    let candidatesWithDIDs, candidatesWithCredentials;
    try {
      candidatesWithDIDs = await this.generateDIDs(
        jsonArray as CandidateJSON[],
        idxIdMap,
      );
    } catch (err) {
      Logger.error('Error in generating DIDs', err);
      throw new InternalServerErrorException(err);
    }

    try {
      candidatesWithCredentials = await this.generateCredential(
        candidatesWithDIDs,
        idxIdMap,
      );
    } catch (err) {
      Logger.error('Error in generating credentials', err);
      throw new InternalServerErrorException(err);
    }

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

  private async generatePDF(data, candidate, filePath) {
    try {
      const pdfBuffer = await this.wkhtmltopdfAsync(data, {
        pageSize: 'A4',
        disableExternalLinks: true,
        disableInternalLinks: true,
        disableJavascript: true,
        encoding: 'UTF-8',
      });

      await this.writeFileAsync(filePath, pdfBuffer);

      console.log('PDF generated successfully.');
    } catch (error) {
      console.error('Error generating PDF:', error);
    }
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
          template: fs.readFileSync('./templates/final.html', 'utf8'),
          // template: `<!DOCTYPEhtml><html><head><style>body{margin:0;padding:0;}.certificate-container{position:relative;color:#041336;height:100vh;background-image:url('http://139.59.20.91:9000/templates/handlebar_certi/border2.png');background-repeat:no-repeat;background-size:800px500px;background-position:center;font-family:'TimesNewRoman',Times,serif;display:flex;flex-direction:column;justify-content:space-between;}.certificate-content{position:relative;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center;height:460px;width:770px;display:flex;flex-direction:column;}.heading{display:flex;justify-content:space-around;align-items:center;}.main-text{margin-left:175px;}.main-heading,.main-para{width:350px;margin:0;text-align:center;}.main-heading{border-bottom:1pxsolidblack;}.main-para{margin-top:5px;}.certificate-logo{margin-left:30px;width:150px;height:160px;}.certificate-logoimg{width:100%;height:100%;object-fit:cover;}.certificate-contentp{font-size:18px;}.certificate-images{margin-top:30px;display:flex;align-items:flex-end;justify-content:space-between;width:100%;}.certificate-imagesimg{margin:020px;}.qr-img{border:1pxsolidblack;border-radius:5px;text-align:center;line-height:120px;width:120px;height:120px;}.footer-images{bottom:0;right:0;display:flex;border-radius:15px;-webkit-box-shadow:-2px-4px3px0pxrgba(0,0,0,0.25);-moz-box-shadow:-2px-4px3px0pxrgba(0,0,0,0.25);box-shadow:-2px-4px3px0pxrgba(0,0,0,0.25);}.footer-imagesp{font-size:12px;}.footer-imagesimg{height:35px;width:60px;}.bottom-text{position:relative;background-color:#041336;color:white;text-align:center;padding:10px0px;width:800px;margin:auto;}</style></head><body><divclass=\"certificate-container\"><divclass=\"certificate-content\"><divclass=\"heading\"><divclass=\"main-text\"><h1class=\"main-heading\">CERTIFICATEOFPARTICIPATION</h1><pclass=\"main-para\">Thisistocertifythat</p></div><divclass=\"certificate-logo\"><imgsrc=\"http://139.59.20.91:9000/templates/handlebar_certi/C4GT.png\"alt=\"C4GTLogo\"/></div></div><h1style=\"color:#e73754;margin:035px25px0\">{{name}}{{id}}</h1><div><pstyle=\"margin:0;margin-right:35px\">successfullysubmittedaproposalforthe</p><br/><pstyle=\"margin:0;margin-right:35px\">CodeForGovTechMentoringProgram2023.</p></div><div class=\"certificate-images\"><imgclass=\"qr-img\"src=\"{{qr}}\"alt=\"QRCode\"/><divclass=\"footer-images\"style=\"background-color:white\"><div><p>KnowledgePartners</p><div><imgsrc=\"http://139.59.20.91:9000/templates/handlebar_certi/DPGA.svg\"alt=\"DPGA\"/><imgsrc=\"http://139.59.20.91:9000/templates/handlebar_certi/OMI.png\"alt=\"OMI\"/></div></div><div><p>CommunityPartner</p><imgsrc=\"http://139.59.20.91:9000/templates/handlebar_certi/GitHub.png\"alt=\"Github\"/></div><div><p>Organizer</p><imgsrc=\"http://139.59.20.91:9000/templates/handlebar_certi/Samagrax.png\"alt=\"SamagraX\"/></div></div></div></div><divclass=\"bottom-text\">IssuedbytheC4GTOrganisingTeam</div></div></body></html>`,
          // template:
          //   '<html lang=\'en\'>   <head>     <meta charset=\'UTF-8\' />     <meta http-equiv=\'X-UA-Compatible\' content=\'IE=edge\' />     <meta name=\'viewport\' content=\'width=device-width, initial-scale=1.0\' />     <title>Certificate</title>   </head>   <body>   <div style="width:800px; height:600px; padding:20px; text-align:center; border: 10px solid #787878"> <div style="width:750px; height:550px; padding:20px; text-align:center; border: 5px solid #787878"> <span style="font-size:50px; font-weight:bold">Certificate of Completion</span> <br><br> <span style="font-size:25px"><i>This is to certify that</i></span> <br><br> <span style="font-size:30px"><b>{{name}}</b></span><br/><br/> <span style="font-size:25px"><i>has completed the course</i></span> <br/><br/> <span style="font-size:30px">{{programme}}</span> <br/><br/> <span style="font-size:20px">with score of <b>{{grade}}%</b></span> <br/><br/><br/><br/> <span style="font-size:25px"></span><br> <div> <img src={{qr}} > </div> </div>  </div>  </body></html>',
          // template: template,
          output: 'HTML',
        },
      );

      console.log(response.data);
      return response.data; // as any).arrayBuffer();
    } catch (err) {
      console.log(err);
      Logger.error(`Error in generating PDF`, err.message);
    }
  }

  async renderAsQR(cred) {
    try {
      const verificationURL = `${process.env.FRONTEND_BASE_UR}/verify/${cred.id}`;
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
          // pageSize: 'A3',
          // height: 550,
          // width: 850,
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
      // setTimeout(async () => {
      /*console.time('uploadToMinio');
      try {
        await this.uploadToMinio(`${fileName}`, `${filePath}`);
        fileCandidateMapping[candidate.id] = { minioURL, filePath, fileName };
      } catch (err) {
        console.error('error uploading to minio: ', err);
        failedUploads.push(candidate);
        // throw new InternalServerErrorException('Error uploading to minio');
      }
      console.timeEnd('uploadToMinio');*/
      // }, 100);
    }
    /*
    // sending emails
    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i];
      const { minioURL, filePath, fileName } =
        fileCandidateMapping[candidate.id];
      try {
        console.log(minioURL);
        await this.mailingService.sendEmail(
          candidate.email,
          'Thanks for applying to C4GT 2023!',
          emailText,
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
  }*/

    // console.log('candidates.length: ', candidates.length);
    // console.log('candidates: ', candidates);

    // candidates.forEach(async (candidate: CandidateJSON) => {
    //   const data = null;

    // try {
    //   data = await this.getCredentialPDFData(
    //     candidate.credential,
    //     process.env.PDF_TEMPLATE_ID,
    //   );
    // } catch (err) {
    //   console.error('Error getting PDF data: ', err);
    //   throw new InternalServerErrorException('Error generating PDF data');
    // }

    //   // const failedPDFCreations = [];
    //   // const failedEmails = [];
    //   // const failedUploads = [];
    //   // try {
    //   //   console.log('data: ', data);
    //   //   // await this.generatePDF(data, candidate, filePath);

    // //   //   await new Promise((resolve, reject) => {
    //       // wkhtmltopdf(data, {
    //       //   pageSize: 'A4',
    //       //   disableExternalLinks: true,
    //       //   disableInternalLinks: true,
    //       //   disableJavascript: true,
    //       //   encoding: 'UTF-8',
    //       // }).pipe(fs.createWriteStream(`${ filePath }`));
    //       resolve(1);
    //       // console.log('file: ', file);
    //     });
    //   // } catch (err) {
    //   //   console.error('Error generating PDF: ', err);
    //   //   failedPDFCreations.push(err);
    //   //   // throw new InternalServerErrorException('Error creating PDF');
    //   // }

    //   // // upload to minio
    //   // // setTimeout(async () => {
    //   // try {
    //   //   await this.uploadToMinio(`${ fileName }`, `${ filePath }`);
    //   // } catch (err) {
    //   //   console.error('error uploading to minio: ', err);
    //   //   failedUploads.push(err);
    //   //   // throw new InternalServerErrorException('Error uploading to minio');
    //   // }
    //   // // }, 200);
    //   // try {
    //   //   await this.mailingService.sendEmail(
    //   //     candidate.email,
    //   //     'C4GT Submission Acknowledgement',
    //   //     'Hello',
    //   //     {
    //   //       data: data,
    //   //       path: `http://${process.env.MINIO_ENDPOINT}:${process.env.MINIO_PORT}/${process.env.MINIO_BUCKETNAME}/${fileName}`,
    //   //       filename: `${fileName}`,
    //   //     },
    //   //   );
    //   // } catch (err) {
    //   //   console.log('err: ', err);
    //   //   Logger.error(`Error in generating PDF for ${candidate.name} ${err}`);
    //   //   failedEmails.push(err);
    //   //   // throw new InternalServerErrorException('Error sending email');
    //   // }

    //   // Logger.log('failed pdfs: ', failedPDFCreations.length);
    //   // Logger.log('failed emails: ', failedEmails.length);
    //   // Logger.log('failed uploads: ', failedUploads.length);
    // });
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
