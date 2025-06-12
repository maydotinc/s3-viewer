import { S3Client } from "@aws-sdk/client-s3";
import { prisma } from "@s3-viewer/db";

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
