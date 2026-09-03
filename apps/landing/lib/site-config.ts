import { HOW_TOS } from "../components/HowTo/data";
import { USE_CASES } from "../components/UseCases/data";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
if (!siteUrl) throw new Error("NEXT_PUBLIC_SITE_URL is not set");

export const SITE_URL = new URL(siteUrl).origin;

export const GITHUB_URL = "https://github.com/maydotinc/s3-viewer";

export const HOW_TO_SLUGS: string[] = HOW_TOS.map((h) => h.slug);

export const USE_CASE_SLUGS: string[] = USE_CASES.map((u) => u.slug);
