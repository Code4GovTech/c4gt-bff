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

  constructor(
    private readonly configService: ConfigService, 
    private readonly httpService: HttpService
  ) {
    this.config = this.configService.get<RCWIdentityConfig>('identityService');
  }

  async generateIdentity() {
    try {
      const configPath = path.resolve(__dirname, '../config.json');
      const requestBody = JSON.parse(fs.readFileSync(configPath, 'utf8'));

      const generateUrl = `${this.config.baseUrl}/did/generate`;

      const response = await this.httpService.axiosRef.post(generateUrl, requestBody, {
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
