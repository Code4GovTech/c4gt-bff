export default () => ({
  schemaService: {
    baseUrl: process.env.SCHEMA_BASE_URL,
  },
  minio: {
    username: process.env.MINIO_USERNAME,
    password: process.env.MINIO_PASSWORD,
    bucketName: process.env.MINIO_BUCKETNAME,
    port: parseInt(process.env.MINIO_PORT, 10) || 9000,
    endpoint: process.env.MINIO_ENDPOINT,
    secretKey: process.env.MINIO_SECRET_KEY,
    accessKey: process.env.MINIO_ACCESS_KEY,
    useSSL: process.env.MINIO_USE_SSL,
  },
});
