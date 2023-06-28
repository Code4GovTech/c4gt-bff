import { HttpService } from '@nestjs/axios';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { RcwService } from 'src/rcw/rcw.service';
import * as fs from 'fs';

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
      person.token = jwt.sign({ ...person, ts }, process.env.SECRET);
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
}
