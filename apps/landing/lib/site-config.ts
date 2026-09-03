const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
if (!siteUrl) throw new Error("NEXT_PUBLIC_SITE_URL is not set");

export const SITE_URL = new URL(siteUrl).origin;

export const GITHUB_URL = "https://github.com/maydotinc/s3-viewer";
