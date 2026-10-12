import { FOCUS_RING } from "@s3-viewer/ui/lib/classes";

const TEXT_LINK = `rounded-sm font-medium text-viewerblue underline-offset-4 outline-none hover:underline disabled:cursor-default disabled:text-viewerlighttext disabled:no-underline ${FOCUS_RING}`;

const LEGAL_LINK = `rounded-sm underline underline-offset-4 outline-none hover:text-viewertext ${FOCUS_RING}`;

const COMPANY_LINK = `rounded-sm underline-offset-4 outline-none hover:text-viewerblack hover:underline ${FOCUS_RING}`;

export { COMPANY_LINK, LEGAL_LINK, TEXT_LINK };
