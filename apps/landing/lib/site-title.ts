const SITE_NAME = "S3 Viewer";

const siteTitle = (title: string) =>
   title.trim().endsWith(SITE_NAME) ? title : `${title} | ${SITE_NAME}`;

export { siteTitle };
