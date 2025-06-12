import { ListBucketsCommand, S3Client } from "@aws-sdk/client-s3";

type serverCredentials = {
    endpoint: string;
    region: string;
    accessKey: string;
    secretKey: string;
}

const testServerConnection = async (credentials: serverCredentials) => {
    const s3Client = new S3Client({
        endpoint: credentials.endpoint,
        region: credentials.region,
        credentials: {
            accessKeyId: credentials.accessKey,
            secretAccessKey: credentials.secretKey,
        },
    });
    const command = new ListBucketsCommand({});
    const response = await s3Client.send(command);
    if (response.Buckets) {
        return true;
    }
    return false;
};

export { testServerConnection };
