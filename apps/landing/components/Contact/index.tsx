import {
   CONTACT_EMAIL,
   GITHUB_ISSUES_URL,
   GITHUB_URL,
   MAY_URL,
} from "@/lib/site-config";
import { ArrowUpRight, Building2, ChevronRight, Mail } from "lucide-react";
import Link from "next/link";
import { FaGithub } from "react-icons/fa";

type Channel = {
   href: string;
   title: string;
   description: string;
   cta: string;
   icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
   external?: boolean;
};

const CHANNELS: Channel[] = [
   {
      href: `mailto:${CONTACT_EMAIL}?subject=S3%20Viewer`,
      title: "Email",
      description:
         "For account questions, security reports and anything private.",
      cta: CONTACT_EMAIL,
      icon: Mail,
   },
   {
      href: GITHUB_ISSUES_URL,
      title: "GitHub issues",
      description:
         "Bugs and feature requests. The code is open source; issues and pull requests are welcome.",
      cta: "Open an issue",
      icon: FaGithub,
      external: true,
   },
   {
      href: MAY_URL,
      title: "May Inc.",
      description: "The studio behind S3 Viewer. See what else we build.",
      cta: "may.inc",
      icon: Building2,
      external: true,
   },
];

const Contact = () => {
   return (
      <main className="bg-viewerwhite w-full overflow-x-hidden">
         <section className="border-b border-viewerborder bg-viewergray">
            <div className="mx-auto w-full max-w-6xl px-6 pt-16 pb-16">
               <nav
                  aria-label="Breadcrumb"
                  className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-viewerlighttext mb-6"
               >
                  <Link
                     href="/"
                     className="transition-colors hover:text-viewerblack"
                  >
                     Home
                  </Link>
                  <ChevronRight
                     className="size-3"
                     strokeWidth={2.5}
                     aria-hidden
                  />
                  <span className="font-medium text-viewerblack">Contact</span>
               </nav>
               <div className="flex flex-col gap-4 max-w-[760px]">
                  <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-viewerblack">
                     Contact
                  </h1>
                  <p className="text-viewertext max-w-[620px]">
                     S3 Viewer is built by May Inc. Email us, open an issue, or
                     read about the studio.
                  </p>
               </div>
            </div>
         </section>

         <section>
            <div className="mx-auto w-full max-w-6xl px-6 py-20">
               <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 items-stretch">
                  {CHANNELS.map((channel) => (
                     <Link
                        key={channel.href}
                        href={channel.href}
                        target={channel.external ? "_blank" : undefined}
                        rel={channel.external ? "noreferrer" : undefined}
                        aria-label={`${channel.title}: ${channel.cta}`}
                        className="group relative flex h-full flex-col gap-4 rounded-xl border border-viewerborder bg-viewerwhite p-6 transition-colors hover:border-viewerblue/40 outline-none focus-visible:outline-none focus-visible:border-viewerblue"
                     >
                        <div className="flex items-center justify-between gap-3">
                           <span className="grid size-10 place-items-center rounded-lg bg-viewergray text-viewerblue">
                              <channel.icon
                                 className="size-5"
                                 strokeWidth={1.8}
                              />
                           </span>
                           {channel.external && (
                              <ArrowUpRight
                                 aria-hidden
                                 className="size-4 flex-none text-viewerlighttext transition-colors group-hover:text-viewerblack"
                                 strokeWidth={2}
                              />
                           )}
                        </div>

                        <div className="flex flex-col gap-2 mt-auto">
                           <h2 className="text-xl font-semibold tracking-tight text-viewerblack leading-snug">
                              {channel.title}
                           </h2>
                           <p className="text-sm text-viewertext">
                              {channel.description}
                           </p>
                           <span className="mt-2 text-sm font-medium text-viewerblack underline decoration-viewerborder underline-offset-[3px] group-hover:decoration-viewerblack">
                              {channel.cta}
                           </span>
                        </div>
                     </Link>
                  ))}
               </div>

               <p className="mt-10 text-sm text-viewertext max-w-[640px]">
                  Email us instead of opening a public issue for security
                  reports. See{" "}
                  <Link
                     href={`${GITHUB_URL}/blob/main/SECURITY.md`}
                     target="_blank"
                     rel="noreferrer"
                     className="text-viewerblack font-medium underline decoration-viewerborder underline-offset-[3px] hover:decoration-viewerblack"
                  >
                     SECURITY.md
                  </Link>
                  .
               </p>
            </div>
         </section>
      </main>
   );
};

export default Contact;
