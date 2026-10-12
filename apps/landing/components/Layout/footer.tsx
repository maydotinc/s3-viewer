import { ExternalLink } from "@/components/external-link";
import {
   GITHUB_URL,
   MAY_NAME,
   MAY_ROUNDED_LOGO_URL,
   MAY_URL,
} from "@/lib/site-config";
import { cn } from "@s3-viewer/ui/lib/utils";
import Image from "next/image";
import Link from "next/link";

type LinkItem = { label: string; href: string; external?: boolean };
type LinkGroup = { title: string; links: LinkItem[] };

const groups: LinkGroup[] = [
   {
      title: "Use cases",
      links: [
         { label: "Multi-cloud", href: "/use-cases/multi-cloud" },
         {
            label: "Sharing without AWS",
            href: "/use-cases/share-with-non-technical-users",
         },
         { label: "Team access", href: "/use-cases/teams" },
         { label: "Better S3 browser", href: "/use-cases/s3-browser" },
         { label: "Cloudflare R2", href: "/use-cases/cloudflare-r2" },
         { label: "Security", href: "/use-cases/security-and-audit" },
      ],
   },
   {
      title: "How to",
      links: [
         { label: "Rename an S3 file", href: "/how-to/rename-s3-file" },
         { label: "Create a folder", href: "/how-to/create-folder-in-s3" },
         {
            label: "Fix Access Denied",
            href: "/how-to/fix-s3-access-denied",
         },
         {
            label: "Share an S3 file",
            href: "/how-to/share-s3-file-with-non-technical-user",
         },
         {
            label: "Invite a teammate",
            href: "/how-to/invite-teammate-to-s3-bucket",
         },
         { label: "All guides", href: "/how-to" },
      ],
   },
   {
      title: "Company",
      links: [
         { label: "About", href: "/about" },
         { label: "Brand kit", href: "/brand-kit" },
         { label: "GitHub", href: GITHUB_URL, external: true },
         { label: "Privacy policy", href: "/legal/privacy-policy" },
         { label: "Terms of service", href: "/legal/terms-of-service" },
         { label: "Contact", href: "/contact" },
      ],
   },
];

const LINK =
   "inline-block py-1 text-sm text-viewertext transition-colors hover:text-viewerblack";

const Column = ({
   title,
   links,
   wide,
}: LinkGroup & {
   wide?: boolean;
}) => (
   <div
      className={cn(
         "flex min-w-0 flex-col gap-3",
         wide && "col-span-2 sm:col-span-1"
      )}
   >
      <h3 className="text-xs font-medium tracking-wide text-viewerlighttext uppercase">
         {title}
      </h3>
      <ul
         className={cn(
            "flex flex-col gap-1.5",
            wide && "grid grid-cols-2 gap-x-8 sm:flex"
         )}
      >
         {links.map((link) => (
            <li key={link.href}>
               {link.external ? (
                  <ExternalLink href={link.href} className={LINK}>
                     {link.label}
                  </ExternalLink>
               ) : (
                  <Link href={link.href} className={LINK}>
                     {link.label}
                  </Link>
               )}
            </li>
         ))}
      </ul>
   </div>
);

const Footer = () => {
   return (
      <footer
         className="w-full border-t border-viewerborder bg-viewerwhite"
         aria-labelledby="footer-heading"
      >
         <h2 id="footer-heading" className="sr-only">
            Footer
         </h2>

         <div className="mx-auto w-full max-w-6xl px-6 py-14">
            <div className="grid grid-cols-2 gap-x-8 gap-y-12 sm:grid-cols-3 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
               <div className="col-span-2 flex flex-col gap-4 sm:col-span-3 lg:col-span-1">
                  <Link
                     href="/"
                     draggable={false}
                     className="flex w-fit items-center"
                     aria-label="S3 Viewer home"
                  >
                     <Image
                        src="/icons/viewer.svg"
                        alt="S3 Viewer"
                        width={150}
                        height={32}
                        draggable={false}
                        className="h-7 w-auto select-none"
                     />
                  </Link>
                  <p className="max-w-65 text-sm text-viewertext">
                     A fast, open-source viewer for any S3-compatible object
                     storage.
                  </p>
                  <ExternalLink
                     href={MAY_URL}
                     className="inline-flex w-fit items-center gap-2 text-sm text-viewerlighttext transition-colors hover:text-viewerblack"
                  >
                     <span>Built by</span>
                     <Image
                        src={MAY_ROUNDED_LOGO_URL}
                        alt=""
                        width={20}
                        height={20}
                        className="size-5 rounded-[5px]"
                     />
                     <span>{MAY_NAME}</span>
                  </ExternalLink>
                  <span className="text-xs text-viewerlighttext">
                     S3 Viewer is open source under MIT.
                  </span>
               </div>

               {groups.map((group, i) => (
                  <Column
                     key={group.title}
                     title={group.title}
                     links={group.links}
                     wide={i === groups.length - 1}
                  />
               ))}
            </div>
         </div>
      </footer>
   );
};

export default Footer;
