import { identity } from "rxjs";

export default () => ({
  schemaService: {
    baseUrl: process.env.SCHEMA_BASE_URL,
    defaultSchemaVersion: '1.0.0',
  },
  credentialService: {
    baseUrl: process.env.CREDENTIAL_BASE_URL,
    defaultCredentialContext: [
      'https://www.w3.org/2018/credentials/v1',
      'https://www.w3.org/2018/credentials/examples/v1',
    ],
    defaultSigningId: process.env.C4GT_DID,
    defaultCertificateLifetime: process.env.DEFAULT_CERTIFICATE_LIFETIME,
  },
  identityService: {
    baseUrl: process.env.IDENTITY_BASE_URL,
  },
  certificates: {
    baseUrl: process.env.VERIFICATION_BASE_URL,
  },
  minio: {
    username: process.env.MINIO_USERNAME,
    password: process.env.MINIO_PASSWORD,
    bucketName: process.env.MINIO_BUCKETNAME,
    port: parseInt(process.env.MINIO_PORT, 10) || 9000,
    endpoint: process.env.MINIO_ENDPOINT,
    secretKey: process.env.MINIO_SECRET_KEY,
    accessKey: process.env.MINIO_ACCESS_KEY,
    useSSL: process.env.MINIO_USE_SSL == 'true',
  },
  auth: {
    adminToken: process.env.ADMIN_TOKEN
  }
});
