import { S3Client } from "@aws-sdk/client-s3";
import { prisma } from "@s3-viewer/db";
import { ServerCredentials } from "@s3-viewer/types";

const getS3Client = async (serverId: string) => {
  const server = await prisma.server.findUnique({
    where: {
      id: serverId,
    },
    select: {
      credentials: true,
    }
  });

  if (!server) {
    throw new Error("Server not found");
  }

  const credentials = JSON.parse(server.credentials as string);
  console.log(credentials);

  return new S3Client({
    endpoint: credentials.endpoint,
    region: credentials.region,
    credentials: {
      accessKeyId: credentials.accessKey,
      secretAccessKey: credentials.secretKey,
    },
    forcePathStyle: true,
  });
};

const getS3ClientFromCredentials = (serverCredentials: ServerCredentials) => {
  return new S3Client({
    endpoint: serverCredentials.endpoint,
    region: serverCredentials.region,
    credentials: {
      accessKeyId: serverCredentials.accessKey,
      secretAccessKey: serverCredentials.secretKey,
    },
    forcePathStyle: true,
  });
};

export { getS3Client, getS3ClientFromCredentials };
