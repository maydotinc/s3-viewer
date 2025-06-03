import { S3Client, S3ClientConfig } from "@aws-sdk/client-s3";

// Create S3 client configuration
const s3Config: S3ClientConfig = {
  endpoint: process.env.AWS_ENDPOINT || 'http://localhost:9000',
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
  forcePathStyle: true,
};

// Create and export the S3 client
export const s3Client = new S3Client(s3Config);
