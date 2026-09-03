import Image from "next/image";
import Link from "next/link";

const CONTACT_HREF = "mailto:info@may.inc?subject=S3%20Viewer";

type LinkItem = { label: string; href: string };
type LinkGroup = { title: string; links: LinkItem[] };

const groups: LinkGroup[] = [
   {
      title: "Use Cases",
      links: [
         { label: "Multi-cloud", href: "/use-cases/multi-cloud" },
         {
            label: "Sharing without AWS",
            href: "/use-cases/share-with-non-technical-users",
         },
         { label: "Team workspaces", href: "/use-cases/teams" },
         { label: "Better S3 browser", href: "/use-cases/s3-browser" },
         { label: "Cloudflare R2", href: "/use-cases/cloudflare-r2" },
         { label: "Security", href: "/use-cases/security-and-audit" },
      ],
   },
   {
      title: "How To",
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
         { label: "Brand Kit", href: "/brand-kit" },
         { label: "Privacy Policy", href: "/legal/privacy-policy" },
         { label: "Terms of Service", href: "/legal/terms-of-service" },
         { label: "Contact", href: CONTACT_HREF },
      ],
   },
];

const YEAR = new Date().getFullYear();

const Column = ({ title, links }: LinkGroup) => (
   <div className="flex flex-col gap-3">
      <h3 className="text-[11px] font-semibold tracking-[0.14em] uppercase text-viewerwhite/70">
         {title}
      </h3>
      <ul className="flex flex-col gap-2.5">
         {links.map((link) => (
            <li key={link.href}>
               <Link
                  href={link.href}
                  className="text-sm text-viewerwhite/80 transition-colors hover:text-viewerwhite"
               >
                  {link.label}
               </Link>
            </li>
         ))}
      </ul>
   </div>
);

const Footer = () => {
   return (
      <footer
         className="flex w-full flex-col items-center bg-viewerblue text-viewerwhite"
         aria-labelledby="footer-heading"
      >
         <h2 id="footer-heading" className="sr-only">
            Footer
         </h2>

         <div className="w-full max-w-screen-2xl px-30 max-xl:px-15 max-md:px-4 pt-10 md:pt-12 pb-6 md:pb-7">
            <div className="grid grid-cols-2 md:grid-cols-12 gap-8">
               <div className="col-span-2 md:col-span-6 flex flex-col gap-4">
                  <Link
                     href="/"
                     draggable={false}
                     className="flex items-center w-fit"
                     aria-label="S3 Viewer home"
                  >
                     <Image
                        src="/icons/whiteviewer.svg"
                        alt="S3 Viewer"
                        width={208}
                        height={47}
                        priority
                        quality={100}
                        draggable={false}
                        className="select-none h-8 w-auto"
                     />
                  </Link>
                  <p className="text-sm text-viewerwhite/80 leading-relaxed max-w-[320px]">
                     A fast, open-source viewer for any S3-compatible object
                     storage.
                  </p>
                  <a
                     href="https://may.inc"
                     target="_blank"
                     rel="noopener noreferrer"
                     className="inline-flex items-center gap-2 text-[12.5px] font-medium text-viewerwhite/70 transition-colors hover:text-viewerwhite w-fit"
                  >
                     <span>Built by</span>
                     <Image
                        src="https://cdn-may.com/assets/may-rounded-512x512.png"
                        alt="May Inc."
                        width={20}
                        height={20}
                        className="rounded-[5px]"
                        unoptimized
                     />
                     <span>May Inc.</span>
                  </a>
               </div>

               {groups.map((group) => (
                  <div key={group.title} className="md:col-span-2">
                     <Column title={group.title} links={group.links} />
                  </div>
               ))}
            </div>

            <div className="mt-8">
               <span className="text-xs text-viewerwhite/70">
                  © {YEAR} S3 Viewer. Open source under MIT.
               </span>
            </div>
         </div>
      </footer>
   );
};

export default Footer;
