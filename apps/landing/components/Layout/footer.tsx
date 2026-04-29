import Image from "next/image";
import Link from "next/link";

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
         { label: "Security & audit", href: "/use-cases/security-and-audit" },
      ],
   },
   {
      title: "How-to",
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
         { label: "Legal", href: "/legal" },
      ],
   },
];

const Footer = () => {
   return (
      <footer
         className="flex w-full flex-col items-center bg-viewerblue text-viewerwhite"
         aria-labelledby="footer-heading"
      >
         <h2 id="footer-heading" className="sr-only">
            Footer
         </h2>

         <div className="w-full max-w-screen-2xl px-30 max-xl:px-15 max-md:px-4 py-12 max-md:py-10">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-12 max-md:gap-10">
               <div className="md:col-span-5 flex flex-col gap-5">
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
                        className="select-none h-10 w-auto"
                     />
                  </Link>
                  <p className="text-sm text-white/70 leading-relaxed max-w-sm">
                     A fast, open-source viewer for S3-compatible object
                     storage. One interface for AWS S3, Cloudflare R2, MinIO,
                     Backblaze B2, and any S3 API.
                  </p>
                  <span className="inline-flex items-center gap-2 text-[12.5px] font-medium text-white/85 w-fit">
                     <span className="text-white/60">Built by</span>
                     <Image
                        src="https://cdn-may.com/assets/may-rounded-512x512.png"
                        alt="May Inc"
                        width={20}
                        height={20}
                        className="rounded-[5px]"
                        unoptimized
                     />
                     <span>May Inc</span>
                  </span>
                  <span className="text-[11.5px] text-white/55 mt-1">
                     © {new Date().getFullYear()} S3 Viewer. Open source
                     under MIT.
                  </span>
               </div>

               <div className="md:col-span-7 grid grid-cols-2 md:grid-cols-3 gap-8 max-md:gap-6">
                  {groups.map((group) => (
                     <div key={group.title} className="flex flex-col gap-3">
                        <h3 className="text-[11px] font-semibold tracking-[0.14em] uppercase text-white/60">
                           {group.title}
                        </h3>
                        <ul className="flex flex-col gap-2.5">
                           {group.links.map((link) => (
                              <li key={`${group.title}-${link.label}`}>
                                 <Link
                                    href={link.href}
                                    className="text-sm text-white/80 transition-colors hover:text-white"
                                 >
                                    {link.label}
                                 </Link>
                              </li>
                           ))}
                        </ul>
                     </div>
                  ))}
               </div>
            </div>
         </div>
      </footer>
   );
};

export default Footer;
