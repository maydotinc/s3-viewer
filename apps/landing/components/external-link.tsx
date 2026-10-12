import { APP_PATH } from "@/lib/site-config";
import Link from "next/link";
import type { ComponentProps } from "react";

type AnchorProps = ComponentProps<"a">;

export const isExternalHref = (href: string) => /^https?:\/\//.test(href);

const leavesThisApp = (href: string) =>
   href === APP_PATH ||
   href.startsWith(`${APP_PATH}/`) ||
   href.startsWith("mailto:");

export const ExternalLink = (props: AnchorProps) => (
   <a target="_blank" rel="noopener noreferrer" {...props} />
);

// next/link only for routes this site serves; the app and mail links get a plain anchor.
export const SiteLink = ({
   href,
   ...props
}: AnchorProps & { href: string }) => {
   if (isExternalHref(href)) return <ExternalLink href={href} {...props} />;
   if (leavesThisApp(href)) return <a href={href} {...props} />;
   return <Link href={href} {...props} />;
};
