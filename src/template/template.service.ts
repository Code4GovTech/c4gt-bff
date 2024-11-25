import { Injectable, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { HttpService } from '@nestjs/axios';
import { RCWSchemaServiceConfig } from 'src/schema/schema.interface';
import { ConfigService } from '@nestjs/config';
import { CreateTemplateDTO, SetVerificationTemplateDTO } from './template.dto';
import { template } from 'handlebars';

@Injectable()
export class TemplateService {
  private rcwSchemaServiceConfig;
  private readonly logger = new Logger(TemplateService.name);
  constructor(
    private readonly prisma: PrismaClient,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.rcwSchemaServiceConfig = this.configService.get<RCWSchemaServiceConfig>('schemaService');
  }

  async getTemplates(id?: string, schemaId?: string) {
    if (id && schemaId) {
      // Logic for when both ID and schemaId are provided
    } else if (id) {
      return this.getTemplateByTemplateId(id);
    } else if (schemaId) {
      return this.getTemplatesBySchemaId(schemaId);
    } else {
      return this.prisma.template.findMany();
    }
  }

  async getTemplateByTemplateId(templateId: string) {
    const res = await this.httpService.axiosRef.get(
      `${this.rcwSchemaServiceConfig.baseUrl}/template/${templateId}`,
    );
    return res.data;
  }

  private async getTemplatesBySchemaId(schemaId: string) {
    const res = await this.httpService.axiosRef.get(
      `${this.rcwSchemaServiceConfig.baseUrl}/template?schemaId=${schemaId}`,
    );
    return res.data;
  }

  async createTemplate(createCredentialRenderingTemplatePayload: CreateTemplateDTO) {
    try {
      const payload = {
        schemaId: createCredentialRenderingTemplatePayload.schemaId,
        template: createCredentialRenderingTemplatePayload.template,
        type: createCredentialRenderingTemplatePayload.type,
      };

      this.logger.debug(`Payload for rendering template creation: ${JSON.stringify(payload)}`);

      const renderingTemplateCreationResponse = await this.httpService.axiosRef.post(
        `${this.rcwSchemaServiceConfig.baseUrl}/template`,
        payload,
      );

      this.logger.debug(
        `Rendering template created successfully with ID: ${renderingTemplateCreationResponse.data.templateId}`,
      );

      const renderingTemplateRegistration = await this.prisma.template.create({
        data: {
          id: renderingTemplateCreationResponse.data.templateId,
          name: createCredentialRenderingTemplatePayload.name,
          description: createCredentialRenderingTemplatePayload.description,
          type: createCredentialRenderingTemplatePayload.type,
        },
      });

      this.logger.debug(`Rendering template registered in the database with ID: ${renderingTemplateRegistration.id}`);

      return renderingTemplateRegistration;
    } catch (error) {
      this.logger.error(`Error creating or registering rendering template: ${error.message}`, error.stack);
      throw error;
    }
  }

  async setVerificationTemplate(templateId: string, setVerificationTemplatePayload: SetVerificationTemplateDTO) {
    try {
      // Step 1: Check if the main template exists
      const template = await this.getTemplateByTemplateId(templateId);
      if (!template) {
        throw new Error(`Template with ID ${templateId} does not exist.`);
      }

      this.logger.debug(`Found template with ID ${templateId}: ${JSON.stringify(template)}`);

      // Step 2: Check if the verification template exists
      const verificationTemplate = await this.getTemplateByTemplateId(
        setVerificationTemplatePayload.verificationTemplateId,
      );
      if (!verificationTemplate) {
        throw new Error(
          `Verification template with ID ${setVerificationTemplatePayload.verificationTemplateId} does not exist.`,
        );
      }

      this.logger.debug(
        `Found verification template with ID ${setVerificationTemplatePayload.verificationTemplateId}: ${JSON.stringify(
          verificationTemplate,
        )}`,
      );

      // Step 3: Upsert the Template Entity
      const updatedTemplate = await this.prisma.template.upsert({
        where: { id: templateId },
        update: {
          verificationTemplateId: setVerificationTemplatePayload.verificationTemplateId,
        },
        create: {
          id: templateId,
          name: template.name || 'Default Name', // Use default values or extract appropriately
          description: template.description || 'Default Description',
          type: template.type || 'Default Type',
          verificationTemplateId: setVerificationTemplatePayload.verificationTemplateId,
        },
      });

      this.logger.debug(`Updated template with ID ${templateId}: ${JSON.stringify(updatedTemplate)}`);

      return updatedTemplate;
    } catch (error) {
      this.logger.error(
        `Error setting verification template for template ID ${templateId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
