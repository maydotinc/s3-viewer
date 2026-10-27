import {
   GITHUB_ISSUES_URL,
   HOW_TO_SLUGS,
   USE_CASE_SLUGS,
} from "@s3-viewer/shared";
import { publicEnv } from "./env";

const LANDING_ROUTES: readonly string[] = [
   "/",
   "/about",
   "/brand-kit",
   "/contact",
   "/legal",
   "/legal/terms-of-service",
   "/legal/privacy-policy",
   "/how-to",
   ...HOW_TO_SLUGS.map((s) => `/how-to/${s}`),
   "/use-cases",
   ...USE_CASE_SLUGS.map((s) => `/use-cases/${s}`),
];

const LEGAL_ALIAS_REDIRECTS: Readonly<Record<string, string>> = {
   "/tos": "/legal/terms-of-service",
   "/terms": "/legal/terms-of-service",
   "/terms-of-service": "/legal/terms-of-service",
   "/terms-and-conditions": "/legal/terms-of-service",
   "/terms-conditions": "/legal/terms-of-service",
   "/privacy": "/legal/privacy-policy",
   "/privacy-policy": "/legal/privacy-policy",
};

const TERMS_URL = `${publicEnv.siteOrigin}/legal/terms-of-service`;
const PRIVACY_URL = `${publicEnv.siteOrigin}/legal/privacy-policy`;
// without the landing site there is no contact page to send anyone to
const supportUrl = (): string =>
   publicEnv.hasLanding ? `${publicEnv.siteOrigin}/contact` : GITHUB_ISSUES_URL;

export {
   LANDING_ROUTES,
   LEGAL_ALIAS_REDIRECTS,
   PRIVACY_URL,
   TERMS_URL,
   supportUrl,
};
