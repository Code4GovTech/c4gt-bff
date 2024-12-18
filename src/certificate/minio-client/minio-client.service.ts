import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';

interface MinioConfig {
  username: string;
  password: string;
  bucketName: string;
  port: number;
  endpoint: string;
  secretKey: string;
  accessKey: string;
  useSSL: boolean;
}

@Injectable()
export class MinioClient implements OnModuleInit {
  private client: Minio.Client;
  private bucketName: string;

  constructor(private readonly configService: ConfigService) {
    const minioConfig = this.configService.get<MinioConfig>('minio');
    this.client = new Minio.Client({
      endPoint: minioConfig.endpoint,
      port: minioConfig.port,
      useSSL: minioConfig.useSSL,
      accessKey: minioConfig.accessKey,
      secretKey: minioConfig.secretKey,
    });
    this.bucketName = minioConfig.bucketName;
  }

  async onModuleInit(): Promise<void> {
    try {
      const exists = await this.client.bucketExists(this.bucketName);
      if (!exists) {
        await this.client.makeBucket(this.bucketName);
        console.log(`Bucket "${this.bucketName}" created.`);
      } else {
        console.log(`Bucket "${this.bucketName}" already exists.`);
      }
    } catch (error) {
      console.error(`Failed to ensure minio bucket existence: ${error.message}`);
    }
  }

  async upload(objectName: string, buffer: Buffer): Promise<string | Minio.UploadedObjectInfo> {
    try {
      const etag = await this.client.putObject(this.bucketName, objectName, buffer);
      console.log(`Uploaded object "${objectName}" with etag: ${etag}`);
      return etag;
    } catch (error) {
      throw new Error(`Failed to upload object: ${error.message}`);
    }
  }

  async download(objectName: string): Promise<Buffer> {
    try {
      const chunks: Buffer[] = [];
      const stream = await this.client.getObject(this.bucketName, objectName);

      return new Promise((resolve, reject) => {
        stream.on('data', (chunk) => chunks.push(chunk));
        stream.on('end', () => {
          console.log(`Downloaded object "${objectName}".`);
          resolve(Buffer.concat(chunks));
        });
        stream.on('error', (err) => reject(new Error(`Failed to download object: ${err.message}`)));
      });
    } catch (error) {
      throw new Error(`Failed to download object: ${error.message}`);
    }
  }

  async delete(objectName: string): Promise<void> {
    try {
      await this.client.removeObject(this.bucketName, objectName);
      console.log(`Deleted object "${objectName}".`);
    } catch (error) {
      throw new Error(`Failed to delete object: ${error.message}`);
    }
  }
}
