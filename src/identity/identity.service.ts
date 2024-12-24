import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

interface RCWIdentityConfig {
  baseUrl: string;
}

@Injectable()
export class IdentityService {
  private readonly config;
  private didPayload;

  constructor(
    private readonly configService: ConfigService, 
    private readonly httpService: HttpService
  ) {
    this.config = this.configService.get<RCWIdentityConfig>('identityService');
    this.didPayload = {
        "content": [
          {
            "alsoKnownAs": [
              "C4GT",
              "https://www.codeforgovtech.in/"
            ],
            "services": [
              {
                "id": "C4GT",
                "type": "IdentityHub",
                "serviceEndpoint": {
                  "@context": "schema.c4gt.acknowledgment",
                  "@type": "UserServiceEndpoint",
                  "instance": [
                    "https://www.codeforgovtech.in"
                  ]
                }
              }
            ],
            "method": "C4GT"
          }
        ]
      }
  }

  async generateIdentity() {
    try {
      const generateUrl = `${this.config.baseUrl}/did/generate`;

      const response = await this.httpService.axiosRef.post(generateUrl, this.didPayload, {
        headers: { 'Content-Type': 'application/json' },
      });
      return response.data;
    } catch (error) {
      console.error('Error generating identity:', error.message);
      throw error.response?.data || error.message;
    }
  }

  async resolveIdentity(did: string) {
    try {
      const url = `${this.config.baseUrl}/did/resolve/${did}`;
      const response = await this.httpService.axiosRef.get(url, {
        headers: { 'Content-Type': 'application/json' },
      });
      return response.data;
    } catch (error) {
      console.error('Error resolving identity:', error.message);
      throw error.response?.data || error.message;
    }
  }
}
