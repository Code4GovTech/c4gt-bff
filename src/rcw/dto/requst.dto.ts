export class CreateCredSchemaDTO {
  id: string;
  description: string;
  properties: {
    [k: string]: {
      type: string;
      description?: string;
      format?: string;
    };
  };
  required: string[];
  tags: string[];
}

export class CreateCredDTO {
  type: string;
  subject: object;
  schema: string;
  tags?: string[];
  templateId?: string;
}

export class CreateTemplateDTO {
  template: string;
  schema: string;
  type: string;
}
