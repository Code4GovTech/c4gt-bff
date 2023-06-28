import { HttpService } from '@nestjs/axios';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { RcwService } from 'src/rcw/rcw.service';
@Injectable()
export class InaugurationService {
  constructor(private readonly httpService: HttpService,
    private readonly rcwService: RcwService) {}
  generateTokens(people: any[]) {
    const tokens = {};
    people.forEach((person) => {
      tokens[person.id] = jwt.sign({ ...person }, process.env.SECRET);
    });

    return tokens;
  }

  verifyToken(token: string) {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded) {
      throw new InternalServerErrorException('Invalid token');
    }

    // Add logic to generate the credential here (Ask chakshu how this credential looks!!)
  }
}
