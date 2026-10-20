import {
   COMPANY_NAME,
   COMPANY_URL,
   GITHUB_URL,
   SITE_PATHS,
} from "@s3-viewer/types/constants";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
if (!siteUrl) throw new Error("NEXT_PUBLIC_SITE_URL is not set");

export const SITE_URL = new URL(siteUrl).origin;

export { GITHUB_ISSUES_URL, GITHUB_URL } from "@s3-viewer/types/constants";
export const LICENSE_URL = `${GITHUB_URL}/blob/main/LICENSE`;
export const CONTACT_EMAIL = "info@may.inc";

export const APP_PATH = SITE_PATHS.dashboard;

// mirrors the entity data published on may.inc so both sites describe the same organization.
export const MAY_NAME = COMPANY_NAME;
export const MAY_LEGAL_NAME = "May Software Inc.";
export const MAY_URL = COMPANY_URL;
export const MAY_HOST = new URL(MAY_URL).host;
export const MAY_S3_VIEWER_URL = `${MAY_URL}/s3-viewer`;
export const MAY_GITHUB_URL = "https://github.com/maydotinc";
export const MAY_LINKEDIN_URL = "https://linkedin.com/company/maydotinc";
export const MAY_LOGO_URL = "https://cdn-may.com/assets/may-square-512x512.png";
export const MAY_ROUNDED_LOGO_URL =
   "https://cdn-may.com/assets/may-rounded-512x512.png";
export const MAY_FOUNDING_YEAR = "2024";
export const MAY_LOCATION = "Toronto, Canada";

export const FOUNDER_PROFILE_URL = `${MAY_URL}/aleem`;

export const OG_IMAGE_URL = `${SITE_URL}/landing/bucketview.png`;
