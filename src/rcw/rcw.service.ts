import { HttpService } from '@nestjs/axios';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { AxiosResponse } from 'axios';
import { compileHBS } from './genpdf';

@Injectable()
export class RcwService {
  constructor(private readonly httpService: HttpService) {}
  public async verifyCredential(credentialDID: string, verifiedTemplateFile: string) {
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
        console.log('VERIFICATION DATA', data);

        const schemaResp = await this.httpService.axiosRef.get(
          `${process.env.CREDENTIAL_BASE_URL}/credentials/schema/${data.id}`,
        );

        const schemaId = schemaResp.data.credential_schema;

        console.log('SchemaID ', schemaId);

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
          template ?? verifiedTemplateFile,
        );
        return html;
      } else {
        return 'Invalid credential';
      }
    } catch (err) {
      console.log('err: ', err);
      throw new InternalServerErrorException(err);
    }
  }
}
