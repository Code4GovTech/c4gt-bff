import { Injectable, Logger } from '@nestjs/common';
import { CreateSchemaDTO } from './schema.dto';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { AxiosResponse } from 'axios';
import { Schema, PrismaClient } from '@prisma/client';
import { RCWSchemaServiceConfig } from './schema.interface';

@Injectable()
export class SchemaService {
  private rcwSchemaServiceConfig;
  private readonly logger = new Logger(SchemaService.name);
  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly prisma: PrismaClient,
  ) {
    this.rcwSchemaServiceConfig = this.configService.get<RCWSchemaServiceConfig>('schemaService');
  }
  async getCredentialSchema(id: string): Promise<Schema[] | Schema | AxiosResponse> {
    try {
      if (!id) {
        this.logger.debug('Fetching all schemas from the database');
        const schemas = await this.prisma.schema.findMany();
        this.logger.debug('Fetched all schemas successfully', { count: schemas.length });
        return schemas;
      }
  
      this.logger.debug('Fetching schema from RCW Schema Service', { id });
  
      const getSchemaResponse: AxiosResponse = await this.httpService.axiosRef.get(
        `${this.rcwSchemaServiceConfig.baseUrl}/credential-schema/${id}`,
      );
  
      this.logger.debug('Fetched schema from RCW Schema Service successfully', {
        responseData: getSchemaResponse.data,
      });
  
      return getSchemaResponse.data;
    } catch (error) {
      if (!id) {
        this.logger.error('Error occurred while fetching schemas from the database', {
          error: error.message,
        });
        throw new Error('Failed to fetch schemas from the database');
      } else {
        this.logger.error('Error occurred while fetching schema from RCW Schema Service', {
          id,
          error: error.message,
        });
        throw new Error(`Failed to fetch schema with ID: ${id} from RCW Schema Service`);
      }
    }
  }
  

  async createCredentialSchema(createSchemaPayload: CreateSchemaDTO) {
    const payload = {
      schema: {
        '@context': [
          'https://www.w3.org/2018/credentials/v1',
          'https://www.w3.org/2018/credentials/examples/v1',
          'https://playground.chapi.io/examples/alumni/alumni-v1.json',
          'https://w3id.org/security/suites/ed25519-2020/v1',
        ],
        type: 'https://w3c-ccg.github.io/vc-json-schemas/',
        version: '1.0',
        id: '',
        name: createSchemaPayload.name,
        author: process.env.C4GT_DID, // Hardcoded to C4GT DID
        authored: new Date().toISOString(),
        schema: {
          $id: createSchemaPayload.name,
          $schema: 'https://json-createSchemaPayload.org/draft/2019-09/schema',
          description: createSchemaPayload.description,
          type: 'object',
          properties: {
            ...createSchemaPayload.properties,
          },
          required: createSchemaPayload.required,
          additionalProperties: false,
        },
        proof: {},
      },
      tags: createSchemaPayload.tags,
      status: 'PUBLISHED',
    };
  
    let createSchemaResponse: AxiosResponse;
  
    try {
      this.logger.debug('Sending request to RCW Schema Service', {
        baseUrl: this.rcwSchemaServiceConfig.baseUrl,
        payload,
      });
  
      createSchemaResponse = await this.httpService.axiosRef.post(
        `${this.rcwSchemaServiceConfig.baseUrl}/credential-schema`,
        payload,
      );
  
      this.logger.debug('Received response from RCW Schema Service', {
        responseData: createSchemaResponse.data,
      });
    } catch (error) {
      this.logger.error('Error occurred while creating schema with RCW service', { error: error.message });
      throw new Error('Failed to create schema with RCW service');
    }
  
    try {
      this.logger.debug('Saving schema to the database', {
        schemaData: createSchemaResponse.data.schema,
        tags: createSchemaResponse.data.tags,
      });
  
      await this.prisma.schema.create({
        data: {
          id: createSchemaResponse.data.schema.id,
          name: createSchemaResponse.data.schema.name,
          description: createSchemaResponse.data.schema.schema?.description ?? '',
          tags: createSchemaResponse.data.tags ?? [],
        },
      });
  
      this.logger.debug('Schema saved successfully to the database');
    } catch (error) {
      this.logger.error('Error occurred while saving schema to the database', { error: error.message });
      throw new Error('Failed to save schema to the database');
    }
  
    return createSchemaResponse.data;
  }
  

  editCredentialSchema() {
    return;
  }
}
