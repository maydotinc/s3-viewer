import { GITHUB_URL, MAY_URL } from "@/lib/site-config";
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
         {
            label: "Share an S3 file",
            href: "/how-to/share-s3-file-with-non-technical-user",
         },
         {
            label: "Invite a teammate",
            href: "/how-to/invite-teammate-to-s3-bucket",
         },
         {
            label: "View S3 + R2",
            href: "/how-to/view-s3-and-r2-side-by-side",
         },
         {
            label: "Granular permissions",
            href: "/how-to/set-granular-s3-permissions",
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

const YEAR = new Date().getFullYear();

const Column = ({ title, links }: LinkGroup) => (
   <div className="flex min-w-0 flex-col gap-3">
      <h3 className="text-xs font-medium tracking-wide text-viewerlighttext uppercase">
         {title}
      </h3>
      <ul className="flex flex-col gap-2.5">
         {links.map((link) => (
            <li key={link.href}>
               {link.external ? (
                  <a
                     href={link.href}
                     target="_blank"
                     rel="noreferrer"
                     className="text-sm text-viewertext transition-colors hover:text-viewerblack"
                  >
                     {link.label}
                  </a>
               ) : (
                  <Link
                     href={link.href}
                     className="text-sm text-viewertext transition-colors hover:text-viewerblack"
                  >
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

         <div className="mx-auto w-full max-w-6xl px-6 pt-14 pb-8">
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
                        quality={100}
                        draggable={false}
                        className="h-7 w-auto select-none"
                     />
                  </Link>
                  <p className="max-w-[260px] text-sm text-viewertext">
                     A fast, open-source viewer for any S3-compatible object
                     storage.
                  </p>
                  <a
                     href={MAY_URL}
                     target="_blank"
                     rel="noopener noreferrer"
                     className="inline-flex w-fit items-center gap-2 text-sm text-viewerlighttext transition-colors hover:text-viewerblack"
                  >
                     <span>Built by</span>
                     <Image
                        src="https://cdn-may.com/assets/may-rounded-512x512.png"
                        alt=""
                        width={20}
                        height={20}
                        className="size-5 rounded-[5px]"
                        unoptimized
                     />
                     <span>May Inc.</span>
                  </a>
               </div>

               {groups.map((group) => (
                  <Column
                     key={group.title}
                     title={group.title}
                     links={group.links}
                  />
               ))}
            </div>

            <div className="mt-12 border-t border-viewerborder pt-6">
               <span className="text-xs text-viewerlighttext">
                  © {YEAR} S3 Viewer. Open source under MIT.
               </span>
            </div>
         </div>
      </footer>
   );
};

export default Footer;
