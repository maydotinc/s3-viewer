import { backblazeRegion } from "@s3-viewer/types";

const DEFAULT_REGION = "us-east-1";

const REGIONS = [
   "auto",
   DEFAULT_REGION,
   "us-east-2",
   "us-west-1",
   "us-west-2",
   "af-south-1",
   "ap-east-1",
   "ap-east-2",
   "ap-south-1",
   "ap-south-2",
   "ap-southeast-1",
   "ap-southeast-2",
   "ap-southeast-3",
   "ap-southeast-4",
   "ap-southeast-5",
   "ap-southeast-6",
   "ap-southeast-7",
   "ap-northeast-1",
   "ap-northeast-2",
   "ap-northeast-3",
   "ca-central-1",
   "ca-west-1",
   "eu-central-1",
   "eu-central-2",
   "eu-west-1",
   "eu-west-2",
   "eu-west-3",
   "eu-south-1",
   "eu-south-2",
   "eu-north-1",
   "il-central-1",
   "me-south-1",
   "me-central-1",
   "mx-central-1",
   "sa-east-1",
] as const;

const defaultRegion = (endpoint: string): string => {
   const backblaze = backblazeRegion(endpoint);
   if (backblaze) return backblaze;
   let hostname: string;
   try {
      hostname = new URL(endpoint.trim()).hostname.replace(/\.$/, "");
   } catch {
      return DEFAULT_REGION;
   }
   return /(?:^|\.)r2\.cloudflarestorage\.com$/.test(hostname)
      ? "auto"
      : DEFAULT_REGION;
};

export { defaultRegion, REGIONS };
