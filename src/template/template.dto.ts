export class CreateTemplateDTO {
    name: string;
    description: string;
    template: string;
    schemaId: string;
    type: string;
  }

export class SetVerificationTemplateDTO {
    verificationTemplateId: string;
}