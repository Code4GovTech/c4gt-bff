export class CreateSchemaDTO {
  name: string;
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
