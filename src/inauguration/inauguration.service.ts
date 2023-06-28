import { HttpService } from '@nestjs/axios';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { RcwService } from 'src/rcw/rcw.service';
@Injectable()
export class InaugurationService {
  constructor(
    private readonly httpService: HttpService,
    private readonly rcwService: RcwService,
  ) {}
  async generateTokens(people: any[]) {
    const tokens = {};
    const idxIdMap = {};
    people.forEach((person, idx: number) => {
      tokens[person.id] = jwt.sign({ ...person }, process.env.SECRET);
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

    return creds;
  }

  verifyToken(token: string) {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded) {
      throw new InternalServerErrorException('Invalid token');
    }

    // Add logic to generate the credential here (Ask chakshu how this credential looks!!)
  }
}
