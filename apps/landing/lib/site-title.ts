import { PRODUCT_NAME } from "@s3-viewer/shared/constants";

const SITE_NAME = PRODUCT_NAME;

const siteTitle = (title: string) =>
   title.trim().endsWith(SITE_NAME) ? title : `${title} | ${SITE_NAME}`;

export { siteTitle };
